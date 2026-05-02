import * as React from 'react'
import { cn } from '@open-mercato/shared/lib/utils'

export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('space-y-6', className)}>{children}</div>
}

/**
 * Page title row: title and optional description on the left, optional **actions on the right**
 * (`sm:justify-between`). Use for backend hub and detail shells — place primary/secondary buttons
 * and icon+label links in `actions` (e.g. `Button asChild` + `Link` with a leading `lucide-react` icon).
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-semibold leading-tight">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground mt-1">{description}</p> : null}
      </div>
      {actions ? (
        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:shrink-0">{actions}</div>
      ) : null}
    </div>
  )
}

export function PageBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('space-y-4', className)}>{children}</div>
}
