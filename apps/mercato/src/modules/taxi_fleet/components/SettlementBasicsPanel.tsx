'use client'

import { useT } from '@open-mercato/shared/lib/i18n/context'
import { formatPercentDisplay } from '@open-mercato/shared/lib/numeric'
import type { SettlementFormValues } from './settlementFormConfig'
import { SettlementDriverNameLink } from './SettlementDriverNameLink'
import { SettlementStatusBadge } from './SettlementStatusBadge'
import { formatWeekRange } from '../lib/weekUtils'

type SettlementBasicsPanelProps = {
  values: Pick<SettlementFormValues, 'teamMemberId' | 'weekStart' | 'status'>
  resolveDriverName: (teamMemberId: string) => string
  resolvePayoutPercent: (teamMemberId: string) => string | null
}

export function SettlementBasicsPanel({
  values,
  resolveDriverName,
  resolvePayoutPercent,
}: SettlementBasicsPanelProps) {
  const t = useT()
  const payoutPercent =
    values.teamMemberId.length > 0 ? resolvePayoutPercent(values.teamMemberId) : null

  return (
    <section className="rounded-lg border bg-card px-4 py-3">
      <h2 className="text-sm font-semibold">{t('taxi_fleet.settlements.form.groups.basics', 'Basics')}</h2>
      <dl className="mt-3 grid grid-cols-6 gap-x-4 gap-y-4">
        <div className="col-span-3 min-w-0 space-y-1">
          <dt className="text-xs font-medium text-muted-foreground">
            {t('taxi_fleet.settlements.driver', 'Driver')}
          </dt>
          <dd className="text-sm">
            {values.teamMemberId ? (
              <SettlementDriverNameLink
                teamMemberId={values.teamMemberId}
                displayName={resolveDriverName(values.teamMemberId)}
              />
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </dd>
        </div>
        <div className="col-span-3 min-w-0 space-y-1">
          <dt className="text-xs font-medium text-muted-foreground">
            {t('taxi_fleet.settlements.payoutPercent', 'Payout percent')}
          </dt>
          <dd className="text-sm font-medium tabular-nums">
            {payoutPercent != null && payoutPercent.trim().length > 0
              ? formatPercentDisplay(payoutPercent)
              : '—'}
          </dd>
        </div>
        <div className="col-span-4 min-w-0 space-y-1">
          <dt className="text-xs font-medium text-muted-foreground">
            {t('taxi_fleet.settlements.week', 'Week')}
          </dt>
          <dd className="text-sm font-medium tabular-nums">{formatWeekRange(values.weekStart)}</dd>
        </div>
        <div className="col-span-2 min-w-0 space-y-1">
          <dt className="text-xs font-medium text-muted-foreground">
            {t('taxi_fleet.settlements.status', 'Status')}
          </dt>
          <dd>
            <SettlementStatusBadge status={values.status} />
          </dd>
        </div>
      </dl>
    </section>
  )
}
