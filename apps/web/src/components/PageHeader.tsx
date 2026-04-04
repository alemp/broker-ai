import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export type PageHeaderBack = { to: string; label: string }

type PageHeaderProps = {
  back?: PageHeaderBack
  title: string
  titleLoading?: boolean
  description?: string
  className?: string
  children?: ReactNode
}

export function PageHeader({
  back,
  title,
  titleLoading,
  description,
  className,
  children,
}: PageHeaderProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {back ? (
        <Link
          to={back.to}
          className="text-muted-foreground hover:text-foreground inline-block text-sm font-medium"
        >
          ← {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          {titleLoading ? (
            <Skeleton className="h-8 w-56 max-w-full sm:w-72" />
          ) : (
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          )}
          {description && !titleLoading ? (
            <p className="text-muted-foreground max-w-2xl text-sm">{description}</p>
          ) : null}
        </div>
        {children ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
        ) : null}
      </div>
    </div>
  )
}
