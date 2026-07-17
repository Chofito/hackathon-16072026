// Scraper de Kemik (kemik.gt) — Next.js App Router, SIN JSON-LD
// (docs/SCRAPING.md §4). El dato server-side vive en:
//   - microdata schema.org/Offer: itemProp price/priceCurrency/sku/availability
//   - meta OG/product:* : brand, price, availability (instock/outofstock)
//   - <h1> : nombre completo del producto (og:title viene truncado)
//   - precio de lista: <span class="... line-through">Q 3,650</span>
// robots.txt banea decenas de bots por nombre y hay contador de requests
// anonimos (ventana 300 s): UA identificable, volumen bajo, maxima cortesia.

import type { RawCapture } from '@pgt/core'
import { politeGet } from '../http.ts'
import type { FetchOneInput, Scraper, ScrapeContext, ScrapeResult } from '../types.ts'
import { buildCapture, decodeEntities, parsePrice, runOverUrls } from '../util.ts'

const BASE = 'https://www.kemik.gt'
// El sitemap de producto esta paginado: sitemap-product.xml?page=1..N (~8 paginas).
const PRODUCT_SITEMAP_PAGES = 8

function metaContent(html: string, nameOrProp: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:name|property|itemProp)="${nameOrProp}"[^>]+content="([^"]*)"`,
    'i',
  )
  const m = re.exec(html)
  return m?.[1] !== undefined ? decodeEntities(m[1]) : null
}

function linkItemProp(html: string, prop: string): string | null {
  const re = new RegExp(`<link[^>]+itemProp="${prop}"[^>]+href="([^"]*)"`, 'i')
  return re.exec(html)?.[1] ?? null
}

function h1Text(html: string): string | null {
  const m = /<h1[^>]*>([^<]+)/.exec(html)
  return m?.[1] ? decodeEntities(m[1]) : null
}

function listPriceFromHtml(html: string): number | null {
  // El precio tachado "antes" es el unico texto con line-through en el PDP.
  const m = /line-through">\s*Q\s*([\d.,]+)/.exec(html)
  return m?.[1] ? parsePrice(m[1]) : null
}

function mapAvailability(v: string | null): RawCapture['stockStatus'] {
  const s = (v ?? '').toLowerCase()
  if (s.includes('instock') || s.includes('in_stock')) return 'in_stock'
  if (s.includes('outofstock') || s.includes('out_of_stock')) return 'out_of_stock'
  return 'unknown'
}

function captureFromHtml(html: string, url: string): RawCapture | null {
  const price =
    parsePrice(metaContent(html, 'price')) ??
    parsePrice(metaContent(html, 'product:price:amount'))
  if (price === null) return null

  const brand = metaContent(html, 'product:brand')
  const h1 = h1Text(html)
  // El h1 omite la marca ("Galaxy A56...") — se antepone para el raw_name.
  const rawName = h1 && brand && !h1.toLowerCase().startsWith(brand.toLowerCase())
    ? `${brand} ${h1}`
    : h1

  const listPrice = listPriceFromHtml(html)
  return buildCapture({
    storeSku: metaContent(html, 'sku'),
    url,
    rawName,
    price,
    listPrice: listPrice !== null && listPrice > price ? listPrice : null,
    currency:
      metaContent(html, 'priceCurrency') ??
      metaContent(html, 'product:price:currency') ??
      'GTQ',
    stockStatus: mapAvailability(
      linkItemProp(html, 'availability') ?? metaContent(html, 'product:availability'),
    ),
    eanGtin: null, // Kemik no publica GTIN en ningun lado (recon 2026-07-16).
  })
}

export const kemikScraper: Scraper = {
  key: 'kemik',

  async listProductUrls(ctx: ScrapeContext): Promise<string[]> {
    // Sitemap paginado (~60-78k URLs): aqui va el universo completo; el
    // colector filtra despues contra los SKUs trackeados antes de fetchear.
    const urls = new Set<string>()
    for (let page = 1; page <= PRODUCT_SITEMAP_PAGES; page++) {
      const xml = await politeGet(`${BASE}/sitemap-product.xml?page=${page}`, ctx)
      const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi
      let m: RegExpExecArray | null
      while ((m = re.exec(xml)) !== null) {
        if (m[1]) urls.add(m[1].replace(/&amp;/g, '&'))
      }
    }
    return [...urls]
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

  // MVP: Kemik search es CSR — fetch plano no ve resultados.
  search(_query: string, _ctx: ScrapeContext): Promise<string[]> {
    return Promise.resolve([])
  },
}
