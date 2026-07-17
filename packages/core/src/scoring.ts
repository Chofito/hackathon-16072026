// Scoring de tokens para matching cross-tienda (sitemap URL / nombre).
// Portado del POC (poc/lib.ts). Puro, sin I/O — corre en Bun y Deno.

const STOPWORDS = new Set([
  'de', 'la', 'el', 'los', 'las', 'un', 'una', 'con', 'para', 'por', 'y', 'o', 'a', 'en',
  'del', 'al', 'su', 'sus', 'lo', 'the', 'of', 'for', 'and',
  'descargable', 'incluye', 'nuevo', 'nueva', 'color', 'version', 'edicion', 'edition',
  'caja', 'pulgadas', 'almacenamiento', 'pantalla', 'compras', 'linea', 'producto',
])

/** Tokens demasiado genericos para filtrar sitemap / search. */
const WEAK_TOKENS = new Set([
  'pro', 'max', 'plus', 'mini', 'new', 'smart', 'tv', 'wifi', 'wi', 'fi', 'gb', 'ram',
  'negro', 'black', 'white', 'plata', 'silver', 'azul', 'blue', 'gris', 'gray',
])

/** Señales de accesorio/compatible en el slug o nombre candidato. */
const ACCESSORY_TOKENS = new Set([
  'case', 'funda', 'cover', 'protector', 'tempered', 'glass', 'stylus', 'pencil',
  'keyboard', 'charger', 'cargador', 'cable', 'compatible', 'for', 'holder',
  'estuche', 'skin', 'sleeve', 'stand', 'soporte', 'cleaner', 'kit',
])

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Tokens que identifican el modelo concreto (letra+digitos o digito de version). */
function isModelToken(t: string): boolean {
  if (/^[a-z]{1,4}\d{1,4}[a-z0-9]*$/i.test(t)) return true
  if (/^\d$/.test(t)) return true
  // SKUs largos tipo qn55q6faa / fvr2201m
  if (/^[a-z]+\d+[a-z0-9]+$/i.test(t) && t.length >= 5) return true
  return false
}

/** Convierte texto libre (o un slug de URL) en un set de tokens identificables. */
export function tokenize(text: string): Set<string> {
  const clean = stripAccents(text.toLowerCase())
    .replace(/wi[\s-]?fi/g, 'wifi')
    .replace(/[^a-z0-9]+/g, ' ')
  const tokens = clean.split(' ').filter(
    (t) => (t.length > 1 || /^\d$/.test(t)) && !STOPWORDS.has(t),
  )
  return new Set(tokens)
}

/**
 * Tokens utiles para filtrar sitemap via SQL / armar search query.
 * Prioriza modelo y tokens largos; descarta genericos (pro, smart, colores).
 */
export function pickDistinctiveTokens(tokens: Set<string>, limit = 3): string[] {
  const ranked = [...tokens]
    .filter((t) => !WEAK_TOKENS.has(t) && !/^\d$/.test(t))
    .sort((a, b) => {
      const am = isModelToken(a) ? 1 : 0
      const bm = isModelToken(b) ? 1 : 0
      if (bm !== am) return bm - am
      if (b.length !== a.length) return b.length - a.length
      return a.localeCompare(b)
    })
  return ranked.slice(0, limit)
}

function hasAccessorySignal(candidate: Set<string>): boolean {
  for (const t of candidate) {
    if (ACCESSORY_TOKENS.has(t)) return true
  }
  return false
}

/**
 * Fraccion de tokens de la query presentes en el candidato (0..1),
 * con bonus por tokens numericos, penalizacion si falta un token de modelo,
 * piso si hay match de modelo fuerte, y penalizacion de accesorios.
 */
export function scoreTokens(query: Set<string>, candidate: Set<string>): number {
  if (query.size === 0) return 0
  let matched = 0
  let numericBonus = 0
  let modelMiss = false
  let modelHit = false
  for (const t of query) {
    if (candidate.has(t)) {
      matched++
      if (/^\d+$/.test(t)) numericBonus += 0.15
      if (isModelToken(t) && t.length >= 2) modelHit = true
    } else if (isModelToken(t)) {
      modelMiss = true
    }
  }
  let base = matched / query.size + numericBonus
  if (modelMiss) base *= 0.45
  // Nombre comercial largo vs slug corto: si el SKU/modelo matchea, no descartar.
  if (modelHit) base = Math.max(base, 0.55)
  if (hasAccessorySignal(candidate) && !hasAccessorySignal(query)) {
    base *= 0.35
  }
  return base
}

/**
 * Slug legible de una URL de producto (ultimo segmento de path,
 * descartando `&pid=` de Pacifiko y el sufijo `/p` de Curacao).
 */
export function slugFromUrl(url: string): string {
  try {
    const u = new URL(url)
    let path = decodeURIComponent(u.pathname)
    if (path.endsWith('/')) path = path.slice(0, -1)
    let seg = path.split('/').filter(Boolean).pop() ?? ''
    if (seg === 'p') {
      const parts = path.split('/').filter(Boolean)
      seg = parts[parts.length - 2] ?? seg
    }
    seg = seg.split('&')[0] ?? seg
    return seg
  } catch {
    return url
  }
}
