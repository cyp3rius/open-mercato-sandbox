'use client'

import React from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Button } from '@open-mercato/ui/primitives/button'
import { DriverTripGate } from '../../../components/driverApp/DriverTripGate'
import { useRegisterDriverPullToRefresh } from '../../../components/driverApp/DriverPullToRefresh'
import {
  DriverTripReceiptStatusBadge,
  tripListHasProcessingReceipt,
} from '../../../components/driverApp/DriverTripReceiptStatusBadge'
import {
  DRIVER_LIST_PAGE_SIZE,
  useDriverPagedList,
} from '../../../components/driverApp/useDriverPagedList'
import {
  driverBadgeInfoClass,
  driverBadgeNeutralClass,
  driverListRowClass,
  driverMutedTextClass,
  driverPrimaryActionClass,
  driverSecondaryActionClass,
} from '../../../components/driverApp/driverUi'
import { DriverWritable } from '../../../components/driverApp/DriverWritable'
import type { DriverTripReceiptWarning } from '../../../lib/driverTripReceiptStatus'
import { tripRequestDetailsFromMetadata } from '../../../lib/tripRequestForm'
import { isDriverTripElectronicallyPrepaid } from '../../../lib/driverTripPayment'
import { isDriverOnOpenShift } from '../../../lib/driverTripShiftWindow'
import { useTaxiFleetLabels } from '../../../components/useTaxiFleetLabels'
import { readPlatformTripIngestLabel } from '../../../components/PlatformTripIngestBadge'
import { resolveDriverFacingTripStatus } from '../../../lib/driverVisibleTripStatuses'

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
  receiptAttachmentId?: string | null
  ocrStatus?: string | null
  warnings?: DriverTripReceiptWarning[]
}

type TripListResponse = {
  items: TripRow[]
  page: number
  pageSize: number
  total: number
}

type TripFilter = 'all' | 'today'

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

function startOfLocalDay(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function endOfLocalDay(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

export default function DriverTripsPage() {
  const t = useT()
  const { resolveTripStatusLabel } = useTaxiFleetLabels()
  const [onOpenShift, setOnOpenShift] = React.useState(false)
  const [shiftReady, setShiftReady] = React.useState(false)
  const [filter, setFilter] = React.useState<TripFilter>('today')

  React.useEffect(() => {
    let active = true
    void apiCall<{
      todayAssignment: { shiftStart: string | null; shiftEnd: string | null } | null
    }>('/api/taxi_fleet/driver/me')
      .then(({ result }) => {
        if (!active || !result) return
        const open = isDriverOnOpenShift(result.todayAssignment)
        setOnOpenShift(open)
        setFilter(open ? 'today' : 'all')
      })
      .catch(() => {
        if (!active) return
        setOnOpenShift(false)
        setFilter('all')
      })
      .finally(() => {
        if (active) setShiftReady(true)
      })
    return () => {
      active = false
    }
  }, [])

  const effectiveFilter: TripFilter = onOpenShift ? filter : 'all'
  const listQueryKey = `trips:${effectiveFilter}`

  const fetchPage = React.useCallback(
    async (page: number, pageSize: number) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      })
      if (effectiveFilter === 'today') {
        params.set('startedFrom', startOfLocalDay().toISOString())
        params.set('startedTo', endOfLocalDay().toISOString())
      }
      const { result, ok } = await apiCall<TripListResponse>(
        `/api/taxi_fleet/driver/trips?${params}`,
      )
      if (!ok || !result) throw new Error('load_failed')
      return {
        items: result.items ?? [],
        page: result.page ?? page,
        pageSize: result.pageSize ?? pageSize,
        total: result.total ?? 0,
      }
    },
    [effectiveFilter],
  )

  const {
    items,
    page,
    pageCount,
    total,
    loading,
    error,
    goToPage,
    reload,
    canGoPrev,
    canGoNext,
  } = useDriverPagedList<TripRow>({
    queryKey: listQueryKey,
    fetchPage,
    pageSize: DRIVER_LIST_PAGE_SIZE,
    enabled: shiftReady,
  })

  React.useEffect(() => {
    if (error) {
      flash(t('taxi_fleet.driverApp.trips.loadFailed', 'Could not load trips.'), 'error')
    }
  }, [error, t])

  useRegisterDriverPullToRefresh(async () => {
    await reload().catch(() => undefined)
  })

  React.useEffect(() => {
    if (!tripListHasProcessingReceipt(items)) return
    const timer = window.setInterval(() => {
      void reload().catch(() => undefined)
    }, 3000)
    return () => window.clearInterval(timer)
  }, [items, reload])

  function selectFilter(next: TripFilter) {
    if (!onOpenShift) return
    setFilter(next)
  }

  return (
    <DriverTripGate showShiftPrompt={false} title={t('taxi_fleet.driverApp.trips.title', 'My trips')}>
      <div className="space-y-3">
        <DriverWritable>
          <Link href="/driver/trips/new" className={`${driverPrimaryActionClass} gap-2`}>
            <Plus className="size-4" aria-hidden />
            {t('taxi_fleet.driverApp.trips.new', 'New trip')}
          </Link>
        </DriverWritable>

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

        {loading && items.length === 0 ? (
          <div className={`px-1 py-8 text-center ${driverMutedTextClass}`}>
            {t('taxi_fleet.driverApp.trips.loading', 'Loading trips…')}
          </div>
        ) : items.length === 0 ? (
          <div className={`px-1 py-8 text-center ${driverMutedTextClass}`}>
            {effectiveFilter === 'today'
              ? t('taxi_fleet.driverApp.trips.emptyToday', 'No trips today.')
              : t('taxi_fleet.driverApp.trips.empty', 'No trips yet.')}
          </div>
        ) : (
          <>
            {items.map((trip) => {
              const request = tripRequestDetailsFromMetadata(trip.metadata ?? null)
              const timeRange = formatTimeRange(trip.startedAt, trip.endedAt)
              const route = formatRoute(request.fromAddress, request.toAddress)
              const currency = trip.currencyCode?.trim() || 'PLN'
              const revenue = isDriverTripElectronicallyPrepaid(trip)
                ? t('taxi_fleet.driverApp.trips.prepaid', 'Prepayment')
                : trip.revenueAmount != null && String(trip.revenueAmount).trim()
                  ? `${trip.revenueAmount} ${currency}`
                  : null
              const receiptAttachmentId =
                trip.receiptAttachmentId ??
                (trip.metadata && typeof trip.metadata.receiptAttachmentId === 'string'
                  ? trip.metadata.receiptAttachmentId
                  : null)
              const receiptItem = {
                receiptAttachmentId,
                ocrStatus: trip.ocrStatus ?? null,
                warnings: trip.warnings ?? [],
              }
              const ingestLabel = readPlatformTripIngestLabel(trip.metadata ?? null, t)
              return (
                <Link key={trip.id} href={`/driver/trips/${trip.id}`} className={driverListRowClass}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-[#071437]">
                          {resolveTripStatusLabel(resolveDriverFacingTripStatus(trip.status))}
                        </div>
                        {ingestLabel ? (
                          <span className={`${driverBadgeNeutralClass} text-xs`}>{ingestLabel}</span>
                        ) : null}
                        <DriverTripReceiptStatusBadge item={receiptItem} t={t} />
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
                  disabled={!canGoPrev || loading}
                  className="h-10 gap-1 px-2 text-[#78829D] hover:!bg-[#F1F1F4]/50 hover:!text-[#4B5675] disabled:opacity-40"
                  onClick={() => goToPage(page - 1)}
                  aria-label={t('taxi_fleet.driverApp.trips.pagePrev', 'Previous')}
                >
                  <ChevronLeft className="size-4" aria-hidden />
                  {t('taxi_fleet.driverApp.trips.pagePrev', 'Previous')}
                </Button>

                <div className={`text-xs tabular-nums ${driverMutedTextClass}`}>
                  {t('taxi_fleet.driverApp.pagination.pageOf', 'Page {page} of {totalPages}', {
                    page,
                    totalPages: pageCount,
                  })}
                  {total > 0
                    ? ` · ${t('taxi_fleet.driverApp.pagination.total', '{total} total', { total })}`
                    : null}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  disabled={!canGoNext || loading}
                  className="h-10 gap-1 px-2 text-[#78829D] hover:!bg-[#F1F1F4]/50 hover:!text-[#4B5675] disabled:opacity-40"
                  onClick={() => goToPage(page + 1)}
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
