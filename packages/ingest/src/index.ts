// TEMPLATE de ingesta ("functions que ingresan data").
// Toma capturas crudas -> matching contra el catalogo canonico -> inserta price_points.
// Lo que no matchea con confianza va a match_review_queue (regla: en duda, a la cola).
//
// El esqueleto compila y describe el flujo; el dev que retome esto refina los TODO
// (dedupe, deteccion price vs list_price vs conditional_price, variantes, etc.).

import { matchCapture, MATCH_CONFIDENCE_THRESHOLD, type Product, type RawCapture } from '@guateofertas/core'
import {
  enqueueReview,
  insertPricePoints,
  upsertStoreProduct,
  type Db,
} from '@guateofertas/db'

export interface IngestSummary {
  inserted: number
  matched: number
  queuedForReview: number
}

/**
 * Ingesta las capturas de una tienda.
 * @param products catalogo canonico ya cargado en memoria (getProducts).
 */
export async function ingestCaptures(
  db: Db,
  storeId: string,
  captures: readonly RawCapture[],
  products: readonly Product[],
): Promise<IngestSummary> {
  const summary: IngestSummary = { inserted: 0, matched: 0, queuedForReview: 0 }

  for (const capture of captures) {
    // 1. Matching por capas (EAN/GTIN -> marca+modelo).
    const match = matchCapture(capture, products)
    const confident = match.productId !== null && match.confidence >= MATCH_CONFIDENCE_THRESHOLD

    // 2. Upsert del mapeo tienda -> canonico.
    const storeProductId = await upsertStoreProduct(db, {
      storeId,
      productId: confident ? match.productId : null,
      capture,
    })

    // 3. Insertar el price_point (append-only). Sin fila = "no capturado".
    // TODO(dev-ingest): validar datos absurdos (precio <= 0) antes de insertar.
    await insertPricePoints(db, storeProductId, [capture])
    summary.inserted += 1

    // 4. Discrepancias -> cola de revision manual.
    if (confident) {
      summary.matched += 1
    } else {
      await enqueueReview(db, {
        storeProductId,
        rawName: capture.rawName,
        suggestedProductId: match.productId,
      })
      summary.queuedForReview += 1
    }
  }

  return summary
}
