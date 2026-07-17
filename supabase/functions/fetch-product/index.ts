// Edge Function: info de un producto por URL (1 tienda).
// Contrato: docs/EDGE_FUNCTIONS.md
//
// @ts-nocheck — corre en Deno; el typecheck Bun del monorepo no lo cubre.

import { getScraper } from '../../../packages/scrapers/src/index.ts'
import {
  captureToDto,
  handleCors,
  jsonResponse,
  makeScrapeContext,
  storeKeyFromUrl,
} from '../_shared/mod.ts'

interface Body {
  url?: string
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405)
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return jsonResponse({ error: 'JSON invalido' }, 400)
  }

  const url = body.url?.trim()
  if (!url) {
    return jsonResponse({ error: 'Se requiere url' }, 400)
  }

  const storeKey = storeKeyFromUrl(url)
  const scraper = storeKey ? getScraper(storeKey) : undefined
  if (!storeKey || !scraper) {
    return jsonResponse({ error: 'Tienda no soportada para esta URL' }, 400)
  }

  try {
    const ctx = makeScrapeContext(storeKey)
    const capture = await scraper.fetchOne({ url }, ctx)
    if (!capture) {
      return jsonResponse({ error: 'Sin datos de producto en la pagina' }, 404)
    }
    return jsonResponse(captureToDto(storeKey, capture))
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : String(err) },
      502,
    )
  }
})
