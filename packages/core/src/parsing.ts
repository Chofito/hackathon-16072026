// Parsing portable de JSON-LD (schema.org/Product) y sitemap.xml.
// Sin DOM ni dependencias externas -> corre igual en Bun (collector) y Deno (edge fn).
// Tactica primaria de coleccion segun docs/SCRAPING.md: JSON-LD antes que CSS selectors.

import type { StockStatus } from './types.ts'

/** Extrae y parsea todos los bloques <script type="application/ld+json">. */
export function extractJsonLd(html: string): unknown[] {
  const blocks: unknown[] = []
  const regex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null
  while ((match = regex.exec(html)) !== null) {
    const raw = match[1]?.trim()
    if (!raw) continue
    try {
      blocks.push(JSON.parse(raw))
    } catch {
      // JSON-LD invalido: se ignora en vez de romper el ciclo.
    }
  }
  return blocks
}

interface JsonLdNode {
  '@type'?: string | string[]
  '@graph'?: unknown[]
  [key: string]: unknown
}

function typeMatchesProduct(type: unknown): boolean {
  if (typeof type === 'string') return type.toLowerCase().includes('product')
  if (Array.isArray(type)) return type.some((t) => typeMatchesProduct(t))
  return false
}

/** Encuentra el nodo schema.org/Product entre bloques JSON-LD (incluye @graph). */
export function findProductNode(blocks: readonly unknown[]): JsonLdNode | null {
  const queue: unknown[] = [...blocks]
  while (queue.length > 0) {
    const node = queue.shift()
    if (Array.isArray(node)) {
      queue.push(...node)
      continue
    }
    if (node && typeof node === 'object') {
      const obj = node as JsonLdNode
      if (typeMatchesProduct(obj['@type'])) return obj
      if (Array.isArray(obj['@graph'])) queue.push(...obj['@graph'])
    }
  }
  return null
}

export interface ParsedProduct {
  name: string | null
  sku: string | null
  eanGtin: string | null
  brand: string | null
  price: number | null
  /** Precio de lista/tachado, si el JSON-LD lo expone (offers.highPrice o price raiz). */
  listPrice: number | null
  currency: string | null
  stockStatus: StockStatus
  /** URL canonica declarada por la tienda (offers.url / node.url), si existe. */
  url: string | null
}

function extractBrand(node: JsonLdNode): string | null {
  const brand = node.brand
  if (typeof brand === 'string') return toStr(brand)
  if (brand && typeof brand === 'object') {
    return toStr((brand as Record<string, unknown>).name)
  }
  return null
}

function firstOffer(node: JsonLdNode): Record<string, unknown> | null {
  const offers = node.offers
  if (!offers) return null
  if (Array.isArray(offers)) {
    return (offers[0] as Record<string, unknown>) ?? null
  }
  if (typeof offers === 'object') return offers as Record<string, unknown>
  return null
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.]/g, '')
    const n = Number.parseFloat(cleaned)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function toStr(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  if (typeof value === 'number') return String(value)
  return null
}

function mapAvailability(value: unknown): StockStatus {
  const s = toStr(value)?.toLowerCase() ?? ''
  if (s.includes('instock') || s.includes('in_stock') || s.includes('limitedavailability')) {
    return 'in_stock'
  }
  if (s.includes('outofstock') || s.includes('soldout') || s.includes('discontinued')) {
    return 'out_of_stock'
  }
  return 'unknown'
}

/** Extrae los campos relevantes de un nodo Product JSON-LD. */
export function parseProductJsonLd(node: JsonLdNode): ParsedProduct {
  const offer = firstOffer(node)
  const price = offer ? toNumber(offer.price ?? offer.lowPrice) : null

  // listPrice: offers.highPrice, o el `price` de nivel raiz cuando es mayor que
  // el de venta (patron de Curacao: root price = precio de lista tachado).
  let listPrice: number | null = offer ? toNumber(offer.highPrice) : null
  if (listPrice === null && price !== null) {
    const rootPrice = toNumber(node.price)
    if (rootPrice !== null && rootPrice > price) listPrice = rootPrice
  }
  if (listPrice !== null && price !== null && listPrice <= price) listPrice = null

  return {
    name: toStr(node.name),
    sku: toStr(node.sku) ?? toStr(node.mpn),
    eanGtin:
      toStr(node.gtin13) ??
      toStr(node.gtin12) ??
      toStr(node.gtin) ??
      toStr(node.gtin14) ??
      toStr(node.ean) ??
      null,
    brand: extractBrand(node),
    price,
    listPrice,
    currency: offer ? toStr(offer.priceCurrency) : null,
    stockStatus: offer ? mapAvailability(offer.availability) : 'unknown',
    url: (offer ? toStr(offer.url) : null) ?? toStr(node.url) ?? toStr(node['@id']),
  }
}

/** Conveniencia: html -> ParsedProduct (o null si no hay nodo Product). */
export function parseProductFromHtml(html: string): ParsedProduct | null {
  const node = findProductNode(extractJsonLd(html))
  return node ? parseProductJsonLd(node) : null
}

/** Extrae las URLs (<loc>) de un sitemap.xml — descubre el universo de productos. */
export function parseSitemapUrls(xml: string): string[] {
  const urls: string[] = []
  const regex = /<loc>\s*([\s\S]*?)\s*<\/loc>/gi
  let match: RegExpExecArray | null
  while ((match = regex.exec(xml)) !== null) {
    const url = match[1]?.trim()
    if (url) urls.push(url)
  }
  return urls
}
