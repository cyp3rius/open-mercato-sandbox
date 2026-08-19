'use client'

import * as React from 'react'
import Link from 'next/link'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { TAXI_FLEET_BASE } from '../backend/taxi-fleet/paths'
import type { MonthlyDriverBreakdownLine } from '../lib/monthlySettlementCalculator'

type MonthlySettlementDriverBreakdownPanelProps = {
  driverBreakdown: MonthlyDriverBreakdownLine[]
  resolveDriverName: (teamMemberId: string) => string
}

function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PLN`
}

function formatKm(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} km`
}

export function parseMonthlyDriverBreakdown(
  snapshotJson?: Record<string, unknown> | null,
): MonthlyDriverBreakdownLine[] {
  const raw = snapshotJson?.driverBreakdown
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is MonthlyDriverBreakdownLine => {
    if (!item || typeof item !== 'object') return false
    const line = item as Partial<MonthlyDriverBreakdownLine>
    return typeof line.teamMemberId === 'string'
  })
}

export function MonthlySettlementDriverBreakdownPanel({
  driverBreakdown,
  resolveDriverName,
}: MonthlySettlementDriverBreakdownPanelProps) {
  const t = useT()

  return (
    <section className="space-y-4 rounded-lg border bg-card p-4">
      <div>
        <h3 className="text-base font-semibold">
          {t('taxi_fleet.monthlySettlements.driverBreakdown.title', 'Drivers (from weekly settlements)')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t(
            'taxi_fleet.monthlySettlements.driverBreakdown.hint',
            'Sums of weekly settlements whose Monday falls in this calendar month.',
          )}
        </p>
      </div>

      {driverBreakdown.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('taxi_fleet.monthlySettlements.driverBreakdown.empty', 'No weekly settlements found for this month.')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">{t('taxi_fleet.settlements.driver', 'Driver')}</th>
                <th className="px-3 py-2 font-medium text-right">{t('taxi_fleet.settlements.revenueNet', 'Revenue net')}</th>
                <th className="px-3 py-2 font-medium text-right">{t('taxi_fleet.settlements.costsNet', 'Costs net')}</th>
                <th className="px-3 py-2 font-medium text-right">{t('taxi_fleet.settlements.payout', 'Payout')}</th>
                <th className="px-3 py-2 font-medium text-right">{t('taxi_fleet.settlements.transferAmount', 'Transfer payout')}</th>
                <th className="px-3 py-2 font-medium text-right">{t('taxi_fleet.settlements.totalAmount', 'Total')}</th>
                <th className="px-3 py-2 font-medium text-right">{t('taxi_fleet.settlements.distance.total', 'Total distance (used)')}</th>
                <th className="px-3 py-2 font-medium text-right">{t('taxi_fleet.monthlySettlements.weeklyCount', 'Weeks')}</th>
              </tr>
            </thead>
            <tbody>
              {driverBreakdown.map((line) => (
                <tr key={line.teamMemberId}>
                  <td className="px-3 py-2">
                    <Link
                      href={`${TAXI_FLEET_BASE}/drivers/${encodeURIComponent(line.teamMemberId)}`}
                      className="font-medium text-primary hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {resolveDriverName(line.teamMemberId)}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(line.revenueNet)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(line.costsNet)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(line.payoutAmount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(line.transferAmount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatMoney(line.totalAmount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatKm(line.totalDistanceKm)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{line.weeklyCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
