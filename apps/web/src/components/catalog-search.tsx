'use client'

import { useId, useMemo, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Package02Icon, Search01Icon } from '@hugeicons/core-free-icons'

import type { Product, ProductBestPrice } from '@/lib/queries'
import { Input } from '@/components/ui/input'
import { ProductCard } from '@/components/product-card'
import { EmptyState } from '@/components/empty-state'

function matchesQuery(product: Product, query: string): boolean {
  const haystack = [product.canonical_name, product.brand, product.model, product.category]
    .join(' ')
    .toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token))
}

export function CatalogSearch({
  products,
  bestPrices,
}: {
  products: Product[]
  bestPrices?: Record<string, ProductBestPrice>
}) {
  const inputId = useId()
  const [query, setQuery] = useState('')
  const filtered = useMemo(
    () => (query.trim() ? products.filter((product) => matchesQuery(product, query.trim())) : products),
    [products, query],
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="relative max-w-md">
        <label htmlFor={inputId} className="sr-only">
          Buscar en productos trackeados
        </label>
        <HugeiconsIcon
          icon={Search01Icon}
          size={18}
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={inputId}
          type="search"
          autoComplete="off"
          placeholder="Buscar trackeados (ej. Switch 2, A56…)"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-11 rounded-lg pl-10 pr-4"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Package02Icon}
          title={query.trim() ? 'Sin resultados' : 'Aún no hay precios'}
          description={
            query.trim()
              ? `No hay productos trackeados que coincidan con “${query.trim()}”. Probá con otra marca o modelo.`
              : 'El colector está arrancando: ya tenemos el catálogo curado, pronto vas a ver precios de las 4 tiendas aquí.'
          }
        />
      ) : (
        <>
          {query.trim() ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {filtered.length} de {products.length} productos
            </p>
          ) : null}
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                bestPrice={bestPrices?.[product.id]}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
