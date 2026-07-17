import type { ProductVariant } from '@/lib/queries'

export function VariantChips({ variants }: { variants: ProductVariant[] }) {
  if (variants.length === 0) return null

  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Variantes disponibles">
      {variants.map((variant) => (
        <li
          key={variant.id}
          className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground"
        >
          {variant.variant_value}
        </li>
      ))}
    </ul>
  )
}
