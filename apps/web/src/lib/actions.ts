'use server'

import { findProductIdByUrl } from './queries'

/**
 * Resuelve, del lado del servidor, si un link pegado en el home ya existe en
 * `store_products`. Se corre antes de invocar la Edge Function `fetch-product`
 * para no tocar la tienda en vivo si el producto ya esta trackeado.
 */
export async function resolveTrackedUrl(url: string): Promise<{ productId: string } | null> {
  const productId = await findProductIdByUrl(url).catch(() => null)
  return productId ? { productId } : null
}
