// Lecturas publicas sobre @guateofertas/db (cliente anon, respeta RLS).
// Las queries complejas de escritura/scraper viven en packages/db/src/queries.ts;
// estas son de solo lectura y especificas de las paginas de apps/web.

import type { Tables } from '@guateofertas/db'
import { getSupabase } from './supabase'

export type Product = Tables<'products'>
export type ProductVariant = Tables<'product_variants'>
export type Store = Tables<'stores'>
export type StoreProduct = Tables<'store_products'>
export type PricePoint = Tables<'price_points'>

export const TRACKED_CATEGORIES = ['consolas', 'gpus', 'celulares'] as const
export type TrackedCategory = (typeof TRACKED_CATEGORIES)[number]

/** Catalogo trackeado, opcionalmente filtrado por categoria. */
export async function getTrackedProducts(category?: string): Promise<Product[]> {
  let query = getSupabase()
    .from('products')
    .select('*')
    .order('category', { ascending: true })
    .order('canonical_name', { ascending: true })
  if (category) query = query.eq('category', category)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getProductById(id: string): Promise<Product | null> {
  const { data, error } = await getSupabase()
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Busca un store_product ya trackeado por URL exacta. Si existe y ya tiene
 * producto canonico asignado, la UI puede saltarse la Edge Function y
 * navegar directo al comparador sin tocar la tienda en vivo.
 */
export async function findProductIdByUrl(url: string): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from('store_products')
    .select('product_id')
    .eq('url', url)
    .eq('active', true)
    .not('product_id', 'is', null)
    .maybeSingle()
  if (error) throw error
  return data?.product_id ?? null
}

export async function getProductVariants(productId: string): Promise<ProductVariant[]> {
  const { data, error } = await getSupabase()
    .from('product_variants')
    .select('*')
    .eq('product_id', productId)
  if (error) throw error
  return data ?? []
}

export interface ProductBestPrice {
  productId: string
  price: number
  storeName: string
}

/**
 * Mejor precio actual por producto (último price_point de cada tienda, mínimo).
 * Para el grid del home cuando hay datos de demo o del colector.
 */
export async function getBestPricesForProducts(
  productIds: string[],
): Promise<Map<string, ProductBestPrice>> {
  if (productIds.length === 0) return new Map()

  const db = getSupabase()
  const { data: storeProducts, error: spError } = await db
    .from('store_products')
    .select('id, product_id, store_id')
    .in('product_id', productIds)
    .eq('active', true)
  if (spError) throw spError
  if (!storeProducts?.length) return new Map()

  const storeIds = [...new Set(storeProducts.map((sp) => sp.store_id))]
  const { data: stores, error: storesError } = await db.from('stores').select('id, name').in('id', storeIds)
  if (storesError) throw storesError
  const storeNameById = new Map((stores ?? []).map((s) => [s.id, s.name]))

  const storeProductIds = storeProducts.map((sp) => sp.id)
  const { data: pricePoints, error: ppError } = await db
    .from('price_points')
    .select('store_product_id, price, captured_at')
    .in('store_product_id', storeProductIds)
    .order('captured_at', { ascending: false })
  if (ppError) throw ppError

  const latestByStoreProduct = new Map<string, number>()
  for (const point of pricePoints ?? []) {
    if (!latestByStoreProduct.has(point.store_product_id)) {
      latestByStoreProduct.set(point.store_product_id, point.price)
    }
  }

  const bestByProduct = new Map<string, ProductBestPrice>()
  for (const sp of storeProducts) {
    const price = latestByStoreProduct.get(sp.id)
    if (price === undefined || !sp.product_id) continue
    const storeName = storeNameById.get(sp.store_id) ?? 'Tienda'
    const current = bestByProduct.get(sp.product_id)
    if (!current || price < current.price) {
      bestByProduct.set(sp.product_id, { productId: sp.product_id, price, storeName })
    }
  }

  return bestByProduct
}

export interface StorePriceInfo {
  store: Store
  storeProduct: StoreProduct | null
  latestPricePoint: PricePoint | null
}

/**
 * Para un producto, arma una fila por cada tienda activa: si hay
 * store_product mapeado y su ultimo price_point (si ya se capturo). Tiendas
 * sin fila aun se muestran como "buscando en otras tiendas...".
 */
export async function getStorePricesForProduct(productId: string): Promise<StorePriceInfo[]> {
  const db = getSupabase()
  const [storesResult, storeProductsResult] = await Promise.all([
    db.from('stores').select('*').eq('active', true).order('name', { ascending: true }),
    db.from('store_products').select('*').eq('product_id', productId).eq('active', true),
  ])
  if (storesResult.error) throw storesResult.error
  if (storeProductsResult.error) throw storeProductsResult.error

  const stores = storesResult.data ?? []
  const storeProducts = storeProductsResult.data ?? []
  const storeProductIds = storeProducts.map((sp) => sp.id)

  const latestByStoreProduct = new Map<string, PricePoint>()
  if (storeProductIds.length > 0) {
    const { data: pricePoints, error } = await db
      .from('price_points')
      .select('*')
      .in('store_product_id', storeProductIds)
      .order('captured_at', { ascending: false })
    if (error) throw error
    for (const point of pricePoints ?? []) {
      if (!latestByStoreProduct.has(point.store_product_id)) {
        latestByStoreProduct.set(point.store_product_id, point)
      }
    }
  }

  return stores.map((store) => {
    const storeProduct = storeProducts.find((sp) => sp.store_id === store.id) ?? null
    const latestPricePoint = storeProduct
      ? (latestByStoreProduct.get(storeProduct.id) ?? null)
      : null
    return { store, storeProduct, latestPricePoint }
  })
}
