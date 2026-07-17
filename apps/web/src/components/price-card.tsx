import { Loading03Icon, StoreLocation01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import type { StorePriceInfo } from '@/lib/queries'
import { formatCapturedAt, formatGTQ, stockLabel } from '@/lib/format'
import { Badge } from '@/components/ui/badge'

export function PriceCard({ info }: { info: StorePriceInfo }) {
  const { store, storeProduct, latestPricePoint } = info

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <HugeiconsIcon
            icon={StoreLocation01Icon}
            size={16}
            aria-hidden="true"
            className="text-primary"
          />
          {store.name}
        </span>
        {latestPricePoint ? (
          <Badge variant={latestPricePoint.stock_status === 'out_of_stock' ? 'muted' : 'secondary'}>
            {stockLabel(latestPricePoint.stock_status)}
          </Badge>
        ) : null}
      </div>

        <div className="market-rule mt-3" aria-hidden="true" />

      <div className="flex flex-1 flex-col gap-2 px-4 py-4">
        {latestPricePoint ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums text-accent">
                {formatGTQ(latestPricePoint.price)}
              </span>
              {latestPricePoint.list_price ? (
                <span className="text-sm tabular-nums text-muted-foreground line-through">
                  {formatGTQ(latestPricePoint.list_price)}
                </span>
              ) : null}
            </div>
            {latestPricePoint.conditional_price ? (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-coral-ink">
                  {formatGTQ(latestPricePoint.conditional_price)}
                </span>{' '}
                {latestPricePoint.conditional_price_note ?? 'con condición especial'}
              </p>
            ) : null}
            <p className="mt-auto text-xs text-muted-foreground">
              Visto el {formatCapturedAt(latestPricePoint.captured_at)}
            </p>
          </>
        ) : storeProduct ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <HugeiconsIcon
              icon={Loading03Icon}
              size={16}
              aria-hidden="true"
              className="shrink-0 animate-spin motion-reduce:animate-none"
            />
            Encontramos el producto en {store.name}, buscando el precio…
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Buscando en {store.name}…</p>
        )}
      </div>

      {storeProduct ? (
        <a
          href={storeProduct.url}
          target="_blank"
          rel="noopener noreferrer"
          className="border-t border-border px-4 py-2.5 text-center text-sm font-medium text-primary transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
        >
          Ver en {store.name} ↗
        </a>
      ) : null}
    </div>
  )
}
