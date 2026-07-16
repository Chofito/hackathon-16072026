// Helpers de query/insert sobre Supabase. Mapean entre el dominio (camelCase,
// @pgt/core) y las columnas snake_case de Postgres.

import type { Product, RawCapture, StockStatus } from '@pgt/core'
import type { Db } from './client.ts'
import type { TablesInsert } from './database.types.ts'

/** Lee el catalogo canonico completo (para el matching en memoria). */
export async function getProducts(db: Db): Promise<Product[]> {
  const { data, error } = await db
    .from('products')
    .select('id, canonical_name, brand, model, ean_gtin, category, created_at')
  if (error) throw error
  // Mapeo snake_case (Postgres) -> camelCase (dominio @pgt/core).
  return data.map((row) => ({
    id: row.id,
    canonicalName: row.canonical_name,
    brand: row.brand,
    model: row.model,
    eanGtin: row.ean_gtin,
    category: row.category,
    createdAt: row.created_at,
  }))
}

/** Busca un store_product por (store_id, store_sku) — el lookup del scraper. */
export async function getStoreProductBySku(
  db: Db,
  storeId: string,
  storeSku: string,
) {
  const { data, error } = await db
    .from('store_products')
    .select('*')
    .eq('store_id', storeId)
    .eq('store_sku', storeSku)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Upsert de un store_product a partir de una captura cruda.
 * Devuelve el id del store_product (existente o recien creado).
 */
export async function upsertStoreProduct(
  db: Db,
  params: {
    storeId: string
    productId: string | null
    capture: Pick<RawCapture, 'storeSku' | 'url' | 'rawName'>
  },
): Promise<string> {
  const row: TablesInsert<'store_products'> = {
    store_id: params.storeId,
    product_id: params.productId,
    store_sku: params.capture.storeSku,
    url: params.capture.url,
    raw_name: params.capture.rawName,
    last_seen_at: new Date().toISOString(),
  }
  const { data, error } = await db
    .from('store_products')
    .upsert(row, { onConflict: 'store_id,store_sku' })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

/** Inserta price_points (append-only). Nunca update ni delete. */
export async function insertPricePoints(
  db: Db,
  storeProductId: string,
  captures: readonly RawCapture[],
) {
  if (captures.length === 0) return
  const rows: TablesInsert<'price_points'>[] = captures.map((c) => ({
    store_product_id: storeProductId,
    price: c.price,
    list_price: c.listPrice,
    conditional_price: c.conditionalPrice,
    conditional_price_note: c.conditionalPriceNote,
    currency: c.currency,
    stock_status: c.stockStatus satisfies StockStatus,
    captured_at: c.capturedAt,
  }))
  const { error } = await db.from('price_points').insert(rows)
  if (error) throw error
}

/** Manda una captura sin match confiable a la cola de revision manual. */
export async function enqueueReview(
  db: Db,
  params: { storeProductId: string; rawName: string; suggestedProductId: string | null },
) {
  const { error } = await db.from('match_review_queue').insert({
    store_product_id: params.storeProductId,
    raw_name: params.rawName,
    suggested_product_id: params.suggestedProductId,
    status: 'pending',
  })
  if (error) throw error
}

/** Lee las solicitudes on-demand pendientes (las que levanta el collector). */
export async function getPendingProductRequests(db: Db) {
  const { data, error } = await db
    .from('product_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}
