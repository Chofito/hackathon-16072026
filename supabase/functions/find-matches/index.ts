// Edge Function: candidatos del mismo producto en otras tiendas.
// Primero rankea cache sitemap_urls; si no hay candidatos, fallback a
// Scraper.search (query tokenizada). Contrato: docs/EDGE_FUNCTIONS.md
//
// @ts-nocheck — corre en Deno.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { scoreTokens, slugFromUrl, tokenize } from '../../../packages/core/src/scoring.ts'
import { getScraper } from '../../../packages/scrapers/src/index.ts'
import {
  ALL_STORE_KEYS,
  captureToDto,
  CONFIDENT_SCORE,
  handleCors,
  jsonResponse,
  makeScrapeContext,
  MIN_SLUG_SCORE,
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
  return [...tokens].join(' ')
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
      if (sampleError) throw sampleError

      const cacheFresh =
        !!sample?.refreshed_at && new Date(sample.refreshed_at).getTime() >= staleCutoff

      let candidateUrls: string[] = []
      if (cacheFresh) {
        const { data: rows, error } = await supabase
          .from('sitemap_urls')
          .select('url')
          .eq('store_key', key)
        if (error) throw error
        candidateUrls = (rows ?? []).map((r: { url: string }) => r.url)
      }

      let ranked = rankUrls(query, candidateUrls)

      // Fallback: buscador HTML de la tienda (query tokenizada).
      const ctx = makeScrapeContext(key)
      if (ranked.length === 0 && searchQuery) {
        try {
          const searchUrls = await scraper.search(searchQuery, ctx)
          ranked = rankUrls(query, searchUrls)
        } catch {
          ranked = []
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
          confirmed.push({
            url: capture.url,
            score,
            confident: score >= CONFIDENT_SCORE || eanMatch,
            eanMatch,
            product: captureToDto(key, capture),
          })
        } catch {
          // Candidato fallido: se omite (match incorrecto peor que faltante).
        }
      }

      confirmed.sort((a, b) => b.score - a.score)
      matches[key] = confirmed.slice(0, topN)
    }

    return jsonResponse({ source, matches })
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : String(err) },
      502,
    )
  }
})
