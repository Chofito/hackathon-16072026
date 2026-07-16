// Utilidades compartidas por los modulos de tienda. Runtime-agnostico:
// solo APIs web estandar (regex, JSON, URL) -> corre igual en Bun y Deno.

import type { RawCapture } from '@pgt/core'
import { politeGet } from './http.ts'
import type { ScrapeContext, ScrapeFailure } from './types.ts'

/** Momento del fetch en ISO-8601 (trazabilidad de la captura). */
export const nowIso = (): string => new Date().toISOString()

/** Decodifica las entidades HTML mas comunes en nombres/atributos extraidos. */
export function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Convierte un texto de precio ("Q 3,650.00", "4024.00") en numero. */
export function parsePrice(s: string | null | undefined): number | null {
  if (!s) return null
  const n = Number.parseFloat(String(s).replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? n : null
}

/**
 * Construye un `RawCapture` valido a partir de los campos parseados por el
 * modulo de tienda, aplicando defaults y la regla del contrato: identidad y
 * `price` son obligatorios (si faltan, lanza en vez de emitir una captura a medias).
 */
export function buildCapture(input: {
  storeSku: string | null
  url: string
  rawName: string | null
  price: number | null
  listPrice?: number | null
  conditionalPrice?: number | null
  conditionalPriceNote?: string | null
  currency: string | null
  stockStatus: RawCapture['stockStatus']
  eanGtin?: string | null
}): RawCapture {
  if (!input.storeSku) throw new Error(`captura sin storeSku: ${input.url}`)
  if (!input.rawName) throw new Error(`captura sin rawName: ${input.url}`)
  if (input.price === null || !Number.isFinite(input.price) || input.price <= 0) {
    throw new Error(`captura con precio invalido (${input.price}): ${input.url}`)
  }
  return {
    storeSku: input.storeSku,
    url: input.url,
    rawName: decodeEntities(input.rawName),
    price: input.price,
    listPrice: input.listPrice ?? null,
    conditionalPrice: input.conditionalPrice ?? null,
    conditionalPriceNote: input.conditionalPriceNote ?? null,
    currency: input.currency ?? 'GTQ',
    stockStatus: input.stockStatus,
    eanGtin: input.eanGtin ?? null,
    capturedAt: nowIso(),
  }
}

/**
 * Runner comun del modo batch: recibe las URLs de producto ya descubiertas
 * (via sitemap) y aplica `fetchOne` a cada una, acumulando capturas y fallos.
 * Cortesia garantizada por `politeGet` dentro de cada `fetchOne`.
 */
export async function runOverUrls(
  urls: readonly string[],
  ctx: ScrapeContext,
  fetchOne: (url: string, ctx: ScrapeContext) => Promise<RawCapture | null>,
): Promise<{ captures: RawCapture[]; failures: ScrapeFailure[] }> {
  const captures: RawCapture[] = []
  const failures: ScrapeFailure[] = []
  for (const url of urls) {
    try {
      const capture = await fetchOne(url, ctx)
      if (capture) captures.push(capture)
      else failures.push({ url, reason: 'sin datos de producto (markup inesperado)' })
    } catch (err) {
      failures.push({ url, reason: err instanceof Error ? err.message : String(err) })
    }
  }
  return { captures, failures }
}

/** Descarga y aplana un sitemap index -> lista de URLs hijas (<loc>). */
export async function fetchSitemapLocs(url: string, ctx: ScrapeContext): Promise<string[]> {
  const xml = await politeGet(url, ctx)
  const out: string[] = []
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    if (m[1]) out.push(m[1].replace(/&amp;/g, '&'))
  }
  return out
}

/**
 * Descubre URLs de producto desde un sitemap index. Baja el index, expande los
 * sub-sitemaps (.xml) un nivel, y devuelve solo las URLs que pasan `isProduct`.
 * Aisla al colector del layout de sitemap especifico de cada tienda.
 */
export async function discoverProductUrls(
  indexUrl: string,
  ctx: ScrapeContext,
  isProduct: (url: string) => boolean,
): Promise<string[]> {
  const top = await fetchSitemapLocs(indexUrl, ctx)
  const subSitemaps = top.filter((u) => /\.xml(\?|$)/i.test(u))
  const products = new Set<string>(top.filter(isProduct))
  for (const sm of subSitemaps) {
    for (const loc of await fetchSitemapLocs(sm, ctx)) {
      if (isProduct(loc)) products.add(loc)
    }
  }
  return [...products]
}
