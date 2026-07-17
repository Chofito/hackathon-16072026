// Edge Function: candidatos del mismo producto en otras tiendas.
// Sitemap filtrado por tokens distintivos (evita truncate max_rows=1000) +
// fallback/merge con Scraper.search. Contrato: docs/EDGE_FUNCTIONS.md
//
// @ts-nocheck — corre en Deno.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  isModelToken,
  pickDistinctiveTokens,
  scoreTokens,
  slugFromUrl,
  tokenize,
} from '../../../packages/core/src/scoring.ts'
import { getScraper } from '../../../packages/scrapers/src/index.ts'
import {
  ALL_STORE_KEYS,
  captureToDto,
  CONFIDENT_SCORE,
  handleCors,
  jsonResponse,
  makeScrapeContext,
  MIN_NAME_SCORE,
  MIN_SLUG_SCORE,
  SITEMAP_MAX_PAGES,
  SITEMAP_PAGE_SIZE,
  STALE_DAYS,
  storeKeyFromUrl,
  TOP_CANDIDATES_CONFIRM,
  type ProductDto,
  type StoreKey,
} from '../_shared/mod.ts'

interface Body {
  url?: string
  topN?: number
}

interface MatchItem {
  url: string
  score: number
  confident: boolean
  eanMatch: boolean
  product: ProductDto
}

function rankUrls(query: Set<string>, urls: string[]) {
  return urls
    .map((u) => ({
      url: u,
      slugScore: scoreTokens(query, tokenize(slugFromUrl(u))),
    }))
    .filter((c) => c.slugScore >= MIN_SLUG_SCORE)
    .sort((a, b) => b.slugScore - a.slugScore)
    .slice(0, TOP_CANDIDATES_CONFIRM)
}

function searchQueryFromTokens(tokens: Set<string>): string {
  const distinctive = pickDistinctiveTokens(tokens, 5)
  return (distinctive.length > 0 ? distinctive : [...tokens]).join(' ')
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  if (err && typeof err === 'object') {
    const o = err as { message?: unknown; error?: unknown; code?: unknown }
    if (typeof o.message === 'string') return o.message
    if (typeof o.error === 'string') return o.error
    try {
      return JSON.stringify(err)
    } catch {
      return 'error desconocido'
    }
  }
  return String(err)
}

/**
 * Carga URLs del cache filtrando por tokens distintivos y paginando.
 * Sin filtro, PostgREST truncaba a 1000 filas alfabéticas (basura en Pacifiko).
 * Ante error de DB (timeout ilike sobre catálogos grandes) devolvemos [] y
 * dejamos que el search fallback continúe.
 */
async function fetchSitemapCandidates(
  supabase: ReturnType<typeof createClient>,
  storeKey: StoreKey,
  query: Set<string>,
): Promise<string[]> {
  const tokens = pickDistinctiveTokens(query, 3)
  // Si hay tokens de modelo (2200va, qn55…), no mezclar con palabras genéricas
  // en el OR — eso hincha el result set y hace timeout en Pacifiko.
  const modelTokens = tokens.filter((t) => isModelToken(t) && !/^\d$/.test(t))
  const filterTokens = modelTokens.length > 0 ? modelTokens.slice(0, 2) : tokens
  if (filterTokens.length === 0) return []

  const urls: string[] = []
  const orFilter = filterTokens.map((t) => `url.ilike.%${t}%`).join(',')

  try {
    for (let page = 0; page < SITEMAP_MAX_PAGES; page++) {
      const from = page * SITEMAP_PAGE_SIZE
      const to = from + SITEMAP_PAGE_SIZE - 1
      const { data, error } = await supabase
        .from('sitemap_urls')
        .select('url')
        .eq('store_key', storeKey)
        .or(orFilter)
        .range(from, to)
      if (error) {
        console.error(`[find-matches] sitemap ${storeKey}:`, errorMessage(error))
        return urls
      }
      if (!data?.length) break
      for (const row of data) urls.push(row.url)
      if (data.length < SITEMAP_PAGE_SIZE) break
    }
  } catch (err) {
    console.error(`[find-matches] sitemap ${storeKey}:`, errorMessage(err))
  }
  return urls
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

  const topN = Math.min(Math.max(Number(body.topN) || 3, 1), 5)
  const sourceKey = storeKeyFromUrl(url)
  const sourceScraper = sourceKey ? getScraper(sourceKey) : undefined
  if (!sourceKey || !sourceScraper) {
    return jsonResponse({ error: 'Tienda no soportada para esta URL' }, 400)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: 'Faltan credenciales Supabase' }, 500)
  }
  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    const sourceCtx = makeScrapeContext(sourceKey)
    const sourceCapture = await sourceScraper.fetchOne({ url }, sourceCtx)
    if (!sourceCapture) {
      return jsonResponse({ error: 'Sin datos de producto en la URL fuente' }, 404)
    }
    const source = captureToDto(sourceKey, sourceCapture)
    const query = tokenize(sourceCapture.rawName)
    const searchQuery = searchQueryFromTokens(query)

    const destinations = ALL_STORE_KEYS.filter((k) => k !== sourceKey)
    const staleCutoff = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000
    const matches: Record<string, MatchItem[]> = {}

    for (const key of destinations) {
      const scraper = getScraper(key)
      if (!scraper) {
        matches[key] = []
        continue
      }

      const { data: sample, error: sampleError } = await supabase
        .from('sitemap_urls')
        .select('refreshed_at')
        .eq('store_key', key)
        .limit(1)
        .maybeSingle()
      if (sampleError) {
        console.error(`[find-matches] sample ${key}:`, errorMessage(sampleError))
        matches[key] = []
        continue
      }

      const cacheFresh =
        !!sample?.refreshed_at && new Date(sample.refreshed_at).getTime() >= staleCutoff

      const candidateUrls = new Set<string>()
      if (cacheFresh) {
        for (const u of await fetchSitemapCandidates(supabase, key, query)) {
          candidateUrls.add(u)
        }
      }

      let ranked = rankUrls(query, [...candidateUrls])

      // Search: fallback si sitemap no da, o refuerzo si hay pocos candidatos.
      const ctx = makeScrapeContext(key)
      if (ranked.length < 2 && searchQuery) {
        try {
          const searchUrls = await scraper.search(searchQuery, ctx)
          for (const u of searchUrls) candidateUrls.add(u)
          ranked = rankUrls(query, [...candidateUrls])
        } catch {
          /* search opcional */
        }
      }

      const confirmed: MatchItem[] = []
      for (const candidate of ranked) {
        try {
          const capture = await scraper.fetchOne({ url: candidate.url }, ctx)
          if (!capture) continue
          const eanMatch = !!(
            sourceCapture.eanGtin &&
            capture.eanGtin &&
            sourceCapture.eanGtin === capture.eanGtin
          )
          const nameScore = scoreTokens(query, tokenize(capture.rawName))
          const score = eanMatch ? 1 : nameScore
          if (!eanMatch && score < MIN_NAME_SCORE) continue
          confirmed.push({
            url: capture.url,
            score,
            confident: score >= CONFIDENT_SCORE || eanMatch,
            eanMatch,
            product: captureToDto(key, capture),
          })
        } catch {
          // Candidato fallido: se omite.
        }
      }

      confirmed.sort((a, b) => b.score - a.score)
      matches[key] = confirmed.slice(0, topN)
    }

    return jsonResponse({ source, matches })
  } catch (err) {
    return jsonResponse({ error: errorMessage(err) }, 502)
  }
})
