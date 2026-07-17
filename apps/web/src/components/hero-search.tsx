'use client'

import { useId, useState, type FormEvent } from 'react'
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
import { SUPPORTED_STORES, looksLikeUrl, matchSupportedStore, normalizeUrl } from '@/lib/stores'

type OnDemandResult =
  | { kind: 'invalid' }
  | { kind: 'unsupported' }
  | { kind: 'checking'; storeName: string }
  | { kind: 'pending'; storeName: string }
  | { kind: 'success'; storeName: string; price: number }
  | { kind: 'partial'; storeName: string }
  | { kind: 'error'; storeName: string }

const SUPPORTED_STORE_NAMES = SUPPORTED_STORES.map((store) => store.name).join(', ')

export function HeroSearch() {
  const router = useRouter()
  const inputId = useId()
  const [value, setValue] = useState('')
  const [result, setResult] = useState<OnDemandResult | null>(null)
  const isBusy = result?.kind === 'checking' || result?.kind === 'pending'

  async function runLookup(rawValue: string, storeName: string) {
    const url = normalizeUrl(rawValue)

    setResult({ kind: 'checking', storeName })
    const tracked = await resolveTrackedUrl(url).catch(() => null)
    if (tracked) {
      router.push(`/producto/${tracked.productId}`)
      return
    }

    setResult({ kind: 'pending', storeName })
    try {
      const supabase = getSupabase()
      const { data, error } = await supabase.functions.invoke('fetch-product', {
        body: { url },
      })
      if (error) throw error

      const payload = data as
        | { parsed?: { price?: number | null } | null; productId?: string; product_id?: string }
        | null
      const productId = payload?.productId ?? payload?.product_id
      if (typeof productId === 'string' && productId) {
        router.push(`/producto/${productId}`)
        return
      }

      const price = payload?.parsed?.price
      if (typeof price === 'number') {
        setResult({ kind: 'success', storeName, price })
      } else {
        setResult({ kind: 'partial', storeName })
      }
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
              {result?.kind === 'checking' ? 'Verificando…' : 'Consultando…'}
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
      <p className="flex items-start gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <HugeiconsIcon
          icon={Alert02Icon}
          size={18}
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-primary"
        />
        <span>
          Eso no parece un link. Pegá la URL completa de un producto de{' '}
          <strong className="text-foreground">{SUPPORTED_STORE_NAMES}</strong>.
        </span>
      </p>
    )
  }

  if (result.kind === 'unsupported') {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <HugeiconsIcon
          icon={Alert02Icon}
          size={18}
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-primary"
        />
        <span>
          Por ahora solo comparamos precios de{' '}
          <strong className="text-foreground">{SUPPORTED_STORE_NAMES}</strong>. Pegá un link de
          alguna de esas tiendas.
        </span>
      </p>
    )
  }

  if (result.kind === 'checking') {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <HugeiconsIcon
          icon={Loading03Icon}
          size={18}
          aria-hidden="true"
          className="shrink-0 animate-spin text-primary motion-reduce:animate-none"
        />
        Viendo si ya tenemos ese producto…
      </p>
    )
  }

  if (result.kind === 'pending') {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <HugeiconsIcon
          icon={Loading03Icon}
          size={18}
          aria-hidden="true"
          className="shrink-0 animate-spin text-primary motion-reduce:animate-none"
        />
        Consultando {result.storeName}…
      </p>
    )
  }

  if (result.kind === 'success') {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-primary/30 bg-secondary px-4 py-3 text-sm text-secondary-foreground">
        <HugeiconsIcon
          icon={CheckmarkCircle02Icon}
          size={18}
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-primary"
        />
        <span>
          Precio de {result.storeName}: <strong className="text-coral-ink tabular-nums">{formatGTQ(result.price)}</strong>{' '}
          — buscando en las otras tiendas…
        </span>
      </p>
    )
  }

  if (result.kind === 'partial') {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-primary/30 bg-secondary px-4 py-3 text-sm text-secondary-foreground">
        <HugeiconsIcon
          icon={CheckmarkCircle02Icon}
          size={18}
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-primary"
        />
        <span>Encontramos {result.storeName} — buscando en las otras tiendas…</span>
      </p>
    )
  }

  return (
    <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <HugeiconsIcon icon={Alert02Icon} size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
      <span>No pudimos leer {result.storeName} ahora mismo. Probá de nuevo en unos minutos.</span>
    </p>
  )
}
