// Tipos de dominio compartidos. Fuente de verdad: docs/DATA_MODEL.md.
// Estos tipos representan el dominio en camelCase; el mapeo a las columnas
// snake_case de Postgres vive en @guateofertas/db.

export type StockStatus = 'in_stock' | 'out_of_stock' | 'unknown'

export type StorePlatform =
  | 'magento'
  | 'vtex'
  | 'shopify'
  | 'woocommerce'
  | 'custom'
  | 'unknown'

export interface Store {
  id: string
  name: string
  baseUrl: string
  platform: StorePlatform
  active: boolean
  createdAt: string
}

/** Catalogo canonico: el moat del proyecto. */
export interface Product {
  id: string
  canonicalName: string
  brand: string
  model: string
  eanGtin: string | null
  category: string
  createdAt: string
}

export interface ProductVariant {
  id: string
  productId: string
  variantType: string
  variantValue: string
}

/** Mapeo tienda -> catalogo canonico. productId null = aun sin matchear. */
export interface StoreProduct {
  id: string
  storeId: string
  productId: string | null
  storeSku: string
  url: string
  rawName: string
  active: boolean
  firstSeenAt: string
  lastSeenAt: string
}

/** Serie de tiempo append-only. */
export interface PricePoint {
  id: number
  storeProductId: string
  price: number
  listPrice: number | null
  conditionalPrice: number | null
  conditionalPriceNote: string | null
  currency: string
  stockStatus: StockStatus
  capturedAt: string
}

export type MatchStatus = 'pending' | 'matched' | 'new_product' | 'ignored'

export interface MatchReviewItem {
  id: string
  storeProductId: string
  rawName: string
  suggestedProductId: string | null
  status: MatchStatus
  createdAt: string
}

export type ProductRequestStatus = 'pending' | 'processing' | 'done' | 'failed'

/** Cola on-demand: lo que un usuario pide traer desde una tienda. */
export interface ProductRequest {
  id: string
  storeId: string | null
  url: string | null
  sku: string | null
  status: ProductRequestStatus
  requestedBy: string | null
  createdAt: string
}

/**
 * Captura cruda producida por un scraper antes de persistirse.
 * No incluye ids internos: es el "raw" parseado del JSON-LD de una tienda.
 */
export interface RawCapture {
  storeSku: string
  url: string
  rawName: string
  price: number
  listPrice: number | null
  conditionalPrice: number | null
  conditionalPriceNote: string | null
  currency: string
  stockStatus: StockStatus
  eanGtin: string | null
  capturedAt: string
}
