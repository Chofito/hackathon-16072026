import Link from 'next/link'
import { Package02Icon } from '@hugeicons/core-free-icons'

import type { Product, ProductBestPrice } from '@/lib/queries'
import { TRACKED_CATEGORIES } from '@/lib/queries'
import { categoryLabel } from '@/lib/format'
import { cn } from '@/lib/utils'
import { CatalogSearch } from '@/components/catalog-search'
import { EmptyState } from '@/components/empty-state'

interface ProductGridProps {
  products: Product[]
  bestPrices?: Map<string, ProductBestPrice>
  activeCategory?: string
}

export function ProductGrid({ products, bestPrices, activeCategory }: ProductGridProps) {
  const tabs: { value?: string; label: string }[] = [
    { value: undefined, label: 'Todos' },
    ...TRACKED_CATEGORIES.map((category) => ({ value: category, label: categoryLabel(category) })),
  ]

  return (
    <section
      aria-labelledby="catalogo-heading"
      className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6"
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h2 id="catalogo-heading" className="text-2xl font-semibold text-foreground">
          Productos trackeados
        </h2>
        <nav aria-label="Filtrar por categoría" className="flex flex-wrap gap-1.5">
          {tabs.map((tab) => {
            const isActive = tab.value === activeCategory
            const href = tab.value ? `/?categoria=${tab.value}` : '/'
            return (
              <Link
                key={tab.label}
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none',
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
                )}
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={Package02Icon}
          title="Aún no hay precios"
          description="El colector está arrancando: ya tenemos el catálogo curado, pronto vas a ver precios de las 4 tiendas aquí."
        />
      ) : (
        <CatalogSearch
          products={products}
          bestPrices={
            bestPrices
              ? Object.fromEntries(bestPrices.entries())
              : undefined
          }
        />
      )}
    </section>
  )
}
