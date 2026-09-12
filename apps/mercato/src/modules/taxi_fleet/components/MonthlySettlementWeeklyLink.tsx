'use client'

import { ExternalLink } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { TAXI_FLEET_BASE } from '../backend/taxi-fleet/paths'
import { formatWeekRange } from '../lib/weekUtils'

type MonthlySettlementWeeklyLinkProps = {
  weeklySettlementId: string | null | undefined
  weekStart: string | null | undefined
}

export function MonthlySettlementWeeklyLink({
  weeklySettlementId,
  weekStart,
}: MonthlySettlementWeeklyLinkProps) {
  const t = useT()
  if (!weeklySettlementId) return <span className="text-muted-foreground">-</span>

  const label = weekStart
    ? formatWeekRange(weekStart)
    : t('taxi_fleet.monthlySettlements.weeklyLink.open', 'Weekly settlement')

  return (
    <a
      href={`${TAXI_FLEET_BASE}/settlements/${encodeURIComponent(weeklySettlementId)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-primary hover:underline"
    >
      <span className="tabular-nums">{label}</span>
      <ExternalLink className="size-3 shrink-0" aria-hidden />
      <span className="sr-only">
        {t('taxi_fleet.monthlySettlements.weeklyLink.newWindow', 'Opens in a new window')}
      </span>
    </a>
  )
}
