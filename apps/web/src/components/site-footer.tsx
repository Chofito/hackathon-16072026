export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:px-6">
        <p>
          <span className="font-medium text-foreground">GuateOfertas</span> compara precios en MAX,
          Kemik, Pacifiko y Curacao para que decidas mejor.
        </p>
        <p className="text-xs">
          Los precios se capturan periódicamente y pueden variar en la tienda. Verificá el precio
          final antes de comprar.
        </p>
      </div>
    </footer>
  )
}
