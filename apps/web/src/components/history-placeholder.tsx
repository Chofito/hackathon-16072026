import { ChartLineData01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

export function HistoryPlaceholder() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/60 p-6">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <HugeiconsIcon
          icon={ChartLineData01Icon}
          size={18}
          aria-hidden="true"
          className="text-primary"
        />
        Histórico de precio
      </div>
      <div
        aria-hidden="true"
        className="mt-4 flex h-32 items-end gap-1.5 border-b border-dashed border-border pb-2 sm:h-40"
      >
        {[18, 26, 22, 30, 24, 34, 28, 20].map((height, index) => (
          <span
            key={index}
            className="flex-1 rounded-t-sm bg-muted"
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        El histórico arranca desde ahora — todavía no hay capturas para este producto. En cuanto el
        colector registre su primer precio, vas a ver la gráfica aquí.
      </p>
    </div>
  )
}
