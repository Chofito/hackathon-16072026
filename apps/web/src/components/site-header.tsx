import Link from 'next/link'

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="font-display flex items-center gap-1.5 rounded-md text-lg font-semibold tracking-tight text-foreground focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
        >
          Guate
          <span className="text-primary">Ofertas</span>
        </Link>
        <nav aria-label="Tiendas trackeadas" className="hidden sm:block">
          <p className="text-xs text-muted-foreground">
            MAX &middot; Kemik &middot; Pacifiko &middot; Curacao
          </p>
        </nav>
      </div>
    </header>
  )
}
