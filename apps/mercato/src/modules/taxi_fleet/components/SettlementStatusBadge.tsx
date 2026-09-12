'use client'

import { Badge } from '@open-mercato/ui/primitives/badge'
import { useTaxiFleetLabels } from './useTaxiFleetLabels'

const statusBadgeClass: Record<string, string> = {
  draft: 'border-border bg-muted/40 text-muted-foreground',
  submitted: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100',
  approved: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100',
  paid: 'border-slate-300 bg-slate-100 text-slate-900 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100',
}

type SettlementStatusBadgeProps = {
  status: string
}

export function SettlementStatusBadge({ status }: SettlementStatusBadgeProps) {
  const { resolveSettlementStatusLabel } = useTaxiFleetLabels()
  const badgeClass = statusBadgeClass[status] ?? statusBadgeClass.draft

  return (
    <Badge variant="outline" className={badgeClass}>
      {resolveSettlementStatusLabel(status)}
    </Badge>
  )
}
