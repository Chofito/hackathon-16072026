// Scraper de Pacifiko (pacifiko.com) — OpenCart tras CloudFront, la tienda
// mas facil (docs/SCRAPING.md §4): JSON-LD Product limpio con offers.price,
// priceCurrency GTQ, availability y brand. El identificador es `sku` (numerico)
// o `mpn`. No publica GTIN. Las URLs de producto llevan `&pid=<hash>` dentro
// del path — conservar la URL completa tal cual.

import { parseProductFromHtml, type RawCapture } from '@pgt/core'
import { politeGet } from '../http.ts'
import type { FetchOneInput, Scraper, ScrapeContext, ScrapeResult } from '../types.ts'
import { buildCapture, discoverProductUrls, runOverUrls } from '../util.ts'

const BASE = 'https://www.pacifiko.com'
const SITEMAP_INDEX = `${BASE}/sitemap.xml`

function captureFromHtml(html: string, url: string): RawCapture | null {
  const parsed = parseProductFromHtml(html)
  if (!parsed || parsed.price === null) return null
  return buildCapture({
    storeSku: parsed.sku,
    // El JSON-LD trae offers.url canonica (sin ?ref= ni query_id de tracking).
    url: parsed.url ?? url,
    rawName: parsed.name,
    price: parsed.price,
    listPrice: parsed.listPrice,
    currency: parsed.currency ?? 'GTQ',
    stockStatus: parsed.stockStatus,
    eanGtin: parsed.eanGtin,
  })
}

// Productos: /compras-en-linea/<slug>&pid=<hash>; el sitemap los lista en
// ~98 archivos pids-N.xml.
function isProductUrl(url: string): boolean {
  return url.includes('/compras-en-linea/')
}

/** URLs de producto desde HTML de `index.php?route=product/search`. */
export function parsePacifikoSearchProductUrls(html: string): string[] {
  const hrefs = [
    ...html.matchAll(/href="(\/compras-en-linea\/[^"]+)"/gi),
    ...html.matchAll(/href="(https:\/\/www\.pacifiko\.com\/compras-en-linea\/[^"]+)"/gi),
  ]
  const out: string[] = []
  const seen = new Set<string>()
  for (const m of hrefs) {
    const raw = m[1]
    if (!raw) continue
    const abs = raw.startsWith('http') ? raw : `${BASE}${raw}`
    if (seen.has(abs)) continue
    seen.add(abs)
    out.push(abs)
  }
  return out
}

export const pacifikoScraper: Scraper = {
  key: 'pacifiko',

  listProductUrls(ctx: ScrapeContext): Promise<string[]> {
    return discoverProductUrls(SITEMAP_INDEX, ctx, isProductUrl)
  },

  async scrape(ctx: ScrapeContext): Promise<ScrapeResult> {
    const urls = await this.listProductUrls(ctx)
    return runOverUrls(urls, ctx, (url, c) => this.fetchOne({ url }, c))
  },

  async fetchOne(input: FetchOneInput, ctx: ScrapeContext): Promise<RawCapture | null> {
    // Pacifiko no tiene URL derivable del SKU: se requiere URL completa.
    if (!input.url) return null
    const html = await politeGet(input.url, ctx)
    return captureFromHtml(html, input.url)
  },

  async search(query: string, ctx: ScrapeContext): Promise<string[]> {
    const q = query.trim()
    if (!q) return []
    const url = `${BASE}/index.php?route=product/search&search=${encodeURIComponent(q)}`
    const html = await politeGet(url, ctx)
    return parsePacifikoSearchProductUrls(html)
  },
}
