// Registro de scrapers por tienda. El collector itera este mapa secuencialmente.

import type { Scraper } from './types.ts'
import { curacaoScraper } from './stores/curacao.ts'
import { kemikScraper } from './stores/kemik.ts'
import { maxScraper } from './stores/max.ts'
import { pacifikoScraper } from './stores/pacifiko.ts'

export const scrapers: Record<string, Scraper> = {
  [maxScraper.key]: maxScraper,
  [kemikScraper.key]: kemikScraper,
  [pacifikoScraper.key]: pacifikoScraper,
  [curacaoScraper.key]: curacaoScraper,
}

export function getScraper(key: string): Scraper | undefined {
  return scrapers[key]
}

export function allScrapers(): Scraper[] {
  return Object.values(scrapers)
}
