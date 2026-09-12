'use client'

import { useT } from '@open-mercato/shared/lib/i18n/context'
import { formatPercentDisplay } from '@open-mercato/shared/lib/numeric'
import type { SettlementFormValues } from './settlementFormConfig'
import { SettlementDriverNameLink } from './SettlementDriverNameLink'
import { SettlementStatusBadge } from './SettlementStatusBadge'
import { formatWeekRange } from '../lib/weekUtils'

type SettlementBasicsPanelProps = {
  values: Pick<SettlementFormValues, 'teamMemberId' | 'weekStart' | 'status' | 'payoutPercent'>
  resolveDriverName: (teamMemberId: string) => string
  resolveDriverProfileId: (teamMemberId: string) => string | null
  payoutMeta?: Record<string, unknown> | null
}

function parseTierAmount(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function formatTierAmountPln(value: number, currency = 'PLN'): string {
  const amount = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
  return `${amount} ${currency}`
}

/** Open lower (0/null) → `< to PLN`; open upper → `> from PLN`; else `from–to PLN`. */
export function formatMatchedPayoutTierRange(
  fromAmount: unknown,
  toAmount: unknown,
  currency = 'PLN',
): string {
  const from = parseTierAmount(fromAmount)
  const to = parseTierAmount(toAmount)
  const openFrom = from == null || from === 0
  const openTo = to == null

  if (openFrom && !openTo) {
    return `< ${formatTierAmountPln(to, currency)}`
  }
  if (!openFrom && openTo) {
    return `> ${formatTierAmountPln(from, currency)}`
  }
  if (openFrom && openTo) {
    return ''
  }
  return `${formatTierAmountPln(from!, currency)}–${formatTierAmountPln(to!, currency)}`
}

export function SettlementBasicsPanel({
  values,
  resolveDriverName,
  resolveDriverProfileId,
  payoutMeta = null,
}: SettlementBasicsPanelProps) {
  const t = useT()
  const payoutPercent = values.payoutPercent
  const mode = typeof payoutMeta?.mode === 'string' ? payoutMeta.mode : null
  const matched = payoutMeta?.matchedTier
  const matchedRecord =
    matched && typeof matched === 'object' ? (matched as Record<string, unknown>) : null

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
                driverProfileId={resolveDriverProfileId(values.teamMemberId)}
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
            {payoutPercent != null && String(payoutPercent).trim().length > 0
              ? formatPercentDisplay(payoutPercent)
              : '—'}
            {mode === 'tiered' ? (
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                {(() => {
                  const range = matchedRecord
                    ? formatMatchedPayoutTierRange(matchedRecord.fromAmount, matchedRecord.toAmount)
                    : ''
                  if (range) {
                    return `${t('taxi_fleet.settlements.payoutMode.tieredMatched', 'Tier:')} ${range}`
                  }
                  return t('taxi_fleet.settlements.payoutMode.tiered', 'Tiered')
                })()}
              </span>
            ) : null}
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
