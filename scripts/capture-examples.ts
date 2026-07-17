// Genera capturas de ejemplo (RawCapture) usando los scrapers reales de
// @pgt/scrapers contra URLs de producto conocidas, y las guarda como .json en
// examples/captures/. Sirve de smoke test end-to-end de los scrapers sin DB.
//
// Uso:  bun run scripts/capture-examples.ts [url...]
// Sin argumentos usa la lista de URLs de ejemplo de abajo.
// Cortesia: requests secuenciales con el delay del ScrapeContext (3 s default).

import { mkdir, writeFile } from 'node:fs/promises'
import type { RawCapture, Store } from '@pgt/core'
import { getScraper, type ScrapeContext } from '@pgt/scrapers'

const DEFAULT_URLS = [
  'https://www.max.com.gt/consola-nintendo-switch-2-version-usa-nintendo-nsw2us',
  'https://www.max.com.gt/samsung-galaxy-a56-5g-256gb-dual-sim-liberado-negro-samsung-sma566ezk15',
  'https://www.kemik.gt/samsung-galaxy-a56-12gb-ram-256gb-almacenamiento-grafito-dual-sim-liberado',
  'https://www.kemik.gt/xiaomi-poco-x8-pro-max-5g-12gb-ram-512gb-almacenamiento-negro-liberado-dual-sim',
  'https://www.pacifiko.com/compras-en-linea/samsung-galaxy-a56-5g-2025-with-ai-256gb-8gb-dual-sim-6-7-120hz-amoled-water-resistant-android-15-international-model-factory-unlocked-for-t-mobile-global-25w-charger-bundle-olive-color-awsome-olive&pid=NWRjMWZhMW?ref=s&query_id=56600a50-76e9-4d9e-970f-7d1cb117dfe2',
  'https://www.pacifiko.com/compras-en-linea/whirpool-lavadora-whirlpool-superior-19kgs-smart-action-y-panel-digital-gris-negro&pid=YzhjOWVmZm?ref=s&query_id=dae6672c-998f-4e7a-bd40-fb8c94beab7d',
]

const OUT_DIR = 'examples/captures'

function scraperKeyForUrl(url: string): string | null {
  const host = new URL(url).hostname
  if (host.endsWith('max.com.gt')) return 'max'
  if (host.endsWith('kemik.gt')) return 'kemik'
  if (host.endsWith('pacifiko.com')) return 'pacifiko'
  if (host.endsWith('lacuracaonline.com')) return 'curacao'
  return null
}

// Store minimo para el contexto: el scraper solo usa cortesia/UA, no la DB.
function stubStore(key: string): Store {
  return {
    id: `example-${key}`,
    name: key,
    baseUrl: '',
    platform: 'unknown',
    active: true,
    createdAt: new Date().toISOString(),
  }
}

function fileNameFor(key: string, capture: RawCapture): string {
  const sku = capture.storeSku.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `${key}-${sku}.json`
}

async function main(): Promise<void> {
  const urls = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_URLS
  await mkdir(OUT_DIR, { recursive: true })

  let failures = 0
  for (const url of urls) {
    const key = scraperKeyForUrl(url)
    const scraper = key ? getScraper(key) : undefined
    if (!key || !scraper) {
      console.error(`[examples] sin scraper para ${url}`)
      failures++
      continue
    }

    const ctx: ScrapeContext = {
      store: stubStore(key),
      userAgent:
        process.env.SCRAPER_USER_AGENT ??
        'PreciosGT-Bot/0.1 (+https://github.com/preciosgt; contacto@preciosgt.example)',
      minDelayMs: Number(process.env.SCRAPER_MIN_DELAY_MS ?? '3000'),
      fetch: globalThis.fetch,
    }

    try {
      const capture = await scraper.fetchOne({ url }, ctx)
      if (!capture) {
        console.error(`[examples] ${key}: sin datos de producto en ${url}`)
        failures++
        continue
      }
      const file = `${OUT_DIR}/${fileNameFor(key, capture)}`
      await writeFile(file, `${JSON.stringify(capture, null, 2)}\n`)
      console.log(
        `[examples] ${key}: ${capture.rawName} -> ${capture.currency} ${capture.price}` +
          `${capture.listPrice ? ` (antes ${capture.listPrice})` : ''} [${capture.stockStatus}] => ${file}`,
      )
    } catch (err) {
      failures++
      console.error(`[examples] ${key} FALLO en ${url}:`, err instanceof Error ? err.message : err)
    }
  }

  if (failures > 0) process.exitCode = 1
}

main()
