// Helpers compartidos por Edge Functions (Deno). Runtime-agnostico donde aplica.

import type { RawCapture, Store } from '../../../packages/core/src/index.ts'
import type { ScrapeContext } from '../../../packages/scrapers/src/types.ts'

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const DEFAULT_UA =
  'PreciosGT-Bot/0.1 (+https://github.com/chofito/precios-gt; contacto@example.com)'

export const MIN_DELAY_MS = 2500
export const STALE_DAYS = 7
export const CONFIDENT_SCORE = 0.85
export const MIN_SLUG_SCORE = 0.34
export const TOP_CANDIDATES_CONFIRM = 5

export type StoreKey = 'max' | 'kemik' | 'pacifiko' | 'curacao'

export const ALL_STORE_KEYS: StoreKey[] = ['max', 'kemik', 'pacifiko', 'curacao']

/** Shape estable para la UI (contrato docs/EDGE_FUNCTIONS.md). */
export interface ProductDto {
  store: StoreKey
  url: string
  rawName: string
  price: number
  listPrice: number | null
  currency: string
  stockStatus: string
  storeSku: string
  eanGtin: string | null
  capturedAt: string
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  return null
}

export function storeKeyFromUrl(url: string): StoreKey | null {
  try {
    const host = new URL(url).hostname
    if (host.endsWith('max.com.gt')) return 'max'
    if (host.endsWith('kemik.gt')) return 'kemik'
    if (host.endsWith('pacifiko.com')) return 'pacifiko'
    if (host.endsWith('lacuracaonline.com')) return 'curacao'
  } catch {
    /* ignore */
  }
  return null
}

export function stubStore(key: StoreKey): Store {
  return {
    id: `edge-${key}`,
    name: key,
    baseUrl: '',
    platform: 'unknown',
    active: true,
    createdAt: new Date().toISOString(),
  }
}

export function makeScrapeContext(key: StoreKey): ScrapeContext {
  return {
    store: stubStore(key),
    userAgent: Deno.env.get('SCRAPER_USER_AGENT') ?? DEFAULT_UA,
    minDelayMs: Number(Deno.env.get('SCRAPER_MIN_DELAY_MS') ?? String(MIN_DELAY_MS)),
    fetch: globalThis.fetch,
  }
}

export function captureToDto(store: StoreKey, capture: RawCapture): ProductDto {
  return {
    store,
    url: capture.url,
    rawName: capture.rawName,
    price: capture.price,
    listPrice: capture.listPrice,
    currency: capture.currency,
    stockStatus: capture.stockStatus,
    storeSku: capture.storeSku,
    eanGtin: capture.eanGtin,
    capturedAt: capture.capturedAt,
  }
}
