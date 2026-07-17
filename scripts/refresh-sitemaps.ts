// Refresca el cache de URLs de producto por tienda (tabla sitemap_urls).
// Descarga sitemaps via listProductUrls de cada scraper y reemplaza las filas
// de esa tienda en Supabase. Lo consume find-matches en runtime on-demand.
//
// Uso:  bun run scripts/refresh-sitemaps.ts [store_key]
// Sin argumento refresca todas las tiendas. Requiere SUPABASE_URL y
// SUPABASE_SERVICE_ROLE_KEY (Bun carga .env automaticamente).

import type { Store } from '@pgt/core'
import { createServiceClient } from '@pgt/db'
import { allScrapers, type ScrapeContext, type Scraper } from '@pgt/scrapers'

const BATCH_SIZE = 500

const DEFAULT_USER_AGENT =
  'PreciosGT-Bot/0.1 (+https://github.com/chofito/precios-gt; contacto@example.com)'

function stubStore(key: string): Store {
  return {
    id: `refresh-${key}`,
    name: key,
    baseUrl: '',
    platform: 'unknown',
    active: true,
    createdAt: new Date().toISOString(),
  }
}

function buildContext(key: string): ScrapeContext {
  return {
    store: stubStore(key),
    userAgent: process.env.SCRAPER_USER_AGENT ?? DEFAULT_USER_AGENT,
    minDelayMs: Number(process.env.SCRAPER_MIN_DELAY_MS ?? '3000'),
    fetch: globalThis.fetch,
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size))
  }
  return batches
}

async function refreshStore(
  db: ReturnType<typeof createServiceClient>,
  scraper: Scraper,
  ctx: ScrapeContext,
): Promise<void> {
  const urls = await scraper.listProductUrls(ctx)
  const refreshedAt = new Date().toISOString()

  const { error: deleteError } = await db
    .from('sitemap_urls')
    .delete()
    .eq('store_key', scraper.key)
  if (deleteError) throw deleteError

  for (const batch of chunk(urls, BATCH_SIZE)) {
    const rows = batch.map((url) => ({
      store_key: scraper.key,
      url,
      refreshed_at: refreshedAt,
    }))
    const { error: insertError } = await db.from('sitemap_urls').insert(rows)
    if (insertError) throw insertError
  }

  console.log(`[refresh] ${scraper.key}: ${urls.length} urls`)
}

async function main(): Promise<void> {
  const filterKey = process.argv[2]?.toLowerCase()
  const db = createServiceClient()

  let scrapers = allScrapers()
  if (filterKey) {
    scrapers = scrapers.filter((s) => s.key.toLowerCase() === filterKey)
    if (scrapers.length === 0) {
      console.error(`[refresh] scraper desconocido: ${filterKey}`)
      process.exit(1)
    }
  }

  let hadFailures = false

  for (const scraper of scrapers) {
    const ctx = buildContext(scraper.key)
    try {
      await refreshStore(db, scraper, ctx)
    } catch (err) {
      hadFailures = true
      console.error(
        `[refresh] ${scraper.key} FALLO:`,
        err instanceof Error ? err.message : err,
      )
    }
  }

  if (hadFailures) process.exitCode = 1
}

main().catch((err) => {
  console.error('[refresh] error fatal:', err)
  process.exit(1)
})
