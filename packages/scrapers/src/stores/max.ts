// TEMPLATE de scraper por tienda. NO es una implementacion real.
// Copiar este archivo por tienda (kemik.ts, pacifiko.ts, curacao.ts) y completar
// los TODO. El objetivo del scaffold es dejar el contrato listo para el dev de scrapers.
//
// Guia de implementacion (docs/SCRAPING.md):
//   1. politeGet(sitemapUrl) -> parseSitemapUrls() para descubrir URLs de producto.
//   2. Filtrar solo URLs de SKUs trackeados.
//   3. Por cada URL: politeGet(url) -> parseProductFromHtml() (JSON-LD).
//   4. Mapear ParsedProduct -> RawCapture. Distinguir price / list_price / conditional_price.
//   5. Acumular capturas y fallos; fallar ruidosamente ante challenge/markup inesperado.

import type { RawCapture } from '@guateofertas/core'
// Helpers portables disponibles para la implementacion real:
// import { parseProductFromHtml, parseSitemapUrls } from '@guateofertas/core'
// import { politeGet } from '../http.ts'
import type {
  FetchOneInput,
  Scraper,
  ScrapeContext,
  ScrapeResult,
} from '../types.ts'

export const maxScraper: Scraper = {
  key: 'max',

  async scrape(_ctx: ScrapeContext): Promise<ScrapeResult> {
    // TODO(dev-scrapers): implementar el ciclo sitemap -> JSON-LD -> capturas.
    // Devuelve capturas vacias por ahora para no romper el collector template.
    return { captures: [], failures: [] }
  },

  async fetchOne(_input: FetchOneInput, _ctx: ScrapeContext): Promise<RawCapture | null> {
    // TODO(dev-scrapers): fetch de una sola URL/SKU para el flujo on-demand.
    //   const html = await politeGet(url, ctx)
    //   const parsed = parseProductFromHtml(html)
    //   return parsed ? mapToRawCapture(parsed, url) : null
    return null
  },
}
