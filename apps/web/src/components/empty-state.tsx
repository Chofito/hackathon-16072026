import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'

import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: IconSvgElement
  title: string
  description: string
  className?: string
}

export function EmptyState({ icon, title, description, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/60 px-6 py-12 text-center',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-11 items-center justify-center rounded-full bg-secondary text-primary"
      >
        <HugeiconsIcon icon={icon} size={22} />
      </span>
      <p className="text-base font-medium text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
