'use client'

import * as React from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { CRUD_FORM_SELECT_CLASS, CRUD_FORM_TEXT_INPUT_CLASS } from '@open-mercato/ui/backend/CrudForm'
import { TAXI_FLEET_BASE } from '../backend/taxi-fleet/paths'
import type { MonthlySettlementTripLine } from '../lib/monthlySettlementSnapshot'
import { tripCountsForSettlementRevenue } from '../lib/settlementRevenueUi'
import { useTaxiFleetLabels } from './useTaxiFleetLabels'
import { MonthlySettlementWeeklyLink } from './MonthlySettlementWeeklyLink'

type MonthlySettlementTripsPanelProps = {
  trips: MonthlySettlementTripLine[]
}

function formatStartedLabel(trip: MonthlySettlementTripLine): string {
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

function filterMonthlyRevenueTrips(trips: MonthlySettlementTripLine[]): MonthlySettlementTripLine[] {
  return trips.filter(
    (trip) => tripCountsForSettlementRevenue(trip.status) && (trip.revenueAmount ?? 0) > 0,
  )
}

function platformKey(trip: MonthlySettlementTripLine): string {
  return trip.platform?.trim() || '__none__'
}

export function MonthlySettlementTripsPanel({ trips }: MonthlySettlementTripsPanelProps) {
  const t = useT()
  const { resolveTripTypeLabel } = useTaxiFleetLabels()
  const [search, setSearch] = React.useState('')
  const [platformFilter, setPlatformFilter] = React.useState('all')
  const [typeFilter, setTypeFilter] = React.useState('all')

  const revenueTrips = React.useMemo(() => filterMonthlyRevenueTrips(trips), [trips])

  const platformOptions = React.useMemo(() => {
    const keys = [...new Set(revenueTrips.map(platformKey))].sort()
    return keys
  }, [revenueTrips])

  const typeOptions = React.useMemo(() => {
    return [...new Set(revenueTrips.map((trip) => trip.tripType).filter(Boolean))].sort()
  }, [revenueTrips])

  const filteredTrips = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    return revenueTrips.filter((trip) => {
      if (platformFilter !== 'all' && platformKey(trip) !== platformFilter) return false
      if (typeFilter !== 'all' && trip.tripType !== typeFilter) return false
      if (!query) return true
      const platformLabel = trip.platform
        ? t(`taxi_fleet.trips.platforms.${trip.platform}`, trip.platform)
        : t('taxi_fleet.trips.platforms.none', 'None')
      const haystack = [
        formatStartedLabel(trip),
        platformLabel,
        resolveTripTypeLabel(trip.tripType),
        trip.weekStart ?? '',
        trip.id,
        trip.revenueAmount != null ? String(trip.revenueAmount) : '',
        trip.distanceKm != null ? String(trip.distanceKm) : '',
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [platformFilter, resolveTripTypeLabel, revenueTrips, search, t, typeFilter])

  const totals = React.useMemo(
    () =>
      filteredTrips.reduce(
        (acc, trip) => {
          acc.count += 1
          acc.revenue += trip.revenueAmount ?? 0
          if (trip.distanceKm != null && Number.isFinite(trip.distanceKm) && !trip.missingDistance) {
            acc.distanceKm += trip.distanceKm
          }
          return acc
        },
        { count: 0, revenue: 0, distanceKm: 0 },
      ),
    [filteredTrips],
  )

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div>
        <h3 className="text-base font-semibold">
          {t('taxi_fleet.monthlySettlements.trips.title', 'Trips')}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            'taxi_fleet.monthlySettlements.trips.hint',
            'All trips included in this month’s payout calculation.',
          )}
        </p>
      </div>

      {revenueTrips.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t(
            'taxi_fleet.monthlySettlements.trips.empty',
            'No trips in this monthly settlement snapshot. Recalculate if the month was generated before trip lines were stored.',
          )}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[12rem] flex-1 space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="monthly-trips-search">
                {t('taxi_fleet.monthlySettlements.filterSearch', 'Search')}
              </label>
              <input
                id="monthly-trips-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className={CRUD_FORM_TEXT_INPUT_CLASS}
                placeholder={t('taxi_fleet.monthlySettlements.trips.searchPlaceholder', 'Search trips…')}
              />
            </div>
            <div className="w-44 space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="monthly-trips-platform">
                {t('taxi_fleet.trips.platform', 'Platform')}
              </label>
              <select
                id="monthly-trips-platform"
                value={platformFilter}
                onChange={(event) => setPlatformFilter(event.target.value)}
                className={CRUD_FORM_SELECT_CLASS}
              >
                <option value="all">{t('taxi_fleet.monthlySettlements.filterAll', 'All')}</option>
                {platformOptions.map((key) => (
                  <option key={key} value={key}>
                    {key === '__none__'
                      ? t('taxi_fleet.trips.platforms.none', 'None')
                      : t(`taxi_fleet.trips.platforms.${key}`, key)}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-44 space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="monthly-trips-type">
                {t('taxi_fleet.trips.tripType', 'Type')}
              </label>
              <select
                id="monthly-trips-type"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className={CRUD_FORM_SELECT_CLASS}
              >
                <option value="all">{t('taxi_fleet.monthlySettlements.filterAll', 'All')}</option>
                {typeOptions.map((type) => (
                  <option key={type} value={type}>
                    {resolveTripTypeLabel(type)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredTrips.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('taxi_fleet.monthlySettlements.trips.noMatches', 'No trips match the current filters.')}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t('taxi_fleet.trips.startedAt', 'Started')}</th>
                    <th className="px-3 py-2 font-medium">{t('taxi_fleet.trips.platform', 'Platform')}</th>
                    <th className="px-3 py-2 font-medium">{t('taxi_fleet.trips.tripType', 'Type')}</th>
                    <th className="px-3 py-2 font-medium text-right">
                      {t('taxi_fleet.trips.distanceKm', 'Distance (km)')}
                    </th>
                    <th className="px-3 py-2 font-medium text-right">
                      {t('taxi_fleet.settlements.tripsToReconcile.revenue', 'Revenue')}
                    </th>
                    <th className="px-3 py-2 font-medium">
                      {t('taxi_fleet.monthlySettlements.weeklyLink.column', 'Weekly settlement')}
                    </th>
                    <th className="px-3 py-2" aria-hidden />
                  </tr>
                </thead>
                <tbody>
                  {filteredTrips.map((trip) => {
                    const tripHref = `${TAXI_FLEET_BASE}/trips/${encodeURIComponent(trip.id)}`
                    return (
                      <tr key={trip.id}>
                        <td className="px-3 py-2">{formatStartedLabel(trip)}</td>
                        <td className="px-3 py-2">
                          {trip.platform
                            ? t(`taxi_fleet.trips.platforms.${trip.platform}`, trip.platform)
                            : t('taxi_fleet.trips.platforms.none', 'None')}
                        </td>
                        <td className="px-3 py-2">{resolveTripTypeLabel(trip.tripType)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatDistanceKm(trip.distanceKm, Boolean(trip.missingDistance))}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatRevenue(trip.revenueAmount)}
                        </td>
                        <td className="px-3 py-2">
                          <MonthlySettlementWeeklyLink
                            weeklySettlementId={trip.weeklySettlementId}
                            weekStart={trip.weekStart}
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Link
                            href={tripHref}
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            {t('common.open', 'Open')}
                            <ExternalLink className="size-3" aria-hidden />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/30 font-semibold">
                    <td className="px-3 py-2" colSpan={3}>
                      {t('taxi_fleet.monthlySettlements.trips.total', 'Total')} ({totals.count})
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {`${totals.distanceKm.toFixed(2)} km`}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatRevenue(totals.revenue)}</td>
                    <td className="px-3 py-2" colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}
