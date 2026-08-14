'use client'

import React from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Button } from '@open-mercato/ui/primitives/button'
import { DriverTripGate } from '../../../components/driverApp/DriverTripGate'
import {
  driverBadgeInfoClass,
  driverBadgeNeutralClass,
  driverListRowClass,
  driverMutedTextClass,
  driverPrimaryActionClass,
  driverSecondaryActionClass,
} from '../../../components/driverApp/driverUi'
import { cacheDriverJson, readCachedDriverJson } from '../../../lib/driverOffline/outbox'
import { tripRequestDetailsFromMetadata } from '../../../lib/tripRequestForm'
import { isDriverTripElectronicallyPrepaid } from '../../../lib/driverTripPayment'
import { isDriverOnOpenShift } from '../../../lib/driverTripShiftWindow'
import { useTaxiFleetLabels } from '../../../components/useTaxiFleetLabels'

type TripRow = {
  id: string
  status: string
  startedAt?: string | null
  endedAt?: string | null
  createdAt?: string | null
  revenueAmount?: string | null
  currencyCode?: string | null
  notes?: string | null
  metadata?: Record<string, unknown> | null
}

type TripFilter = 'all' | 'today'

const PAGE_SIZE = 10

function formatTripMoment(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTimeRange(startedAt?: string | null, endedAt?: string | null): string | null {
  const start = formatTripMoment(startedAt)
  const end = formatTripMoment(endedAt)
  if (start && end) return `${start} – ${end}`
  if (start) return start
  if (end) return end
  return null
}

function formatRoute(fromAddress: string, toAddress: string): string | null {
  const from = fromAddress.trim()
  const to = toAddress.trim()
  if (from && to) return `${from} → ${to}`
  if (from) return from
  if (to) return to
  return null
}

function normalizeCachedTrips(cached: TripRow[] | { items?: TripRow[] } | null): TripRow[] {
  if (!cached) return []
  if (Array.isArray(cached)) return cached
  return Array.isArray(cached.items) ? cached.items : []
}

function tripStartTime(trip: TripRow): number {
  if (!trip.startedAt) return 0
  const time = new Date(trip.startedAt).getTime()
  return Number.isNaN(time) ? 0 : time
}

function sortTripsByStartedAtDesc(items: TripRow[]): TripRow[] {
  return [...items].sort((left, right) => tripStartTime(right) - tripStartTime(left))
}

function startOfLocalDay(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function endOfLocalDay(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

function isTripStartingToday(trip: TripRow, day = new Date()): boolean {
  if (!trip.startedAt) return false
  const time = new Date(trip.startedAt).getTime()
  if (Number.isNaN(time)) return false
  return time >= startOfLocalDay(day).getTime() && time <= endOfLocalDay(day).getTime()
}

export default function DriverTripsPage() {
  const t = useT()
  const { resolveTripStatusLabel } = useTaxiFleetLabels()
  const [items, setItems] = React.useState<TripRow[]>([])
  const [onOpenShift, setOnOpenShift] = React.useState(false)
  const [shiftReady, setShiftReady] = React.useState(false)
  const [filter, setFilter] = React.useState<TripFilter>('today')
  const [page, setPage] = React.useState(0)

  React.useEffect(() => {
    let active = true
    void apiCall<{
      todayAssignment: { shiftStart: string | null; shiftEnd: string | null } | null
    }>('/api/taxi_fleet/driver/me')
      .then(({ result }) => {
        if (!active) return
        const open = isDriverOnOpenShift(result.todayAssignment)
        setOnOpenShift(open)
        setFilter(open ? 'today' : 'all')
        setPage(0)
      })
      .catch(async () => {
        if (!active) return
        const cached = await readCachedDriverJson<{
          todayAssignment?: { shiftStart: string | null; shiftEnd: string | null } | null
        }>('driver/me')
        const open = isDriverOnOpenShift(cached?.todayAssignment ?? null)
        setOnOpenShift(open)
        setFilter(open ? 'today' : 'all')
        setPage(0)
      })
      .finally(() => {
        if (active) setShiftReady(true)
      })
    return () => {
      active = false
    }
  }, [])

  React.useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const { result } = await apiCall<{ items: TripRow[] }>('/api/taxi_fleet/driver/trips')
        if (!active) return
        const next = sortTripsByStartedAtDesc(result.items ?? [])
        setItems(next)
        await cacheDriverJson('driver/trips', next)
      } catch {
        const cached = await readCachedDriverJson<TripRow[] | { items?: TripRow[] }>('driver/trips')
        const next = sortTripsByStartedAtDesc(normalizeCachedTrips(cached))
        if (next.length) {
          setItems(next)
          flash(t('taxi_fleet.driverApp.usingCache', 'Showing cached data (offline).'), 'warning')
          return
        }
        flash(t('taxi_fleet.driverApp.trips.loadFailed', 'Could not load trips.'), 'error')
      }
    })()
    return () => {
      active = false
    }
  }, [t])

  const effectiveFilter: TripFilter = onOpenShift ? filter : 'all'

  const filteredItems = React.useMemo(() => {
    const scoped =
      effectiveFilter === 'today' ? items.filter((trip) => isTripStartingToday(trip)) : items
    return sortTripsByStartedAtDesc(scoped)
  }, [effectiveFilter, items])

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageItems = filteredItems.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  const canGoPrev = safePage > 0
  const canGoNext = safePage < pageCount - 1 && filteredItems.length > 0

  React.useEffect(() => {
    if (page !== safePage) setPage(safePage)
  }, [page, safePage])

  function selectFilter(next: TripFilter) {
    if (!onOpenShift) return
    setFilter(next)
    setPage(0)
  }

  return (
    <DriverTripGate title={t('taxi_fleet.driverApp.trips.title', 'My trips')}>
      <div className="space-y-3">
        <Link href="/driver/trips/new" className={`${driverPrimaryActionClass} gap-2`}>
          <Plus className="size-4" aria-hidden />
          {t('taxi_fleet.driverApp.trips.new', 'New trip')}
        </Link>

        {shiftReady && onOpenShift ? (
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              className={
                effectiveFilter === 'all'
                  ? driverPrimaryActionClass
                  : `${driverSecondaryActionClass} bg-white`
              }
              onClick={() => selectFilter('all')}
            >
              {t('taxi_fleet.driverApp.trips.filterAll', 'All')}
            </Button>
            <Button
              type="button"
              className={
                effectiveFilter === 'today'
                  ? driverPrimaryActionClass
                  : `${driverSecondaryActionClass} bg-white`
              }
              onClick={() => selectFilter('today')}
            >
              {t('taxi_fleet.driverApp.trips.filterToday', 'Today')}
            </Button>
          </div>
        ) : null}

        {filteredItems.length === 0 ? (
          <div className={`px-1 py-8 text-center ${driverMutedTextClass}`}>
            {effectiveFilter === 'today'
              ? t('taxi_fleet.driverApp.trips.emptyToday', 'No trips today.')
              : t('taxi_fleet.driverApp.trips.empty', 'No trips yet.')}
          </div>
        ) : (
          <>
            {pageItems.map((trip) => {
              const request = tripRequestDetailsFromMetadata(trip.metadata ?? null)
              const timeRange = formatTimeRange(trip.startedAt, trip.endedAt)
              const route = formatRoute(request.fromAddress, request.toAddress)
              const currency = trip.currencyCode?.trim() || 'PLN'
              const revenue = isDriverTripElectronicallyPrepaid(trip)
                ? t('taxi_fleet.driverApp.trips.prepaid', 'Prepayment')
                : trip.revenueAmount != null && String(trip.revenueAmount).trim()
                  ? `${trip.revenueAmount} ${currency}`
                  : null
              return (
                <Link key={trip.id} href={`/driver/trips/${trip.id}`} className={driverListRowClass}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#071437]">
                        {resolveTripStatusLabel(trip.status)}
                      </div>
                      {timeRange ? (
                        <div className={`mt-1 ${driverMutedTextClass}`}>{timeRange}</div>
                      ) : null}
                      {route ? (
                        <div className="mt-1 line-clamp-2 text-sm text-[#4B5675]">{route}</div>
                      ) : null}
                    </div>
                    {revenue ? (
                      <span className={`${driverBadgeInfoClass} shrink-0 whitespace-nowrap`}>{revenue}</span>
                    ) : (
                      <span className={`${driverBadgeNeutralClass} shrink-0`}>—</span>
                    )}
                  </div>
                </Link>
              )
            })}

            {pageCount > 1 ? (
              <div className="flex items-center justify-between gap-3 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!canGoPrev}
                  className="h-10 gap-1 px-2 text-[#78829D] hover:!bg-[#F1F1F4]/50 hover:!text-[#4B5675] disabled:opacity-40"
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                  aria-label={t('taxi_fleet.driverApp.trips.pagePrev', 'Previous')}
                >
                  <ChevronLeft className="size-4" aria-hidden />
                  {t('taxi_fleet.driverApp.trips.pagePrev', 'Previous')}
                </Button>

                <div className="flex items-center gap-1.5" aria-hidden>
                  {Array.from({ length: pageCount }, (_, index) => (
                    <span
                      key={`dot-${index}`}
                      className={`size-1.5 rounded-full ${
                        index === safePage ? 'bg-[#1B84FF]' : 'bg-[#DBDFE9]'
                      }`}
                    />
                  ))}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  disabled={!canGoNext}
                  className="h-10 gap-1 px-2 text-[#78829D] hover:!bg-[#F1F1F4]/50 hover:!text-[#4B5675] disabled:opacity-40"
                  onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
                  aria-label={t('taxi_fleet.driverApp.trips.pageNext', 'Next')}
                >
                  {t('taxi_fleet.driverApp.trips.pageNext', 'Next')}
                  <ChevronRight className="size-4" aria-hidden />
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </DriverTripGate>
  )
}
