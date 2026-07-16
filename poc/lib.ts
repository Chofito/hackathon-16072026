// Utilidades del POC de matching cross-store. Sin dependencias externas.
// Cross-runtime: usa APIs `node:` + web estándar (`fetch`), así corre igual con
// Bun (`bun`) y con Deno (`deno`, el runtime destino de las Edge Functions).
// La extracción prioriza JSON-LD > microdata > OpenGraph, según docs/SCRAPING.md.

import { mkdir, readFile, writeFile } from 'node:fs/promises'

const UA =
  'PreciosGT-POC/0.1 (+https://github.com/preciosgt; contacto@preciosgt.example)'

const CACHE_DIR = './.cache'

// Cortesía: pausa entre requests. Páginas de producto van lentas; los sitemaps
// (archivos de infraestructura) toleran una pausa más corta.
export const DELAY_PRODUCT_MS = 2500
export const DELAY_SITEMAP_MS = 500

export interface ProductInfo {
  url: string
  name: string | null
  brand: string | null
  sku: string | null
  gtin: string | null
  price: number | null
  listPrice: number | null
  currency: string | null
  availability: string | null
  source: 'jsonld' | 'microdata' | 'og' | 'none'
}

export interface Candidate {
  url: string
  slugScore: number
  info?: ProductInfo
  nameScore?: number
}

// --- Fetch cortés con cache en disco -------------------------------------

function cacheKey(url: string): string {
  let h = 5381
  for (let i = 0; i < url.length; i++) h = ((h << 5) + h + url.charCodeAt(i)) | 0
  const slug = url.replace(/[^a-z0-9]+/gi, '-').slice(0, 60)
  return `${slug}-${(h >>> 0).toString(16)}.txt`
}

async function readCache(key: string): Promise<string | null> {
  try {
    return await readFile(`${CACHE_DIR}/${key}`, 'utf8')
  } catch {
    return null
  }
}

async function writeCache(key: string, body: string): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true })
  await writeFile(`${CACHE_DIR}/${key}`, body)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Devuelve el HTML/XML de una URL, cacheado. Solo golpea la red en cache miss,
// y solo entonces aplica la pausa de cortesía.
export async function politeFetch(
  url: string,
  delayMs = DELAY_PRODUCT_MS,
): Promise<string> {
  const key = cacheKey(url)
  const cached = await readCache(key)
  if (cached !== null) return cached

  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,application/xml' },
    redirect: 'follow',
  })
  if (!res.ok) {
    // Fallar ruidosamente: nunca intentar evadir un challenge/WAF.
    throw new Error(`HTTP ${res.status} en ${url}`)
  }
  const body = await res.text()
  await writeCache(key, body)
  await sleep(delayMs)
  return body
}

// --- Normalización y scoring de tokens -----------------------------------

const STOPWORDS = new Set([
  'de', 'la', 'el', 'los', 'las', 'un', 'una', 'con', 'para', 'por', 'y', 'o', 'a', 'en',
  'del', 'al', 'su', 'sus', 'lo', 'the', 'of', 'for', 'and',
  // relleno de ecommerce que no identifica el producto.
  // OJO: NO se filtran palabras de TIPO (consola, juego, estuche, control, cable…):
  // son justo la señal que distingue una consola de su accesorio.
  'descargable', 'incluye', 'nuevo', 'nueva', 'color', 'version', 'edicion', 'edition',
  'caja', 'pulgadas', 'almacenamiento', 'pantalla', 'compras', 'linea', 'producto',
])

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// Decodifica las entidades HTML más comunes en los nombres extraídos.
export function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim()
}

// Convierte texto libre (o un slug de URL) en un set de tokens identificables.
export function tokenize(text: string): Set<string> {
  const clean = stripAccents(text.toLowerCase()).replace(/[^a-z0-9]+/g, ' ')
  // Se conservan dígitos sueltos ("2" de "Switch 2"): distinguen variantes.
  const tokens = clean.split(' ').filter(
    (t) => (t.length > 1 || /^\d$/.test(t)) && !STOPWORDS.has(t),
  )
  return new Set(tokens)
}

// Score = fracción de tokens de la query presentes en el candidato (0..1),
// con un pequeño bonus por tokens numéricos coincidentes (ej. "2", "256"),
// que suelen ser los que distinguen variantes (Switch vs Switch 2).
export function scoreTokens(query: Set<string>, candidate: Set<string>): number {
  if (query.size === 0) return 0
  let matched = 0
  let numericBonus = 0
  for (const t of query) {
    if (candidate.has(t)) {
      matched++
      if (/^\d+$/.test(t)) numericBonus += 0.15
    }
  }
  return matched / query.size + numericBonus
}

// Toma el slug legible de una URL de producto (último segmento de path,
// descartando el `&pid=` de Pacifiko y querystrings).
export function slugFromUrl(url: string): string {
  try {
    const u = new URL(url)
    let path = decodeURIComponent(u.pathname)
    if (path.endsWith('/')) path = path.slice(0, -1)
    let seg = path.split('/').filter(Boolean).pop() ?? ''
    // Curacao termina en `/p`; el slug es el segmento anterior.
    if (seg === 'p') {
      const parts = path.split('/').filter(Boolean)
      seg = parts[parts.length - 2] ?? seg
    }
    // Pacifiko mete `&pid=...` dentro del slug.
    seg = seg.split('&')[0]
    return seg
  } catch {
    return url
  }
}

// --- Extracción de producto (JSON-LD > microdata > OG) --------------------

function findJsonLdProducts(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  const re = /<script[^>]*type=['"]application\/ld\+json['"][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    let parsed: unknown
    try {
      parsed = JSON.parse(m[1].trim())
    } catch {
      continue
    }
    const stack: unknown[] = Array.isArray(parsed) ? [...parsed] : [parsed]
    for (const node of stack) {
      if (node && typeof node === 'object') {
        const obj = node as Record<string, unknown>
        if (Array.isArray(obj['@graph'])) stack.push(...(obj['@graph'] as unknown[]))
        const type = obj['@type']
        const isProduct = type === 'Product' ||
          (Array.isArray(type) && (type as unknown[]).includes('Product'))
        if (isProduct) out.push(obj)
      }
    }
  }
  return out
}

function firstOffer(offers: unknown): Record<string, unknown> | null {
  if (!offers) return null
  const o = Array.isArray(offers) ? offers[0] : offers
  return o && typeof o === 'object' ? (o as Record<string, unknown>) : null
}

function num(v: unknown): number | null {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^0-9.]/g, ''))
    return Number.isFinite(n) ? n : null
  }
  return null
}

function attr(html: string, re: RegExp): string | null {
  const m = re.exec(html)
  return m ? m[1].trim() : null
}

function normAvailability(v: string | null): string | null {
  if (!v) return null
  const s = v.toLowerCase()
  if (s.includes('instock') || s.includes('in_stock')) return 'in_stock'
  if (s.includes('outofstock') || s.includes('out_of_stock')) return 'out_of_stock'
  return 'unknown'
}

// GTIN suele NO estar en el JSON-LD: Curacao lo pone en su tabla de specs.
function gtinFromHtml(html: string): string | null {
  const table = attr(html, /data-th=['"]GTIN['"][^>]*>\s*([0-9]{8,14})/i)
  if (table) return table
  const micro = attr(html, /itemprop=['"]gtin1?3?['"][^>]*content=['"]([0-9]{8,14})['"]/i)
  return micro
}

export function extractProduct(html: string, url: string): ProductInfo {
  const info: ProductInfo = {
    url,
    name: null,
    brand: null,
    sku: null,
    gtin: null,
    price: null,
    listPrice: null,
    currency: null,
    availability: null,
    source: 'none',
  }

  const products = findJsonLdProducts(html)
  if (products.length > 0) {
    const p = products[0]
    info.source = 'jsonld'
    info.name = (p['name'] as string) ?? null
    info.sku = (p['sku'] as string) ?? null
    info.gtin = (p['gtin13'] as string) ?? (p['gtin'] as string) ?? null
    const brand = p['brand']
    info.brand = typeof brand === 'string'
      ? brand
      : ((brand as Record<string, unknown>)?.['name'] as string) ?? null
    const offer = firstOffer(p['offers'])
    if (offer) {
      info.price = num(offer['price'])
      info.currency = (offer['priceCurrency'] as string) ?? null
      info.availability = normAvailability((offer['availability'] as string) ?? null)
    }
    // Curacao expone el precio de lista como `price` de nivel raíz.
    const rootPrice = num(p['price'])
    if (rootPrice !== null && info.price !== null && rootPrice > info.price) {
      info.listPrice = rootPrice
    }
  }

  // Fallback / complemento: microdata + OpenGraph (Kemik no tiene JSON-LD).
  if (info.price === null) {
    const mPrice = num(attr(html, /itemprop=['"]price['"][^>]*content=['"]([^'"]+)['"]/i)) ??
      num(attr(html, /property=['"]product:price:amount['"][^>]*content=['"]([^'"]+)['"]/i))
    if (mPrice !== null) {
      info.price = mPrice
      info.source = info.source === 'jsonld' ? 'jsonld' : 'microdata'
    }
  }
  if (info.currency === null) {
    info.currency = attr(html, /itemprop=['"]priceCurrency['"][^>]*content=['"]([^'"]+)['"]/i) ??
      attr(html, /property=['"]product:price:currency['"][^>]*content=['"]([^'"]+)['"]/i)
  }
  if (info.sku === null) {
    info.sku = attr(html, /itemprop=['"]sku['"][^>]*content=['"]([^'"]+)['"]/i) ??
      attr(html, /data-product-sku=['"]([^'"]+)['"]/i)
  }
  if (info.name === null) {
    info.name = attr(html, /itemprop=['"]name['"][^>]*content=['"]([^'"]+)['"]/i) ??
      attr(html, /property=['"]og:title['"][^>]*content=['"]([^'"]+)['"]/i)
  }
  if (info.availability === null) {
    info.availability = normAvailability(
      attr(html, /property=['"]product:availability['"][^>]*content=['"]([^'"]+)['"]/i),
    )
  }
  if (info.gtin === null) info.gtin = gtinFromHtml(html)
  if (info.name) info.name = decodeEntities(info.name)

  return info
}

// --- Sitemaps ------------------------------------------------------------

export function extractLocs(xml: string): string[] {
  const out: string[] = []
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) out.push(m[1].replace(/&amp;/g, '&'))
  return out
}
