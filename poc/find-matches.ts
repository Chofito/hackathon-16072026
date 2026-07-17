// POC: dada la URL de un producto en una tienda conocida (por defecto MAX),
// extrae su información identificable y la usa para buscar el mismo producto
// en las demás tiendas.
//
// Estrategia (cortés y robots-safe, ver docs/SCRAPING.md):
//   1. Extraer identificadores de la URL fuente vía JSON-LD.
//   2. En cada tienda destino, descargar su sitemap de producto (permitido por
//      robots) y rankear URLs por coincidencia de tokens contra el nombre fuente.
//   3. Descargar las páginas de los mejores candidatos y confirmar con su
//      JSON-LD/microdata (precio, sku, gtin, disponibilidad).
//
// No usa los buscadores internos de las tiendas: Kemik los renderiza en cliente
// (no sirven con fetch plano) y robots.txt de Curacao/Pacifiko prohíbe sus rutas
// de búsqueda. El sitemap es la fuente permitida y estable.
//
// Uso (corre con Bun o Deno):
//   bun run poc/find-matches.ts
//   bun run poc/find-matches.ts "https://www.max.com.gt/<otro-producto>"
//   bun run poc/find-matches.ts --max-sitemaps 10     (limita el escaneo por tienda)
//   deno task poc                                       (equivalente en Deno)

import process from 'node:process'
import { writeFile } from 'node:fs/promises'
import {
  type Candidate,
  DELAY_SITEMAP_MS,
  extractLocs,
  extractProduct,
  politeFetch,
  type ProductInfo,
  scoreTokens,
  slugFromUrl,
  tokenize,
} from './lib.ts'

interface StoreConfig {
  slug: string
  name: string
  currency: string
  sitemapIndex: string
  // ¿Cuáles hijos del índice son sitemaps de PRODUCTO?
  isProductSitemap: (loc: string) => boolean
}

const STORES: StoreConfig[] = [
  {
    slug: 'max',
    name: 'MAX',
    currency: 'GTQ',
    sitemapIndex: 'https://www.max.com.gt/sitemap.xml',
    // MAX: sitemap-0.xml (productos) + sitemaps por categoría; excluir el índice.
    isProductSitemap: (loc) =>
      /sitemap-\d+\.xml/i.test(loc) || /sitemap-[a-z0-9-]+\.xml/i.test(loc),
  },
  {
    slug: 'pacifiko',
    name: 'Pacifiko',
    currency: 'GTQ',
    sitemapIndex: 'https://www.pacifiko.com/sitemap.xml',
    isProductSitemap: (loc) => /\/pids-\d+\.xml/i.test(loc),
  },
  {
    slug: 'curacao',
    name: 'Curacao',
    currency: 'GTQ',
    sitemapIndex: 'https://www.lacuracaonline.com/media/sitemap/sitemap_lco_gt_index.xml',
    isProductSitemap: (loc) => /_gt_products\.xml/i.test(loc),
  },
  {
    slug: 'kemik',
    name: 'Kemik',
    currency: 'GTQ',
    sitemapIndex: 'https://www.kemik.gt/sitemap.xml',
    isProductSitemap: (loc) => /sitemap-product\.xml/i.test(loc),
  },
]

function storeSlugFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname
    if (host.endsWith('max.com.gt')) return 'max'
    if (host.endsWith('kemik.gt')) return 'kemik'
    if (host.endsWith('pacifiko.com')) return 'pacifiko'
    if (host.endsWith('lacuracaonline.com')) return 'curacao'
  } catch { /* ignore */ }
  return null
}

const TOP_CANDIDATES = 5
const MIN_SLUG_SCORE = 0.34
// Umbral de confianza: bajo esto, el match se marca "revisar" en vez de afirmarse.
// "Un match incorrecto es peor que un match faltante" — en duda, a la cola.
const CONFIDENT_SCORE = 0.85

interface Args {
  sourceUrl: string
  maxSitemaps: number
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  let maxSitemaps = 0 // 0 = sin límite
  const rest: string[] = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--max-sitemaps') {
      maxSitemaps = parseInt(args[++i] ?? '0', 10) || 0
    } else {
      rest.push(args[i])
    }
  }
  const sourceUrl = rest[0] ??
    'https://www.max.com.gt/consola-nintendo-switch-2-juego-mario-kart-world-descargable-nintendo-nsw2bunmkwus'
  return { sourceUrl, maxSitemaps }
}

// Descarga el sitemap índice de una tienda y devuelve todas las URLs de producto.
async function loadProductUrls(store: StoreConfig, maxSitemaps: number): Promise<string[]> {
  const indexXml = await politeFetch(store.sitemapIndex, DELAY_SITEMAP_MS)
  let children = extractLocs(indexXml).filter(store.isProductSitemap)
  if (maxSitemaps > 0) children = children.slice(0, maxSitemaps)

  const urls: string[] = []
  for (let i = 0; i < children.length; i++) {
    const xml = await politeFetch(children[i], DELAY_SITEMAP_MS)
    urls.push(...extractLocs(xml))
    process.stderr.write(
      `\r  [${store.name}] sitemaps ${i + 1}/${children.length}, URLs: ${urls.length}   `,
    )
  }
  process.stderr.write('\n')
  return urls
}

async function findInStore(
  store: StoreConfig,
  query: Set<string>,
  maxSitemaps: number,
): Promise<Candidate[]> {
  const urls = await loadProductUrls(store, maxSitemaps)

  // Ranking barato por slug (sin tocar la red).
  const ranked: Candidate[] = urls
    .map((url) => ({ url, slugScore: scoreTokens(query, tokenize(slugFromUrl(url))) }))
    .filter((c) => c.slugScore >= MIN_SLUG_SCORE)
    .sort((a, b) => b.slugScore - a.slugScore)
    .slice(0, TOP_CANDIDATES)

  // Confirmación: descargar cada candidato y extraer su info real.
  // Bonus: si el query trae GTIN y el candidato lo tiene igual → score 1.0 (capa EAN).
  for (const c of ranked) {
    try {
      const html = await politeFetch(c.url)
      c.info = extractProduct(html, c.url)
      c.nameScore = c.info.name ? scoreTokens(query, tokenize(c.info.name)) : c.slugScore
    } catch (err) {
      c.nameScore = 0
      console.error(`  ! ${store.name}: ${(err as Error).message}`)
    }
  }
  return ranked.sort((a, b) => (b.nameScore ?? 0) - (a.nameScore ?? 0))
}

/** Re-rankea candidatos: match EAN exacto gana sobre score por nombre. */
function applyEanBoost(candidates: Candidate[], sourceGtin: string | null): Candidate[] {
  if (!sourceGtin) return candidates
  return [...candidates]
    .map((c) => {
      if (c.info?.gtin && c.info.gtin === sourceGtin) {
        return { ...c, nameScore: 1 }
      }
      return c
    })
    .sort((a, b) => (b.nameScore ?? 0) - (a.nameScore ?? 0))
}

function fmtPrice(info?: ProductInfo): string {
  if (!info || info.price === null) return '—'
  const list = info.listPrice ? ` (antes ${info.listPrice})` : ''
  return `${info.currency ?? '?'} ${info.price}${list}`
}

function printSource(info: ProductInfo, query: Set<string>): void {
  console.log('\n══════════════════════════════════════════════════════')
  console.log(' PRODUCTO FUENTE (info identificable extraída)')
  console.log('══════════════════════════════════════════════════════')
  console.log(`  nombre : ${info.name}`)
  console.log(`  marca  : ${info.brand ?? '—'}`)
  console.log(`  sku    : ${info.sku ?? '—'}  (interno de la tienda)`)
  console.log(`  gtin   : ${info.gtin ?? '— (no expuesto)'}`)
  console.log(`  precio : ${fmtPrice(info)}`)
  console.log(`  fuente : ${info.source}`)
  console.log(`  tokens : ${[...query].join(' ')}`)
}

async function main(): Promise<void> {
  const { sourceUrl, maxSitemaps } = parseArgs()

  console.error(`\nExtrayendo producto fuente...\n  ${sourceUrl}`)
  const sourceHtml = await politeFetch(sourceUrl)
  const source = extractProduct(sourceHtml, sourceUrl)
  if (!source.name) {
    console.error('No se pudo extraer el nombre del producto fuente. Abortando.')
    process.exit(1)
  }

  // Query = tokens del nombre + la marca (la marca ancla el match).
  const query = tokenize(`${source.brand ?? ''} ${source.name}`)
  printSource(source, query)

  const report: Record<string, unknown> = { source, matches: {} }
  const sourceStore = storeSlugFromUrl(sourceUrl)

  // Destinos = todas las tiendas excepto la origen (el SKU interno no cruza).
  const destinations = STORES.filter((s) => s.slug !== sourceStore)

  for (const store of destinations) {
    console.error(`\nBuscando en ${store.name}...`)
    let candidates = await findInStore(store, query, maxSitemaps)
    candidates = applyEanBoost(candidates, source.gtin)
    console.log(`\n── ${store.name} ${'─'.repeat(40 - store.name.length)}`)
    if (candidates.length === 0) {
      console.log('  (sin candidatos por coincidencia de tokens)')
    }
    candidates.slice(0, 3).forEach((c, i) => {
      const score = c.nameScore ?? 0
      const eanHit = source.gtin && c.info?.gtin === source.gtin
      const flag = i === 0
        ? (score >= CONFIDENT_SCORE || eanHit ? '✓ match ' : '? revisar')
        : '        '
      const via = eanHit ? ' [EAN]' : ''
      console.log(`  ${flag} score=${score.toFixed(2)}${via}  ${fmtPrice(c.info)}`)
      console.log(`     ${c.info?.name ?? slugFromUrl(c.url)}`)
      console.log(`     sku=${c.info?.sku ?? '—'} gtin=${c.info?.gtin ?? '—'} stock=${c.info?.availability ?? '—'}`)
      console.log(`     ${c.url}`)
    })
    ;(report.matches as Record<string, unknown>)[store.slug] = candidates.map((c) => ({
      url: c.url,
      score: c.nameScore,
      eanMatch: !!(source.gtin && c.info?.gtin === source.gtin),
      info: c.info,
    }))
  }

  await writeFile('./poc-report.json', JSON.stringify(report, null, 2))
  console.log('\nReporte completo escrito en ./poc-report.json')
}

if (import.meta.main) {
  await main()
}
