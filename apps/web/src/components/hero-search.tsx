'use client'

import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  Link04Icon,
  Loading03Icon,
} from '@hugeicons/core-free-icons'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { getSupabase } from '@/lib/supabase'
import { formatGTQ } from '@/lib/format'
import { resolveTrackedUrl } from '@/lib/actions'
import {
  type FindMatchesResponse,
  type MatchItem,
  type ProductDto,
  invokeEdge,
  isEdgeError,
  isFindMatchesResponse,
  isProductDto,
  storeKeyLabel,
} from '@/lib/edge-functions'
import { SUPPORTED_STORES, looksLikeUrl, matchSupportedStore, normalizeUrl } from '@/lib/stores'

type OnDemandResult =
  | { kind: 'invalid' }
  | { kind: 'unsupported' }
  | { kind: 'checking'; storeName: string }
  | { kind: 'fetching'; storeName: string }
  | { kind: 'matching'; storeName: string; source: ProductDto }
  | { kind: 'found'; source: ProductDto; matches: FindMatchesResponse['matches'] }
  | { kind: 'stale'; stores: string[] }
  | { kind: 'error'; storeName: string; message?: string }

const SUPPORTED_STORE_NAMES = SUPPORTED_STORES.map((store) => store.name).join(', ')

export function HeroSearch() {
  const router = useRouter()
  const inputId = useId()
  const [value, setValue] = useState('')
  const [result, setResult] = useState<OnDemandResult | null>(null)
  const isBusy =
    result?.kind === 'checking' ||
    result?.kind === 'fetching' ||
    result?.kind === 'matching'

  async function runLookup(rawValue: string, storeName: string) {
    const url = normalizeUrl(rawValue)

    setResult({ kind: 'checking', storeName })
    const tracked = await resolveTrackedUrl(url).catch(() => null)
    if (tracked) {
      router.push(`/producto/${tracked.productId}`)
      return
    }

    setResult({ kind: 'fetching', storeName })
    const supabase = getSupabase()

    try {
      const { data: fetchData, networkError: fetchNet } = await invokeEdge(
        supabase,
        'fetch-product',
        { url },
      )
      if (fetchNet) {
        setResult({ kind: 'error', storeName })
        return
      }
      if (isEdgeError(fetchData)) {
        setResult({ kind: 'error', storeName, message: fetchData.error })
        return
      }
      if (!isProductDto(fetchData)) {
        setResult({ kind: 'error', storeName })
        return
      }

      setResult({ kind: 'matching', storeName, source: fetchData })

      const { data: matchData, networkError: matchNet } = await invokeEdge(
        supabase,
        'find-matches',
        { url, topN: 3 },
      )
      if (matchNet) {
        setResult({ kind: 'error', storeName })
        return
      }
      if (isEdgeError(matchData)) {
        if (matchData.error === 'sitemap_cache_stale' && matchData.stores?.length) {
          setResult({ kind: 'stale', stores: matchData.stores })
          return
        }
        setResult({ kind: 'error', storeName, message: matchData.error })
        return
      }
      if (!isFindMatchesResponse(matchData)) {
        setResult({ kind: 'error', storeName })
        return
      }

      setResult({
        kind: 'found',
        source: matchData.source,
        matches: matchData.matches,
      })
    } catch {
      setResult({ kind: 'error', storeName })
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || isBusy) return

    if (!looksLikeUrl(trimmed)) {
      setResult({ kind: 'invalid' })
      return
    }

    const store = matchSupportedStore(trimmed)
    if (!store) {
      setResult({ kind: 'unsupported' })
      return
    }

    void runLookup(trimmed, store.name)
  }

  return (
    <div className="w-full max-w-xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor={inputId} className="sr-only">
            Pegar link de un producto de MAX, Kemik, Pacifiko o Curacao
          </label>
          <HugeiconsIcon
            icon={Link04Icon}
            size={18}
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id={inputId}
            name="url"
            type="url"
            inputMode="url"
            autoComplete="off"
            enterKeyHint="go"
            placeholder="Pegá el link del producto (MAX, Kemik, Pacifiko o Curacao)"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="h-12 rounded-lg pl-10 pr-4 text-base"
          />
        </div>
        <Button type="submit" size="lg" disabled={isBusy} className="h-12 rounded-lg px-6 text-sm">
          {isBusy ? (
            <>
              <HugeiconsIcon
                icon={Loading03Icon}
                size={16}
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
              {result?.kind === 'checking'
                ? 'Verificando…'
                : result?.kind === 'fetching'
                  ? 'Consultando…'
                  : 'Buscando…'}
            </>
          ) : (
            'Comparar precios'
          )}
        </Button>
      </form>

      <div role="status" aria-live="polite" className="mt-3 min-h-6">
        {result ? <OnDemandStatus result={result} /> : null}
      </div>
    </div>
  )
}

function OnDemandStatus({ result }: { result: OnDemandResult }) {
  if (result.kind === 'invalid') {
    return (
      <StatusCard tone="muted">
        Eso no parece un link. Pegá la URL completa de un producto de{' '}
        <strong className="text-foreground">{SUPPORTED_STORE_NAMES}</strong>.
      </StatusCard>
    )
  }

  if (result.kind === 'unsupported') {
    return (
      <StatusCard tone="muted">
        Por ahora solo comparamos precios de{' '}
        <strong className="text-foreground">{SUPPORTED_STORE_NAMES}</strong>.
      </StatusCard>
    )
  }

  if (result.kind === 'checking' || result.kind === 'fetching' || result.kind === 'matching') {
    const label =
      result.kind === 'checking'
        ? 'Viendo si ya tenemos ese producto…'
        : result.kind === 'fetching'
          ? `Consultando ${result.storeName}…`
          : `Buscando en otras tiendas… (${result.source.rawName})`
    return (
      <StatusCard tone="muted" loading>
        {label}
      </StatusCard>
    )
  }

  if (result.kind === 'stale') {
    return (
      <StatusCard tone="error">
        El índice de productos aún no está listo para{' '}
        {result.stores.map(storeKeyLabel).join(', ')}. Probá de nuevo en unos minutos.
      </StatusCard>
    )
  }

  if (result.kind === 'error') {
    return (
      <StatusCard tone="error">
        {result.message
          ? `No pudimos completar la búsqueda: ${result.message}`
          : `No pudimos leer ${result.storeName} ahora mismo. Probá de nuevo en unos minutos.`}
      </StatusCard>
    )
  }

  return <FoundResults source={result.source} matches={result.matches} />
}

function FoundResults({
  source,
  matches,
}: {
  source: ProductDto
  matches: FindMatchesResponse['matches']
}) {
  const otherStores = Object.entries(matches).filter(([, items]) => items.length > 0)

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-secondary px-4 py-3 text-sm text-secondary-foreground">
      <p className="flex items-start gap-2">
        <HugeiconsIcon
          icon={CheckmarkCircle02Icon}
          size={18}
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-primary"
        />
        <span>
          <strong className="text-foreground">{source.rawName}</strong>
          <br />
          {storeKeyLabel(source.store)}:{' '}
          <strong className="text-coral-ink tabular-nums">{formatGTQ(source.price)}</strong>
        </span>
      </p>

      {otherStores.length === 0 ? (
        <p className="text-muted-foreground">Sin coincidencias claras en las otras tiendas.</p>
      ) : (
        <ul className="space-y-2 border-t border-primary/20 pt-3">
          {otherStores.map(([storeKey, items]) => (
            <li key={storeKey}>
              <p className="font-medium text-foreground">{storeKeyLabel(storeKey)}</p>
              <ul className="mt-1 space-y-1">
                {items.map((item) => (
                  <MatchRow key={item.url} item={item} />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function MatchRow({ item }: { item: MatchItem }) {
  const flag = item.confident ? '✓' : '?'
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 text-muted-foreground">
      <span aria-hidden="true">{flag}</span>
      <span className="tabular-nums text-foreground">{formatGTQ(item.product.price)}</span>
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 truncate text-primary underline-offset-2 hover:underline"
      >
        {item.product.rawName}
      </a>
    </li>
  )
}

function StatusCard({
  children,
  tone,
  loading,
}: {
  children: ReactNode
  tone: 'muted' | 'error'
  loading?: boolean
}) {
  const icon = loading ? Loading03Icon : Alert02Icon
  const base =
    tone === 'error'
      ? 'border-destructive/30 bg-destructive/10 text-destructive'
      : 'border-border bg-card text-muted-foreground'

  return (
    <p className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${base}`}>
      <HugeiconsIcon
        icon={icon}
        size={18}
        aria-hidden="true"
        className={`mt-0.5 shrink-0 ${loading ? 'animate-spin text-primary motion-reduce:animate-none' : tone === 'error' ? '' : 'text-primary'}`}
      />
      <span>{children}</span>
    </p>
  )
}
