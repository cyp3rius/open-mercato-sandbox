'use client'

import * as React from 'react'
import { Activity, CheckCircle2, XCircle } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'

export type CaseStatusBadgeProps = {
  statusValue: string | null | undefined
  className?: string
}

export function CaseStatusBadge({ statusValue, className }: CaseStatusBadgeProps) {
  const t = useT()
  const raw = typeof statusValue === 'string' ? statusValue.trim() : ''
  const key = raw.length ? raw : ''

  if (key === 'open') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border border-amber-500/35 bg-amber-500/12 px-2 py-0.5 text-xs font-medium text-amber-950 dark:text-amber-100',
          className,
        )}
      >
        <Activity className="size-3.5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
        {t('cases.status.open', 'Open')}
      </span>
    )
  }

  if (key === 'closed') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border border-emerald-600/35 bg-emerald-600/12 px-2 py-0.5 text-xs font-medium text-emerald-950 dark:text-emerald-100',
          className,
        )}
      >
        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden />
        {t('cases.status.closed', 'Closed')}
      </span>
    )
  }

  if (key === 'aborted') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border border-red-600/35 bg-red-600/12 px-2 py-0.5 text-xs font-medium text-red-950 dark:text-red-100',
          className,
        )}
      >
        <XCircle className="size-3.5 shrink-0 text-red-700 dark:text-red-300" aria-hidden />
        {t('cases.status.aborted', 'Rejected')}
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border border-border bg-muted/40 px-2 py-0.5 font-mono text-xs text-foreground',
        className,
      )}
    >
      {key.length ? key : '—'}
    </span>
  )
}
