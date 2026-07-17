// Contrato de los scrapers. Un modulo por tienda implementa `Scraper`.
// IMPORTANTE: mantener runtime-agnostico (fetch estandar, sin APIs Bun.*)
// para poder reutilizar la logica tanto en el collector (Bun) como en la
// Edge Function on-demand (Deno). Ver docs/SCRAPING.md.

import type { RawCapture, Store } from '@pgt/core'

/** Contexto de ejecucion inyectado a cada scraper (cortesia + config). */
export interface ScrapeContext {
  store: Store
  /** User-agent identificable con contacto (docs/SCRAPING.md). */
  userAgent: string
  /** Delay minimo entre requests a la misma tienda (ms). */
  minDelayMs: number
  /** fetch inyectable para testear / cambiar de runtime. */
  fetch: typeof globalThis.fetch
}

export interface ScrapeFailure {
  url: string
  reason: string
}

export interface ScrapeResult {
  captures: RawCapture[]
  failures: ScrapeFailure[]
}

/** Entrada para el fetch on-demand de un solo producto. */
export interface FetchOneInput {
  url?: string
  sku?: string
}

/**
 * Interfaz comun de un scraper por tienda.
 * - `listProductUrls`: descubre URLs via sitemap (para cache / batch).
 * - `scrape`: ciclo completo (sitemap -> capturas) para el cron.
 * - `fetchOne`: un solo producto para el flujo on-demand del usuario.
 */
export interface Scraper {
  /** Clave de la tienda, ej. 'max'. Debe existir un `stores.name` asociado. */
  readonly key: string
  listProductUrls(ctx: ScrapeContext): Promise<string[]>
  scrape(ctx: ScrapeContext): Promise<ScrapeResult>
  fetchOne(input: FetchOneInput, ctx: ScrapeContext): Promise<RawCapture | null>
}
