// TEMPLATE del collector. Orquesta el ciclo: scrapers -> ingest -> Supabase.
// Corre local (`bun run collect`) para la hackathon; luego migra a cron
// (GitHub Actions, ver .github/workflows/collect.yml).
//
// Principios (docs/ARCHITECTURE.md): secuencial, sin colas; un fallo de una
// tienda no detiene a las demas; fallar ruidosamente al final si hubo fallos.

import { createServiceClient, getProducts } from '@guateofertas/db'
import { allScrapers, type ScrapeContext } from '@guateofertas/scrapers'
import { ingestCaptures } from '@guateofertas/ingest'

const USER_AGENT =
  process.env.SCRAPER_USER_AGENT ?? 'GuateOfertasBot/0.1 (+https://example.com; contacto@example.com)'
const MIN_DELAY_MS = Number(process.env.SCRAPER_MIN_DELAY_MS ?? '3000')

async function main(): Promise<void> {
  const db = createServiceClient()
  const products = await getProducts(db)

  // Mapea nombre de tienda -> id (para el ingest). El seed ya poblo `stores`.
  const { data: stores, error } = await db.from('stores').select('id, name, base_url, platform, active')
  if (error) throw error

  let hadFailures = false

  for (const scraper of allScrapers()) {
    const store = stores.find((s) => s.name.toLowerCase() === scraper.key.toLowerCase())
    if (!store) {
      console.warn(`[collector] sin store en DB para scraper '${scraper.key}', se omite`)
      continue
    }

    const ctx: ScrapeContext = {
      store: {
        id: store.id,
        name: store.name,
        baseUrl: store.base_url,
        platform: store.platform as ScrapeContext['store']['platform'],
        active: store.active,
        createdAt: new Date().toISOString(),
      },
      userAgent: USER_AGENT,
      minDelayMs: MIN_DELAY_MS,
      fetch: globalThis.fetch,
    }

    try {
      const result = await scraper.scrape(ctx)
      const summary = await ingestCaptures(db, store.id, result.captures, products)
      console.log(
        `[collector] ${scraper.key}: ${summary.inserted} insertados, ` +
          `${summary.matched} matcheados, ${summary.queuedForReview} a revision, ` +
          `${result.failures.length} fallos`,
      )
      if (result.failures.length > 0) hadFailures = true
    } catch (err) {
      // Fallar ruidosamente: un scraper caido no detiene a los demas.
      hadFailures = true
      console.error(`[collector] ${scraper.key} FALLO:`, err)
    }
  }

  // TODO(dev-collector): procesar product_requests (cola on-demand) tras el ciclo.

  if (hadFailures) {
    // TODO(dev-collector): notificar al operador (docs/ARCHITECTURE.md, notificaciones).
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error('[collector] error fatal:', err)
  process.exit(1)
})
