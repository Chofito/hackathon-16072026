// Scraper de Curacao (lacuracaonline.com/guatemala) — Magento 2 multistore
// tras Fastly, la mejor fuente de datos (docs/SCRAPING.md §4):
//   - JSON-LD Product con offers.price/availability + `price` raiz = precio de
//     lista tachado (lo resuelve parseProductJsonLd -> listPrice).
//   - El JSON-LD NO trae sku ni gtin: el SKU vive en `data-product-sku` y el
//     GTIN (EAN-13, unica tienda local que lo publica) en la tabla de specs
//     (`data-th="GTIN"`). Se capturan del HTML aparte.
// robots.txt define Crawl-delay 1-5 para bots nombrados: usar >=5 s de pausa.

import { parseProductFromHtml, type RawCapture } from '@pgt/core'
import { politeGet } from '../http.ts'
import type { FetchOneInput, Scraper, ScrapeContext, ScrapeResult } from '../types.ts'
import { buildCapture, discoverProductUrls, runOverUrls } from '../util.ts'

const BASE = 'https://www.lacuracaonline.com/guatemala'
// Sitemap dedicado del storefront GT (~2,213 URLs, lastmod diario).
const SITEMAP_INDEX = 'https://www.lacuracaonline.com/media/sitemap/sitemap_lco_gt_index.xml'

function skuFromHtml(html: string): string | null {
  return /data-product-sku="([^"]+)"/.exec(html)?.[1] ?? null
}

function gtinFromHtml(html: string): string | null {
  const table = /data-th=['"]GTIN['"][^>]*>\s*([0-9]{8,14})/i.exec(html)?.[1]
  if (table) return table
  return /itemprop=['"]gtin1?3?['"][^>]*content=['"]([0-9]{8,14})['"]/i.exec(html)?.[1] ?? null
}

function captureFromHtml(html: string, url: string): RawCapture | null {
  const parsed = parseProductFromHtml(html)
  if (!parsed || parsed.price === null) return null
  return buildCapture({
    storeSku: parsed.sku ?? skuFromHtml(html),
    url,
    rawName: parsed.name,
    price: parsed.price,
    listPrice: parsed.listPrice,
    currency: parsed.currency ?? 'GTQ',
    stockStatus: parsed.stockStatus,
    eanGtin: parsed.eanGtin ?? gtinFromHtml(html),
  })
}

// Productos GT: /guatemala/<slug>/p (las categorias no llevan el sufijo /p).
function isProductUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.pathname.startsWith('/guatemala/') && u.pathname.endsWith('/p')
  } catch {
    return false
  }
}

/** URLs de producto desde HTML de `/guatemala/search/<query>`. */
export function parseCuracaoSearchProductUrls(html: string): string[] {
  const hrefs = [
    ...html.matchAll(/href="(https:\/\/www\.lacuracaonline\.com\/guatemala\/[^"]+\/p)"/gi),
    ...html.matchAll(/href="(\/guatemala\/[^"]+\/p)"/gi),
  ]
  const out: string[] = []
  const seen = new Set<string>()
  for (const m of hrefs) {
    const raw = m[1]
    if (!raw) continue
    if (raw.includes('/guatemala/c/p')) continue
    const abs = raw.startsWith('http') ? raw : `https://www.lacuracaonline.com${raw}`
    if (seen.has(abs)) continue
    seen.add(abs)
    out.push(abs)
  }
  return out
}

export const curacaoScraper: Scraper = {
  key: 'curacao',

  listProductUrls(ctx: ScrapeContext): Promise<string[]> {
    return discoverProductUrls(SITEMAP_INDEX, ctx, isProductUrl)
  },

  async scrape(ctx: ScrapeContext): Promise<ScrapeResult> {
    const urls = await this.listProductUrls(ctx)
    return runOverUrls(urls, ctx, (url, c) => this.fetchOne({ url }, c))
  },

  async fetchOne(input: FetchOneInput, ctx: ScrapeContext): Promise<RawCapture | null> {
    const url = input.url ?? (input.sku ? `${BASE}/${input.sku}` : null)
    if (!url) return null
    const html = await politeGet(url, ctx)
    return captureFromHtml(html, url)
  },

  async search(query: string, ctx: ScrapeContext): Promise<string[]> {
    const q = query.trim()
    if (!q) return []
    // Curacao usa path `/guatemala/search/<slug>` (espacios → -).
    const slug = encodeURIComponent(q.replace(/\s+/g, '-').toLowerCase())
    const url = `https://www.lacuracaonline.com/guatemala/search/${slug}`
    const html = await politeGet(url, ctx)
    return parseCuracaoSearchProductUrls(html)
  },
}
