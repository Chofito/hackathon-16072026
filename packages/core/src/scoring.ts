// Scoring de tokens para matching cross-tienda (sitemap URL / nombre).
// Portado del POC (poc/lib.ts). Puro, sin I/O — corre en Bun y Deno.

const STOPWORDS = new Set([
  'de', 'la', 'el', 'los', 'las', 'un', 'una', 'con', 'para', 'por', 'y', 'o', 'a', 'en',
  'del', 'al', 'su', 'sus', 'lo', 'the', 'of', 'for', 'and',
  'descargable', 'incluye', 'nuevo', 'nueva', 'color', 'version', 'edicion', 'edition',
  'caja', 'pulgadas', 'almacenamiento', 'pantalla', 'compras', 'linea', 'producto',
])

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Tokens que identifican el modelo concreto (letra+digitos o digito de version). */
function isModelToken(t: string): boolean {
  if (/^[a-z]{1,4}\d{1,4}[a-z0-9]*$/i.test(t)) return true
  if (/^\d$/.test(t)) return true
  return false
}

/** Convierte texto libre (o un slug de URL) en un set de tokens identificables. */
export function tokenize(text: string): Set<string> {
  const clean = stripAccents(text.toLowerCase()).replace(/[^a-z0-9]+/g, ' ')
  const tokens = clean.split(' ').filter(
    (t) => (t.length > 1 || /^\d$/.test(t)) && !STOPWORDS.has(t),
  )
  return new Set(tokens)
}

/**
 * Fraccion de tokens de la query presentes en el candidato (0..1),
 * con bonus por tokens numericos y penalizacion si falta un token de modelo.
 */
export function scoreTokens(query: Set<string>, candidate: Set<string>): number {
  if (query.size === 0) return 0
  let matched = 0
  let numericBonus = 0
  let modelMiss = false
  for (const t of query) {
    if (candidate.has(t)) {
      matched++
      if (/^\d+$/.test(t)) numericBonus += 0.15
    } else if (isModelToken(t)) {
      modelMiss = true
    }
  }
  const base = matched / query.size + numericBonus
  return modelMiss ? base * 0.45 : base
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
