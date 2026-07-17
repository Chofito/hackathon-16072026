// Contrato de las Edge Functions on-demand (docs/EDGE_FUNCTIONS.md).

import type { SupabaseClient } from '@supabase/supabase-js'

export interface ProductDto {
  store: string
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

export interface MatchItem {
  url: string
  score: number
  confident: boolean
  eanMatch: boolean
  product: ProductDto
}

export interface FindMatchesResponse {
  source: ProductDto
  matches: Record<string, MatchItem[]>
}

export interface EdgeErrorBody {
  error: string
  stores?: string[]
}

const STORE_LABELS: Record<string, string> = {
  max: 'MAX',
  kemik: 'Kemik',
  pacifiko: 'Pacifiko',
  curacao: 'Curacao',
}

export function storeKeyLabel(key: string): string {
  return STORE_LABELS[key] ?? key
}

export function isEdgeError(data: unknown): data is EdgeErrorBody {
  return (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    typeof (data as EdgeErrorBody).error === 'string'
  )
}

export function isProductDto(data: unknown): data is ProductDto {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as ProductDto).price === 'number' &&
    typeof (data as ProductDto).rawName === 'string'
  )
}

export function isFindMatchesResponse(data: unknown): data is FindMatchesResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    isProductDto((data as FindMatchesResponse).source) &&
    typeof (data as FindMatchesResponse).matches === 'object'
  )
}

/**
 * Invoca una Edge Function y devuelve el body ya parseado, incluso cuando la
 * respuesta es 4xx/5xx. `functions.invoke` deja el body de error dentro de
 * `error.context` (un Response) en vez de `data`, así que lo leemos a mano para
 * poder distinguir `sitemap_cache_stale` (503) de un fallo de red real.
 */
export async function invokeEdge<T = unknown>(
  supabase: SupabaseClient,
  name: string,
  body: Record<string, unknown>,
): Promise<{ data: T | EdgeErrorBody | null; networkError: boolean }> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (!error) return { data: data as T, networkError: false }

  const context = (error as { context?: unknown }).context
  if (context instanceof Response) {
    try {
      return { data: (await context.json()) as EdgeErrorBody, networkError: false }
    } catch {
      return { data: null, networkError: true }
    }
  }
  return { data: null, networkError: true }
}
