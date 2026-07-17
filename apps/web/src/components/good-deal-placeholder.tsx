import { SparklesIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

export function GoodDealPlaceholder() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-card/60 p-5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
        <HugeiconsIcon icon={SparklesIcon} size={18} aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm font-medium text-foreground">¿Es buena oferta?</p>
        <p className="text-sm text-muted-foreground">
          Próximamente vamos a comparar el precio actual contra su histórico para decirte si es un
          buen momento para comprar.
        </p>
      </div>
    </div>
  )
}
