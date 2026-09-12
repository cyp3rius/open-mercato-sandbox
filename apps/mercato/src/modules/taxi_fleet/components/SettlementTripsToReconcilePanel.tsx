'use client'

import * as React from 'react'
import Link from 'next/link'
import { AlertCircle, AlertTriangle, ExternalLink, FileWarning, Loader2, RefreshCw, RouteOff } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { Badge } from '@open-mercato/ui/primitives/badge'
import { Button } from '@open-mercato/ui/primitives/button'
import { TAXI_FLEET_BASE } from '../backend/taxi-fleet/paths'
import type { SettlementTripSnapshot } from '../lib/settlementTripDistance'
import { tripCountsForSettlementRevenue } from '../lib/settlementRevenueUi'
import { useTaxiFleetLabels } from './useTaxiFleetLabels'

type SettlementTripsToReconcilePanelProps = {
  trips: SettlementTripSnapshot[]
  settlementId?: string
  readOnly?: boolean
  onUpdated?: () => Promise<void>
}

type TripIssueBadgeProps = {
  icon: LucideIcon
  label: string
  className: string
}

function TripIssueBadge({ icon: Icon, label, className }: TripIssueBadgeProps) {
  return (
    <Badge variant="outline" className={`gap-1 font-normal ${className}`}>
      <Icon className="size-3 shrink-0" aria-hidden />
      {label}
    </Badge>
  )
}

export function filterSettlementRevenueTrips(trips: SettlementTripSnapshot[]): SettlementTripSnapshot[] {
  return trips.filter(
    (trip) => tripCountsForSettlementRevenue(trip.status) && (trip.revenueAmount ?? 0) > 0,
  )
}

function formatStartedLabel(trip: SettlementTripSnapshot): string {
  const raw = trip.startedAt ?? trip.endedAt
  if (!raw) return '—'
  return raw.slice(0, 16).replace('T', ' ')
}

function formatDistanceKm(value: number | null, missing: boolean): string {
  if (missing || value == null || !Number.isFinite(value)) return '-'
  return `${value.toFixed(2)} km`
}

function formatRevenue(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PLN`
}

export function SettlementTripsToReconcilePanel({
  trips,
  settlementId,
  readOnly = false,
  onUpdated,
}: SettlementTripsToReconcilePanelProps) {
  const t = useT()
  const { resolveTripTypeLabel } = useTaxiFleetLabels()
  const [isRefreshing, setIsRefreshing] = React.useState(false)

  const revenueTrips = React.useMemo(() => filterSettlementRevenueTrips(trips), [trips])

  const flaggedTrips = React.useMemo(
    () => revenueTrips.filter((trip) => trip.missingDistance || trip.missingPlatform || trip.missingIncomeReceipt),
    [revenueTrips],
  )

  const canRefresh = Boolean(settlementId) && !readOnly && Boolean(onUpdated)

  const refreshTrips = React.useCallback(async () => {
    if (!settlementId || !onUpdated) return
    setIsRefreshing(true)
    try {
      await updateCrud(
        'taxi_fleet/settlements',
        { id: settlementId, recalculateSettlement: true },
        {
          errorMessage: t(
            'taxi_fleet.settlements.tripsToReconcile.refreshError',
            'Could not refresh trips.',
          ),
        },
      )
      flash(
        t('taxi_fleet.settlements.tripsToReconcile.refreshed', 'Trips refreshed from current week data.'),
        'success',
      )
      await onUpdated()
    } catch {
      // updateCrud already flashes the error
    } finally {
      setIsRefreshing(false)
    }
  }, [onUpdated, settlementId, t])

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold">
            {t('taxi_fleet.settlements.tripsToReconcile.title', 'Trips to reconcile')}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              'taxi_fleet.settlements.tripsToReconcile.hint',
              'Trips included in revenue calculation for this week.',
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {flaggedTrips.length > 0 ? (
            <Badge variant="outline" className="gap-1 border-amber-400 text-amber-800">
              <AlertTriangle className="size-3 shrink-0" aria-hidden />
              {t('taxi_fleet.settlements.tripsToReconcile.attentionCount', '{count} requiring attention', {
                count: flaggedTrips.length,
              })}
            </Badge>
          ) : null}
          {canRefresh ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isRefreshing}
              onClick={() => void refreshTrips()}
            >
              {isRefreshing ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="mr-2 size-4" aria-hidden />
              )}
              {t('taxi_fleet.settlements.tripsToReconcile.refresh', 'Refresh trips')}
            </Button>
          ) : null}
        </div>
      </div>

      {revenueTrips.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('taxi_fleet.settlements.tripsToReconcile.empty', 'No revenue trips found for this week.')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">{t('taxi_fleet.trips.startedAt', 'Started')}</th>
                <th className="px-3 py-2 font-medium">{t('taxi_fleet.trips.platform', 'Platform')}</th>
                <th className="px-3 py-2 font-medium">{t('taxi_fleet.trips.tripType', 'Type')}</th>
                <th className="px-3 py-2 font-medium">{t('taxi_fleet.trips.distanceKm', 'Distance (km)')}</th>
                <th className="px-3 py-2 font-medium text-right">
                  {t('taxi_fleet.settlements.tripsToReconcile.revenue', 'Revenue')}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t('taxi_fleet.settlements.tripsToReconcile.actions', 'Actions')}
                </th>
                <th className="px-3 py-2" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {revenueTrips.map((trip) => {
                const hasIssues = trip.missingDistance || trip.missingPlatform || trip.missingIncomeReceipt
                const tripHref = `${TAXI_FLEET_BASE}/trips/${encodeURIComponent(trip.id)}`

                return (
                  <tr key={trip.id} className={hasIssues ? 'bg-amber-50/80 dark:bg-amber-950/20' : undefined}>
                    <td className="px-3 py-2">{formatStartedLabel(trip)}</td>
                    <td className="px-3 py-2">
                      {trip.platform
                        ? t(`taxi_fleet.trips.platforms.${trip.platform}`, trip.platform)
                        : t('taxi_fleet.trips.platforms.none', 'None')}
                    </td>
                    <td className="px-3 py-2">{resolveTripTypeLabel(trip.tripType)}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatDistanceKm(trip.distanceKm, Boolean(trip.missingDistance))}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatRevenue(trip.revenueAmount)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {trip.missingPlatform ? (
                          <TripIssueBadge
                            icon={AlertCircle}
                            label={t('taxi_fleet.settlements.reconciliation.missingPlatform', 'Missing platform')}
                            className="border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
                          />
                        ) : null}
                        {trip.missingIncomeReceipt ? (
                          <TripIssueBadge
                            icon={FileWarning}
                            label={t('taxi_fleet.settlements.reconciliation.missingReceipt', 'Missing receipt')}
                            className="border-rose-400 bg-rose-50 text-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
                          />
                        ) : null}
                        {trip.missingDistance ? (
                          <TripIssueBadge
                            icon={RouteOff}
                            label={t('taxi_fleet.settlements.tripsToReconcile.missingDistance', 'Distance not provided')}
                            className="border-sky-400 bg-sky-50 text-sky-900 dark:bg-sky-950/30 dark:text-sky-100"
                          />
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button type="button" variant="outline" size="sm" asChild>
                        <Link
                          href={tripHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2"
                        >
                          <ExternalLink className="size-4 shrink-0" aria-hidden />
                          {t('common.open', 'Open')}
                        </Link>
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
