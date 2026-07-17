import Link from 'next/link'
import { SaleTag01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import type { Product, ProductBestPrice } from '@/lib/queries'
import { categoryLabel, formatGTQ } from '@/lib/format'
import { Badge } from '@/components/ui/badge'

export function ProductCard({
  product,
  bestPrice,
}: {
  product: Product
  bestPrice?: ProductBestPrice
}) {
  return (
    <li className="list-none">
      <Link
        href={`/producto/${product.id}`}
        className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
      >
        <div className="flex flex-1 flex-col gap-2 px-4 pt-4">
          <Badge variant="muted" className="self-start">
            {categoryLabel(product.category)}
          </Badge>
          <p className="line-clamp-2 text-base font-semibold text-foreground text-balance">
            {product.canonical_name}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {product.brand}
            {product.model ? ` · ${product.model}` : ''}
          </p>
        </div>
        <div className="market-rule mt-3" aria-hidden="true" />
        <div className="flex items-center justify-between px-4 py-3">
          {bestPrice ? (
            <span className="text-sm text-muted-foreground">
              Desde{' '}
              <strong className="tabular-nums text-coral-ink">{formatGTQ(bestPrice.price)}</strong>
              <span className="text-xs"> en {bestPrice.storeName}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <HugeiconsIcon icon={SaleTag01Icon} size={16} aria-hidden="true" />
              Sin precio aún
            </span>
          )}
          <span className="text-sm font-medium text-primary group-hover:underline">
            Ver detalle
          </span>
        </div>
      </Link>
    </li>
  )
}
