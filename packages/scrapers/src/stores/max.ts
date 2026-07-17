// Scraper de MAX (max.com.gt) — Next.js headless sobre Magento, tras
// Cloudflare + CloudFront (docs/SCRAPING.md §4). El JSON-LD de MAX es parcial
// (sin availability ni listPrice), pero el `__NEXT_DATA__` del SSR trae el
// producto completo: sku, titulo, marca, eanCode (EAN-13!), salableQuantity y
// cachedPrices (salesPrice + regularPrice). Se parsea eso como fuente primaria
// y JSON-LD como fallback. Maxima cortesia: es la tienda con mayor riesgo de
// bloqueo — fallar ruidosamente ante 403/503, jamas evadir un challenge.

import { parseProductFromHtml, type RawCapture } from '@pgt/core'
import { politeGet } from '../http.ts'
import type { FetchOneInput, Scraper, ScrapeContext, ScrapeResult } from '../types.ts'
import { buildCapture, discoverProductUrls, parsePrice, runOverUrls } from '../util.ts'

const BASE = 'https://www.max.com.gt'
const SITEMAP_INDEX = `${BASE}/sitemap.xml`

interface MaxNextProduct {
  sku?: string
  title?: string
  canonicalUrl?: string
  eanCode?: string
  salableQuantity?: number
  brand?: { title?: string }
  cachedPrices?: {
    salesPrice?: { currency?: string; value?: number }
    regularPrice?: { currency?: string; value?: number }
  }
}

function nextDataProduct(html: string): MaxNextProduct | null {
  const m = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(html)
  if (!m?.[1]) return null
  try {
    const data = JSON.parse(m[1]) as {
      props?: { pageProps?: { product?: MaxNextProduct } }
    }
    return data.props?.pageProps?.product ?? null
  } catch {
    return null
  }
}

function captureFromHtml(html: string, url: string): RawCapture | null {
  const p = nextDataProduct(html)
  if (p?.sku && p.cachedPrices?.salesPrice?.value !== undefined) {
    const price = p.cachedPrices.salesPrice.value
    const regular = p.cachedPrices.regularPrice?.value ?? null
    return buildCapture({
      storeSku: p.sku,
      url: p.canonicalUrl ? `${BASE}${p.canonicalUrl}` : url,
      rawName: p.title ?? null,
      price,
      listPrice: regular !== null && regular > price ? regular : null,
      currency: p.cachedPrices.salesPrice.currency ?? 'GTQ',
      // MAX no publica availability; salableQuantity > 0 es la senal de stock.
      stockStatus:
        typeof p.salableQuantity === 'number'
          ? p.salableQuantity > 0
            ? 'in_stock'
            : 'out_of_stock'
          : 'unknown',
      eanGtin: p.eanCode || null,
    })
  }

  // Fallback: JSON-LD parcial (precio + sku, sin stock ni listPrice).
  const parsed = parseProductFromHtml(html)
  if (!parsed || parsed.price === null) return null
  return buildCapture({
    storeSku: parsed.sku,
    url,
    rawName: parsed.name,
    price: parsePrice(String(parsed.price)),
    listPrice: parsed.listPrice,
    currency: parsed.currency ?? 'GTQ',
    stockStatus: parsed.stockStatus,
    eanGtin: parsed.eanGtin,
  })
}

// Paginas de producto de MAX: slug en raiz terminado en el codigo de SKU;
// se excluyen rutas de navegacion prohibidas/inutiles (robots.txt: /marcas/).
function isProductUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.hostname !== 'www.max.com.gt') return false
    const path = u.pathname
    if (path === '/' || path.split('/').filter(Boolean).length !== 1) return false
    return !/^\/(marcas|categoria|search|tiendas|blog)/.test(path)
  } catch {
    return false
  }
}

export const maxScraper: Scraper = {
  key: 'max',

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
}
