import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

export type CrmQuickStatItem = {
  icon: LucideIcon
  label: string
  value: string | number
}

type CrmQuickStatsRowProps = {
  items: CrmQuickStatItem[]
  className?: string
  /** When set, wraps the row in a landmark for screen readers */
  ariaLabel?: string
}

export function CrmQuickStatsRow({ items, className, ariaLabel }: CrmQuickStatsRowProps) {
  const cols =
    items.length <= 3 ? 'sm:grid-cols-3' : items.length === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3 lg:grid-cols-4'

  return (
    <div
      className={cn('grid gap-3', cols, className)}
      role={ariaLabel ? 'region' : undefined}
      aria-label={ariaLabel}
    >
      {items.map((it, i) => {
        const Icon = it.icon
        return (
          <div
            key={`${it.label}-${i}`}
            className="border-border/80 from-card to-muted/15 flex min-h-[4.5rem] items-center gap-3 rounded-xl border bg-gradient-to-br px-4 py-3 shadow-sm"
          >
            <div className="bg-primary/15 text-primary shrink-0 rounded-lg p-2">
              <Icon className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{it.label}</p>
              <p className="text-foreground text-2xl font-semibold tabular-nums">{it.value}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
