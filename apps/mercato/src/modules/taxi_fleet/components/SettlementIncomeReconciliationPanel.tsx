'use client'

import * as React from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Badge } from '@open-mercato/ui/primitives/badge'
import { TAXI_FLEET_BASE } from '../backend/taxi-fleet/paths'
import type { SettlementTripSnapshot } from '../lib/settlementTripDistance'
import type { SettlementIncomeReconciliationSummary } from '../lib/settlementIncomeReconciliation'

type SettlementIncomeReconciliationPanelProps = {
  trips: SettlementTripSnapshot[]
  summary: SettlementIncomeReconciliationSummary
}

function formatMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PLN`
}

export function parseIncomeReconciliationSummary(
  snapshotJson?: Record<string, unknown> | null,
  trips: SettlementTripSnapshot[] = [],
): SettlementIncomeReconciliationSummary {
  const raw = snapshotJson?.incomeReconciliation
  if (raw && typeof raw === 'object') {
    const record = raw as Partial<SettlementIncomeReconciliationSummary>
    return {
      missingIncomeReceiptCount: Number(record.missingIncomeReceiptCount) || 0,
      missingPlatformCount: Number(record.missingPlatformCount) || 0,
      missingIncomeReceiptTripIds: Array.isArray(record.missingIncomeReceiptTripIds)
        ? record.missingIncomeReceiptTripIds.filter((id): id is string => typeof id === 'string')
        : [],
      missingPlatformTripIds: Array.isArray(record.missingPlatformTripIds)
        ? record.missingPlatformTripIds.filter((id): id is string => typeof id === 'string')
        : [],
    }
  }
  const missingIncomeReceiptTripIds = trips.filter((trip) => trip.missingIncomeReceipt).map((trip) => trip.id)
  const missingPlatformTripIds = trips.filter((trip) => trip.missingPlatform).map((trip) => trip.id)
  return {
    missingIncomeReceiptCount: missingIncomeReceiptTripIds.length,
    missingPlatformCount: missingPlatformTripIds.length,
    missingIncomeReceiptTripIds,
    missingPlatformTripIds,
  }
}

export function SettlementIncomeReconciliationPanel({
  trips,
  summary,
}: SettlementIncomeReconciliationPanelProps) {
  const t = useT()
  const flaggedTrips = trips.filter((trip) => trip.missingIncomeReceipt || trip.missingPlatform)
  const hasIssues = summary.missingIncomeReceiptCount > 0 || summary.missingPlatformCount > 0

  if (!hasIssues) {
    return (
      <section className="space-y-2 rounded-lg border bg-card p-4">
        <h3 className="text-base font-semibold">
          {t('taxi_fleet.settlements.reconciliation.title', 'Receipt reconciliation')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('taxi_fleet.settlements.reconciliation.ok', 'All revenue trips have platform and required receipts.')}
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-4 rounded-lg border bg-card p-4">
      <div>
        <h3 className="text-base font-semibold">
          {t('taxi_fleet.settlements.reconciliation.title', 'Receipt reconciliation')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t(
            'taxi_fleet.settlements.reconciliation.hint',
            'Trips still count toward revenue; missing items are flagged for the operator.',
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {summary.missingPlatformCount > 0 ? (
          <Badge variant="outline" className="border-amber-400 text-amber-800">
            {t('taxi_fleet.settlements.reconciliation.missingPlatformCount', '{count} without platform', {
              count: summary.missingPlatformCount,
            })}
          </Badge>
        ) : null}
        {summary.missingIncomeReceiptCount > 0 ? (
          <Badge variant="outline" className="border-amber-400 text-amber-800">
            {t('taxi_fleet.settlements.reconciliation.missingReceiptCount', '{count} without income receipt', {
              count: summary.missingIncomeReceiptCount,
            })}
          </Badge>
        ) : null}
      </div>

      <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {t(
            'taxi_fleet.settlements.reconciliation.warning',
            'Uber/Bolt/Free trips do not require a linked receipt. Own taxi trips need an income entry.',
          )}
        </span>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">{t('taxi_fleet.trips.startedAt', 'Started')}</th>
              <th className="px-3 py-2 font-medium">{t('taxi_fleet.trips.platform', 'Platform')}</th>
              <th className="px-3 py-2 font-medium">{t('taxi_fleet.settlements.revenue.gross', 'Gross')}</th>
              <th className="px-3 py-2 font-medium">{t('taxi_fleet.settlements.reconciliation.issue', 'Issue')}</th>
              <th className="px-3 py-2 font-medium">{t('common.actions', 'Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {flaggedTrips.map((trip) => {
              const startedLabel = trip.startedAt
                ? trip.startedAt.slice(0, 16).replace('T', ' ')
                : trip.endedAt
                  ? trip.endedAt.slice(0, 16).replace('T', ' ')
                  : '—'
              const issues: string[] = []
              if (trip.missingPlatform) {
                issues.push(t('taxi_fleet.settlements.reconciliation.missingPlatform', 'Missing platform'))
              }
              if (trip.missingIncomeReceipt) {
                issues.push(t('taxi_fleet.settlements.reconciliation.missingReceipt', 'Missing receipt'))
              }
              return (
                <tr key={trip.id} className="bg-amber-50/80 dark:bg-amber-950/20">
                  <td className="px-3 py-2">{startedLabel}</td>
                  <td className="px-3 py-2">
                    {trip.platform
                      ? t(`taxi_fleet.trips.platforms.${trip.platform}`, trip.platform)
                      : t('taxi_fleet.trips.platforms.none', 'None')}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{formatMoney(trip.revenueAmount)}</td>
                  <td className="px-3 py-2">{issues.join(' · ')}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`${TAXI_FLEET_BASE}/trips/${encodeURIComponent(trip.id)}`}
                      className="text-primary hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t('taxi_fleet.settlements.distance.openTrip', 'Open trip')}
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
