// Tiendas soportadas por el flujo on-demand. La deteccion es por dominio del
// link que el usuario pega en el buscador (docs/SCRAPING.md).
export interface SupportedStore {
  name: string
  hostname: string
  baseUrl: string
}

export const SUPPORTED_STORES: readonly SupportedStore[] = [
  { name: 'MAX', hostname: 'max.com.gt', baseUrl: 'https://www.max.com.gt' },
  { name: 'Kemik', hostname: 'kemik.gt', baseUrl: 'https://www.kemik.gt' },
  { name: 'Pacifiko', hostname: 'pacifiko.com', baseUrl: 'https://pacifiko.com' },
  {
    name: 'Curacao',
    hostname: 'lacuracaonline.com',
    baseUrl: 'https://www.lacuracaonline.com/guatemala',
  },
]

/** true si el texto tiene forma de URL (con o sin protocolo). */
export function looksLikeUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed || /\s/.test(trimmed)) return false
  return /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/.*)?$/i.test(trimmed)
}

function toUrl(value: string): URL | null {
  const trimmed = value.trim()
  try {
    return new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }
}

/** Encuentra la tienda soportada cuyo dominio coincide con la URL dada. */
export function matchSupportedStore(value: string): SupportedStore | null {
  const url = toUrl(value)
  if (!url) return null
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  return (
    SUPPORTED_STORES.find(
      (store) => host === store.hostname || host.endsWith(`.${store.hostname}`),
    ) ?? null
  )
}

/** Normaliza el input a una URL con protocolo, para invocar la Edge Function. */
export function normalizeUrl(value: string): string {
  const url = toUrl(value)
  return url ? url.toString() : value.trim()
}
