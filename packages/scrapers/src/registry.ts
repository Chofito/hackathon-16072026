// Registro de scrapers por tienda. El collector itera este mapa secuencialmente.
// A medida que el dev de scrapers implemente cada tienda, se agrega aqui.

import type { Scraper } from './types.ts'
import { maxScraper } from './stores/max.ts'

export const scrapers: Record<string, Scraper> = {
  [maxScraper.key]: maxScraper,
  // TODO(dev-scrapers): kemik, pacifiko, curacao
}

export function getScraper(key: string): Scraper | undefined {
  return scrapers[key]
}

export function allScrapers(): Scraper[] {
  return Object.values(scrapers)
}
