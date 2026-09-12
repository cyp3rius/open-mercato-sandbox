'use client'

import { useT } from '@open-mercato/shared/lib/i18n/context'
import { SettlementDriverNameLink } from './SettlementDriverNameLink'
import { SettlementStatusBadge } from './SettlementStatusBadge'
import { getMonthEnd } from '../lib/weekUtils'

type MonthlySettlementBasicsPanelProps = {
  teamMemberId: string
  monthStart: string
  status: string
  segmentsCount: number
  resolveDriverName: (teamMemberId: string) => string
  resolveDriverProfileId: (teamMemberId: string) => string | null
}

export function MonthlySettlementBasicsPanel({
  teamMemberId,
  monthStart,
  status,
  segmentsCount,
  resolveDriverName,
  resolveDriverProfileId,
}: MonthlySettlementBasicsPanelProps) {
  const t = useT()
  const monthLabel = `${monthStart.slice(0, 7)} (${monthStart} – ${getMonthEnd(monthStart)})`

  return (
    <section className="rounded-lg border bg-card px-4 py-3">
      <h2 className="text-sm font-semibold">{t('taxi_fleet.settlements.form.groups.basics', 'Basics')}</h2>
      <dl className="mt-3 grid grid-cols-6 gap-x-4 gap-y-4">
        <div className="col-span-3 min-w-0 space-y-1">
          <dt className="text-xs font-medium text-muted-foreground">
            {t('taxi_fleet.settlements.driver', 'Driver')}
          </dt>
          <dd className="text-sm">
            <SettlementDriverNameLink
              driverProfileId={resolveDriverProfileId(teamMemberId)}
              displayName={resolveDriverName(teamMemberId)}
            />
          </dd>
        </div>
        <div className="col-span-3 min-w-0 space-y-1">
          <dt className="text-xs font-medium text-muted-foreground">
            {t('taxi_fleet.settlements.status', 'Status')}
          </dt>
          <dd>
            <SettlementStatusBadge status={status} />
          </dd>
        </div>
        <div className="col-span-4 min-w-0 space-y-1">
          <dt className="text-xs font-medium text-muted-foreground">
            {t('taxi_fleet.monthlySettlements.month', 'Month')}
          </dt>
          <dd className="text-sm font-medium tabular-nums">{monthLabel}</dd>
        </div>
        <div className="col-span-2 min-w-0 space-y-1">
          <dt className="text-xs font-medium text-muted-foreground">
            {t('taxi_fleet.monthlySettlements.segments.count', 'Segments')}
          </dt>
          <dd className="text-sm font-medium tabular-nums">{segmentsCount}</dd>
        </div>
      </dl>
    </section>
  )
}
