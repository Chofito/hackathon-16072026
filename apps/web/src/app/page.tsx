import { HeroSearch } from '@/components/hero-search'
import { ProductGrid } from '@/components/product-grid'
import { EmptyState } from '@/components/empty-state'
import { SUPPORTED_STORES } from '@/lib/stores'
import { getTrackedProducts, getBestPricesForProducts, TRACKED_CATEGORIES } from '@/lib/queries'
import { WifiDisconnected02Icon } from '@hugeicons/core-free-icons'

// La página lee de Supabase en cada request: nunca se debe precomputar en build
// (donde las env vars todavía pueden no existir).
export const dynamic = 'force-dynamic'

interface HomePageProps {
  searchParams: Promise<{ categoria?: string }>
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { categoria } = await searchParams
  const category = TRACKED_CATEGORIES.includes(categoria as (typeof TRACKED_CATEGORIES)[number])
    ? categoria
    : undefined

  return (
    <div className="flex flex-1 flex-col">
      <section className="hero-atmosphere relative overflow-hidden border-b border-border">
        <div className="relative mx-auto flex max-w-5xl flex-col items-start gap-6 px-4 py-20 sm:px-6 sm:py-28">
          <h1 className="motion-safe:animate-fade-up font-display text-5xl leading-[0.92] font-semibold tracking-tight text-foreground sm:text-7xl lg:text-8xl">
            Guate<span className="text-primary">Ofertas</span>
          </h1>
          <p
            className="motion-safe:animate-fade-up max-w-md text-lg text-muted-foreground"
            style={{ animationDelay: '80ms' }}
          >
            Pegá el link de un producto y comparamos el precio entre las tiendas de Guatemala.
          </p>
          <div className="motion-safe:animate-fade-up w-full" style={{ animationDelay: '150ms' }}>
            <HeroSearch />
          </div>
          <ul
            aria-label="Tiendas soportadas"
            className="motion-safe:animate-fade-up flex flex-wrap gap-2"
            style={{ animationDelay: '220ms' }}
          >
            {SUPPORTED_STORES.map((store) => (
              <li
                key={store.name}
                className="rounded-md border border-border bg-card/70 px-2.5 py-1 text-xs font-medium text-muted-foreground"
              >
                {store.name}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <TrackedProductsSection category={category} />
    </div>
  )
}

async function TrackedProductsSection({ category }: { category?: string }) {
  const products = await getTrackedProducts(category).catch(() => null)
  if (products === null) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
        <ConnectionEmptyState />
      </div>
    )
  }
  const bestPrices = await getBestPricesForProducts(products.map((p) => p.id)).catch(
    () => new Map(),
  )
  return <ProductGrid products={products} bestPrices={bestPrices} activeCategory={category} />
}

function ConnectionEmptyState() {
  return (
    <EmptyState
      icon={WifiDisconnected02Icon}
      title="No pudimos conectar con la base de datos"
      description="Puede ser algo temporal de nuestro lado. Recargá la página en un momento."
    />
  )
}
