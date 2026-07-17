import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import { getProductById, getProductVariants, getStorePricesForProduct } from '@/lib/queries'
import type { Product } from '@/lib/queries'
import { categoryLabel } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/empty-state'
import { WifiDisconnected02Icon } from '@hugeicons/core-free-icons'
import { VariantChips } from '@/components/variant-chips'
import { PriceCard } from '@/components/price-card'
import { HistoryPlaceholder } from '@/components/history-placeholder'
import { GoodDealPlaceholder } from '@/components/good-deal-placeholder'

export const dynamic = 'force-dynamic'

interface ProductPageProps {
  params: Promise<{ id: string }>
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params
  // Distinguir "la DB no respondió" (estado de conexión) de "el producto no
  // existe" (404): un fallo de conexión no debe responder notFound.
  let product: Product | null
  try {
    product = await getProductById(id)
  } catch {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-16 sm:px-6">
        <EmptyState
          icon={WifiDisconnected02Icon}
          title="No pudimos conectar con la base de datos"
          description="Puede ser algo temporal de nuestro lado. Recargá la página en un momento."
        />
      </div>
    )
  }
  if (!product) notFound()

  const [variants, storePrices] = await Promise.all([
    getProductVariants(product.id).catch(() => []),
    getStorePricesForProduct(product.id).catch(() => []),
  ])

  const pendingStores = storePrices.filter((info) => !info.latestPricePoint)

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
      >
        <HugeiconsIcon icon={ArrowLeft02Icon} size={16} aria-hidden="true" />
        Volver al catálogo
      </Link>

      <header className="flex flex-col gap-3">
        <Badge variant="muted" className="self-start">
          {categoryLabel(product.category)}
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground text-balance sm:text-4xl">
          {product.canonical_name}
        </h1>
        <p className="text-base text-muted-foreground">
          {product.brand}
          {product.model ? ` · ${product.model}` : ''}
        </p>
        <VariantChips variants={variants} />
      </header>

      <section aria-labelledby="precios-heading" className="mt-10">
        <h2 id="precios-heading" className="mb-4 text-xl font-semibold text-foreground">
          Precios por tienda
        </h2>
        {storePrices.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card/60 px-4 py-6 text-sm text-muted-foreground">
            Todavía no tenemos tiendas activas registradas para comparar este producto.
          </p>
        ) : (
          <>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {storePrices.map((info) => (
                <li key={info.store.id} className="list-none">
                  <PriceCard info={info} />
                </li>
              ))}
            </ul>
            {pendingStores.length > 0 && pendingStores.length < storePrices.length ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Ya tenemos precio en {storePrices.length - pendingStores.length} de{' '}
                {storePrices.length} tiendas — buscando en las demás…
              </p>
            ) : null}
          </>
        )}
      </section>

      <section aria-labelledby="historico-heading" className="mt-10">
        <h2 id="historico-heading" className="mb-4 text-xl font-semibold text-foreground">
          Histórico
        </h2>
        <HistoryPlaceholder />
      </section>

      <section className="mt-6">
        <GoodDealPlaceholder />
      </section>
    </div>
  )
}
