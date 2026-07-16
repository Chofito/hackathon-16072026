// Helper de fetch "cortes": rate limit por tienda + user-agent identificable.
// Template de infraestructura — el dev de scrapers puede ampliarlo
// (ETag/Last-Modified, reintentos con backoff, respeto de Crawl-delay).

import type { ScrapeContext } from './types.ts'

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * GET con user-agent identificable y pausa previa (rate limit).
 * Lanza si la respuesta no es 2xx para "fallar ruidosamente" (docs/ARCHITECTURE.md).
 */
export async function politeGet(url: string, ctx: ScrapeContext): Promise<string> {
  await sleep(ctx.minDelayMs)
  const res = await ctx.fetch(url, {
    headers: { 'user-agent': ctx.userAgent, accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow',
  })
  if (!res.ok) {
    // TODO(dev-scrapers): detectar challenge de Cloudflare (403/503 + HTML de reto)
    // y abortar la tienda en el ciclo, nunca intentar evadirlo.
    throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`)
  }
  return res.text()
}
