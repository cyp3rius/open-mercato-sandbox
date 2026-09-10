'use client'

import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { MonthlySettlementSegment } from '../lib/monthlySettlementSnapshot'
import { getWeekEnd } from '../lib/weekUtils'
import { MonthlySettlementWeeklyLink } from './MonthlySettlementWeeklyLink'

type MonthlySettlementSegmentsPanelProps = {
  segments: MonthlySettlementSegment[]
}

function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PLN`
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`
}

function isTrailingPartialWeek(segment: MonthlySettlementSegment): boolean {
  if (segment.kind !== 'week' || !segment.weekStart) return false
  return segment.dateTo < getWeekEnd(segment.weekStart)
}

function sumSegments(segments: MonthlySettlementSegment[]) {
  return segments.reduce(
    (acc, segment) => {
      acc.revenueGross += segment.revenueGross
      acc.revenueNet += segment.revenueNet
      acc.costsGross += segment.costsGross
      acc.costsNet += segment.costsNet
      acc.netAmount += segment.netAmount
      acc.payoutAmount += segment.payoutAmount
      return acc
    },
    {
      revenueGross: 0,
      revenueNet: 0,
      costsGross: 0,
      costsNet: 0,
      netAmount: 0,
      payoutAmount: 0,
    },
  )
}

export function MonthlySettlementSegmentsPanel({ segments }: MonthlySettlementSegmentsPanelProps) {
  const t = useT()
  const totals = sumSegments(segments)

  return (
    <section className="space-y-3 rounded-lg border bg-card px-4 py-3">
      <div>
        <h3 className="text-sm font-semibold">
          {t('taxi_fleet.monthlySettlements.segments.title', 'Month segments')}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            'taxi_fleet.monthlySettlements.segments.hint',
            'Payout percent is calculated per week segment. Month payout is the sum of segment payouts.',
          )}
        </p>
      </div>

      {segments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t(
            'taxi_fleet.monthlySettlements.segments.empty',
            'No segments in this snapshot. Recalculate the monthly settlement.',
          )}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">
                  {t('taxi_fleet.monthlySettlements.segments.range', 'Range')}
                </th>
                <th className="px-3 py-2 font-medium text-right">
                  {t('taxi_fleet.settlements.revenueGross', 'Revenue gross')}
                </th>
                <th className="px-3 py-2 font-medium text-right">
                  {t('taxi_fleet.settlements.revenueNet', 'Revenue net')}
                </th>
                <th className="px-3 py-2 font-medium text-right">
                  {t('taxi_fleet.settlements.costsGross', 'Costs gross')}
                </th>
                <th className="px-3 py-2 font-medium text-right">
                  {t('taxi_fleet.settlements.costsNet', 'Costs net')}
                </th>
                <th className="px-3 py-2 font-medium text-right">
                  {t('taxi_fleet.monthlySettlements.segments.netIncome', 'Net income')}
                </th>
                <th className="px-3 py-2 font-medium text-right">
                  {t('taxi_fleet.settlements.payout', 'Payout')}
                </th>
                <th className="px-3 py-2 font-medium text-right">
                  {t('taxi_fleet.monthlySettlements.segments.payoutPercentShort', '%')}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t('taxi_fleet.monthlySettlements.weeklyLink.column', 'Weekly settlement')}
                </th>
              </tr>
            </thead>
            <tbody>
              {segments.map((segment) => {
                const trailing = isTrailingPartialWeek(segment)
                const isLeadingRemainder =
                  segment.kind === 'leading' || segment.straddle?.role === 'leading_remainder'
                return (
                  <tr key={segment.id}>
                    <td className="px-3 py-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="whitespace-nowrap tabular-nums">
                          {segment.dateFrom} – {segment.dateTo}
                        </span>
                        {isLeadingRemainder ? (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                            {t(
                              'taxi_fleet.monthlySettlements.segments.markLeading',
                              'Remaining weekly payout',
                            )}
                          </span>
                        ) : null}
                        {trailing ? (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                            {t(
                              'taxi_fleet.monthlySettlements.segments.markTrailing',
                              'Partial weekly payout',
                            )}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMoney(segment.revenueGross)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMoney(segment.revenueNet)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMoney(segment.costsGross)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMoney(segment.costsNet)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {formatMoney(segment.netAmount)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {formatMoney(segment.payoutAmount)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {isLeadingRemainder ? '—' : formatPercent(segment.payoutPercent)}
                    </td>
                    <td className="px-3 py-2">
                      <MonthlySettlementWeeklyLink
                        weeklySettlementId={segment.weeklySettlementId}
                        weekStart={segment.weekStart}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 font-semibold">
                <td className="px-3 py-2">
                  {t('taxi_fleet.monthlySettlements.segments.total', 'Total')}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(totals.revenueGross)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(totals.revenueNet)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(totals.costsGross)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(totals.costsNet)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(totals.netAmount)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(totals.payoutAmount)}</td>
                <td className="px-3 py-2 text-right tabular-nums">—</td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  )
}
