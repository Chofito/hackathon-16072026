// Matching por capas (el moat tecnico). Regla de oro:
// un match incorrecto es peor que un match faltante. En duda, a la cola.
// Estrategia: EAN/GTIN exacto -> normalizacion marca+modelo -> revision manual.
// Logica pura (sin I/O) para reutilizarse en el collector (Bun) y la Edge Function (Deno).

import type { Product, RawCapture } from './types.ts'

const FILLER_WORDS = new Set([
  'de', 'la', 'el', 'los', 'las', 'con', 'para', 'y', 'the', 'a', 'an',
  'nuevo', 'nueva', 'new', 'original',
])

/** Normaliza un nombre crudo: minusculas, sin acentos, sin puntuacion ni relleno. */
export function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0 && !FILLER_WORDS.has(word))
    .join(' ')
    .trim()
}

export type MatchMethod = 'ean' | 'brand_model' | 'none'

export interface MatchResult {
  productId: string | null
  method: MatchMethod
  /** 0..1 — usar un umbral para decidir si va a la cola de revision. */
  confidence: number
}

const NO_MATCH: MatchResult = { productId: null, method: 'none', confidence: 0 }

/** Capa 1: EAN/GTIN exacto. Deterministico cuando ambos lados lo tienen. */
export function matchByEanGtin(
  capture: RawCapture,
  products: readonly Product[],
): MatchResult {
  if (!capture.eanGtin) return NO_MATCH
  const hit = products.find((p) => p.eanGtin && p.eanGtin === capture.eanGtin)
  return hit ? { productId: hit.id, method: 'ean', confidence: 1 } : NO_MATCH
}

/** Capa 2: normalizacion marca + modelo contra el nombre crudo. */
export function matchByBrandModel(
  capture: RawCapture,
  products: readonly Product[],
): MatchResult {
  const haystack = normalizeName(capture.rawName)
  if (!haystack) return NO_MATCH

  let best: MatchResult = NO_MATCH
  for (const product of products) {
    const brand = normalizeName(product.brand)
    const model = normalizeName(product.model)
    if (!model) continue

    const hasBrand = brand.length === 0 || haystack.includes(brand)
    const hasModel = haystack.includes(model)
    if (hasBrand && hasModel) {
      const confidence = brand.length > 0 && haystack.includes(brand) ? 0.9 : 0.75
      if (confidence > best.confidence) {
        best = { productId: product.id, method: 'brand_model', confidence }
      }
    }
  }
  return best
}

/**
 * Matching por capas. Devuelve el mejor resultado; el llamador decide si
 * la confianza alcanza el umbral o si la captura va a match_review_queue.
 */
export function matchCapture(
  capture: RawCapture,
  products: readonly Product[],
): MatchResult {
  const byEan = matchByEanGtin(capture, products)
  if (byEan.productId) return byEan
  return matchByBrandModel(capture, products)
}

/** Umbral por defecto: por debajo de esto, a la cola de revision manual. */
export const MATCH_CONFIDENCE_THRESHOLD = 0.85
