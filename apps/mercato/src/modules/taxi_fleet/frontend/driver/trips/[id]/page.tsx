'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle, ChevronDown, List } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { parseNumericValue } from '@open-mercato/shared/lib/numeric'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Button } from '@open-mercato/ui/primitives/button'
import { Notice } from '@open-mercato/ui/primitives/Notice'
import { DriverTripGate, useDriverTripGateShift } from '../../../../components/driverApp/DriverTripGate'
import { useRegisterDriverPullToRefresh } from '../../../../components/driverApp/DriverPullToRefresh'
import { DriverTripReceiptStatusBadge } from '../../../../components/driverApp/DriverTripReceiptStatusBadge'
import {
  driverBadgeNeutralClass,
  driverBadgeWarningClass,
  driverCardClass,
  driverFieldClass,
  driverLabelClass,
  driverMutedTextClass,
  driverPrimaryActionClass,
  driverSecondaryActionClass,
  driverSectionDescClass,
  driverSectionTitleClass,
} from '../../../../components/driverApp/driverUi'
import {
  DRIVER_CACHE_KEYS,
  loadDriverSnapshot,
  normalizeCachedItemList,
  patchCachedTrip,
} from '../../../../lib/driverOffline/driverDataCache'
import { queueOrSendTripUpdate } from '../../../../lib/driverOffline/queueOrSendTripUpdate'
import { fileToBase64 } from '../../../../lib/driverOffline/buildTripPayload'
import { saveReceiptBlob } from '../../../../lib/driverOffline/tripDrafts'
import { tripRequestDetailsFromMetadata } from '../../../../lib/tripRequestForm'
import { readQuoteSnapshotFromMetadata } from '../../../../lib/pricing/tripFormQuote'
import { isDriverTripElectronicallyPrepaid } from '../../../../lib/driverTripPayment'
import { findDriverTripOverlap } from '../../../../lib/driverTripOverlapClient'
import { useTaxiFleetLabels } from '../../../../components/useTaxiFleetLabels'
import { isDriverTripFinishedStatus, resolveDriverFacingTripStatus } from '../../../../lib/driverVisibleTripStatuses'
import { DriverReceiptPreview } from '../../../../components/driverApp/DriverReceiptPreview'
import { DriverReceiptFields } from '../../../../components/driverApp/DriverReceiptFields'
import {
  isTripReceiptProcessing,
  isTripReceiptVerified,
  resolveTripReceiptAttachmentId,
  tripHasReceiptAttachment,
  type DriverTripReceiptWarning,
} from '../../../../lib/driverTripReceiptStatus'
import { formatReceiptOcrWarningLabel } from '../../../../lib/receiptOcrWarningLabel'
import { isPlatformIngestedTrip } from '../../../../lib/platformSync/platformTripIngest'

type TripRow = {
  id: string
  status: string
  tripType?: string | null
  startedAt?: string | null
  endedAt?: string | null
  revenueAmount?: string | number | null
  currencyCode?: string | null
  notes?: string | null
  distanceKm?: string | number | null
  metadata?: Record<string, unknown> | null
  receiptAttachmentId?: string | null
  ocrStatus?: string | null
  warnings?: DriverTripReceiptWarning[]
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function formatAmount(value: string | number | null | undefined): string | null {
  if (value == null || value === '') return null
  const text = String(value).trim()
  return text.length ? text : null
}

function withUnit(value: string | null | undefined, unit: string): string | null {
  if (!value) return null
  return `${value} ${unit}`
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#F1F1F4] py-3 last:border-b-0">
      <div className={driverMutedTextClass}>{label}</div>
      <div className="max-w-[60%] text-right text-sm font-medium wrap-break-word text-[#071437]">{value}</div>
    </div>
  )
}

function OptionalDetailRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode | null | undefined
}) {
  if (value == null || value === false || value === '') return null
  if (typeof value === 'string' && !value.trim()) return null
  return <DetailRow label={label} value={value} />
}

function resolveTripId(params: { id?: string | string[] } | undefined): string {
  const raw = params?.id
  if (Array.isArray(raw)) return typeof raw[0] === 'string' ? raw[0] : ''
  return typeof raw === 'string' ? raw : ''
}

function findTrip(items: TripRow[], tripId: string): TripRow | null {
  return items.find((row) => row.id === tripId) ?? null
}

function normalizeCachedTrips(cached: TripRow[] | { items?: TripRow[] } | null): TripRow[] {
  return normalizeCachedItemList(cached)
}

async function putTripUpdate(
  payload: Record<string, unknown>,
  cachePatch?: Record<string, unknown>,
): Promise<{ queued: boolean }> {
  return queueOrSendTripUpdate(payload, cachePatch ? { cachePatch } : undefined)
}

function yesNo(value: boolean, yes: string, no: string): string {
  return value ? yes : no
}

export default function DriverTripDetailPage({
  params,
}: {
  params?: { id?: string | string[] }
}) {
  const t = useT()
  return (
    <DriverTripGate
      showShiftPrompt
      title={t('taxi_fleet.driverApp.trips.detail', 'Trip')}
    >
      <DriverTripDetailContent params={params} />
    </DriverTripGate>
  )
}

function DriverTripDetailContent({
  params,
}: {
  params?: { id?: string | string[] }
}) {
  const t = useT()
  const { shiftActive } = useDriverTripGateShift()
  const { resolveTripStatusLabel, resolveTripTypeLabel } = useTaxiFleetLabels()
  const tripId = resolveTripId(params)
  const [trip, setTrip] = React.useState<TripRow | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [showDetails, setShowDetails] = React.useState(false)
  const [revenueAmount, setRevenueAmount] = React.useState('')
  const [distanceKm, setDistanceKm] = React.useState('')
  const [receiptDocumentNumber, setReceiptDocumentNumber] = React.useState('')
  const [receiptAttachmentId, setReceiptAttachmentId] = React.useState<string | null>(null)
  const [receiptAttachmentName, setReceiptAttachmentName] = React.useState<string | null>(null)
  const [receiptBlobId, setReceiptBlobId] = React.useState<string | null>(null)

  const reload = React.useCallback(async () => {
    if (!tripId) {
      flash(t('taxi_fleet.driverApp.trips.notFound', 'Trip not found.'), 'error')
      return
    }
    const applyTrip = (found: TripRow) => {
      setTrip(found)
      setRevenueAmount(found.revenueAmount != null ? String(found.revenueAmount) : '')
      setDistanceKm(found.distanceKm != null ? String(found.distanceKm) : '')
    }
    const loadFromCache = async (warn: boolean) => {
      const cached = await loadDriverSnapshot<TripRow[] | { items?: TripRow[] }>(
        DRIVER_CACHE_KEYS.trips,
      )
      const found = findTrip(normalizeCachedTrips(cached), tripId)
      if (found) {
        applyTrip(found)
        if (warn) {
          flash(t('taxi_fleet.driverApp.usingCache', 'Showing cached data (offline).'), 'warning')
        }
        return true
      }
      return false
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const ok = await loadFromCache(true)
      if (!ok) flash(t('taxi_fleet.driverApp.trips.notFound', 'Trip not found.'), 'error')
      return
    }

    try {
      const { result } = await apiCall<{ items: TripRow[] }>(
        `/api/taxi_fleet/driver/trips?id=${encodeURIComponent(tripId)}`,
      )
      const items = result?.items ?? []
      const found = findTrip(items, tripId)
      if (!found) {
        const ok = await loadFromCache(true)
        if (!ok) flash(t('taxi_fleet.driverApp.trips.notFound', 'Trip not found.'), 'error')
        return
      }
      applyTrip(found)
      await patchCachedTrip(found.id, found as unknown as Record<string, unknown>).catch(
        () => undefined,
      )
    } catch {
      const ok = await loadFromCache(true)
      if (!ok) {
        flash(t('taxi_fleet.driverApp.trips.loadFailed', 'Could not load trips.'), 'error')
      }
    }
  }, [tripId, t])

  useRegisterDriverPullToRefresh(async () => {
    await reload().catch(() => undefined)
  })

  React.useEffect(() => {
    let active = true
    ;(async () => {
      await reload()
      if (!active) return
    })()
    return () => {
      active = false
    }
  }, [reload])

  React.useEffect(() => {
    if (!trip || !tripHasReceiptAttachment(trip)) return
    if (!isTripReceiptProcessing(trip)) return
    const timer = window.setInterval(() => {
      void reload().catch(() => undefined)
    }, 3000)
    return () => window.clearInterval(timer)
  }, [reload, trip])

  async function saveReceipt() {
    if (!trip || (trip.status !== 'completed' && trip.status !== 'scheduled')) return
    if (tripHasReceiptAttachment(trip)) return
    if (!receiptAttachmentId && !receiptBlobId) {
      flash(
        t('taxi_fleet.driverApp.receipt.photoRequired', 'Receipt photo is required for this trip.'),
        'error',
      )
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      const payload: Record<string, unknown> = {
        id: trip.id,
        receiptDocumentNumber: receiptDocumentNumber.trim() || undefined,
      }
      if (receiptAttachmentId) payload.receiptAttachmentId = receiptAttachmentId
      if (receiptBlobId) payload.receiptBlobId = receiptBlobId
      const cachePatch: Record<string, unknown> = {
        receiptAttachmentId: receiptAttachmentId ?? trip.receiptAttachmentId ?? null,
        metadata: {
          ...(trip.metadata && typeof trip.metadata === 'object' ? trip.metadata : {}),
          ...(receiptAttachmentId ? { receiptAttachmentId } : {}),
          ...(receiptDocumentNumber.trim()
            ? { receiptDocumentNumber: receiptDocumentNumber.trim() }
            : {}),
          ...(receiptBlobId ? { receiptBlobId } : {}),
        },
      }
      if (trip.status === 'scheduled') {
        cachePatch.status = 'completed'
        cachePatch.endedAt = new Date().toISOString()
      }
      const { queued } = await putTripUpdate(payload, cachePatch)
      setReceiptAttachmentId(null)
      setReceiptAttachmentName(null)
      setReceiptBlobId(null)
      setReceiptDocumentNumber('')
      if (queued) {
        flash(
          t(
            'taxi_fleet.driverApp.trips.receiptQueuedOffline',
            'Receipt saved offline. It will sync when you are online.',
          ),
          'success',
        )
        setTrip({
          ...trip,
          ...(cachePatch.status ? { status: String(cachePatch.status) } : {}),
          ...(typeof cachePatch.endedAt === 'string' ? { endedAt: cachePatch.endedAt } : {}),
          metadata: cachePatch.metadata as Record<string, unknown>,
          receiptAttachmentId:
            typeof cachePatch.receiptAttachmentId === 'string'
              ? cachePatch.receiptAttachmentId
              : trip.receiptAttachmentId,
        })
      } else {
        flash(
          trip.status === 'scheduled'
            ? t(
                'taxi_fleet.driverApp.trips.receiptCompletedTrip',
                'Receipt saved. Trip marked as completed.',
              )
            : t('taxi_fleet.driverApp.trips.receiptSaved', 'Receipt saved.'),
          'success',
        )
        await reload()
      }
    } catch (err) {
      const message =
        (err as { body?: { error?: string }; message?: string } | null)?.body?.error ||
        (err as { message?: string } | null)?.message
      flash(message || t('taxi_fleet.driverApp.trips.saveFailed', 'Could not save trip.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function savePricing() {
    if (!trip || trip.status !== 'scheduled') return
    const distance = parseNumericValue(distanceKm)
    if (distance == null || distance < 0) {
      flash(t('taxi_fleet.driverApp.trips.distanceInvalid', 'Enter a valid distance.'), 'error')
      return
    }
    const payload: Record<string, unknown> = {
      id: trip.id,
      distanceKm: distance,
    }
    if (!isDriverTripElectronicallyPrepaid(trip)) {
      const revenue = parseNumericValue(revenueAmount)
      if (revenue == null || revenue < 0) {
        flash(t('taxi_fleet.driverApp.trips.revenueInvalid', 'Enter a valid collected payment amount.'), 'error')
        return
      }
      payload.revenueAmount = revenue
    }
    setBusy(true)
    setNotice(null)
    try {
      const cachePatch: Record<string, unknown> = {
        distanceKm: distance.toFixed(2),
        ...(typeof payload.revenueAmount === 'number'
          ? { revenueAmount: payload.revenueAmount.toFixed(2) }
          : {}),
      }
      const { queued } = await putTripUpdate(payload, cachePatch)
      setTrip({
        ...trip,
        distanceKm: distance.toFixed(2),
        ...(typeof payload.revenueAmount === 'number'
          ? { revenueAmount: payload.revenueAmount.toFixed(2) }
          : {}),
      })
      setNotice(
        queued
          ? t(
              'taxi_fleet.driverApp.trips.pricingQueuedOffline',
              'Price saved offline. It will sync when you are online.',
            )
          : t('taxi_fleet.driverApp.trips.pricingSaved', 'Price and distance saved.'),
      )
    } catch {
      flash(t('taxi_fleet.driverApp.trips.saveFailed', 'Could not save trip.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function startTrip() {
    if (!trip || trip.status !== 'scheduled') return
    if (!shiftActive) {
      flash(
        t(
          'taxi_fleet.driverApp.trips.liveRequiresOpenShift',
          'Start a live trip only while your shift is open.',
        ),
        'error',
      )
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      const startedAt = new Date().toISOString()
      const overlap = await findDriverTripOverlap({
        startedAt,
        endedAt: null,
        excludeTripId: trip.id,
      })
      if (overlap) {
        flash(
          t(
            'taxi_fleet.driverApp.trips.overlap',
            'This trip overlaps another registered trip.',
          ),
          'error',
        )
        return
      }
      const { queued } = await putTripUpdate(
        {
          id: trip.id,
          startedAt,
          status: 'in_progress',
        },
        { status: 'in_progress', startedAt, endedAt: null },
      )
      setTrip({ ...trip, status: 'in_progress', startedAt, endedAt: null })
      setNotice(
        queued
          ? t(
              'taxi_fleet.driverApp.trips.startedQueuedOffline',
              'Trip started offline. It will sync when you are online.',
            )
          : t('taxi_fleet.driverApp.trips.started', 'Trip started. Start time updated.'),
      )
    } catch (err) {
      const message =
        (err as { body?: { error?: string }; message?: string } | null)?.body?.error ||
        (err as { message?: string } | null)?.message
      flash(message || t('taxi_fleet.driverApp.trips.startFailed', 'Could not start trip.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function completeTrip() {
    if (!trip || trip.status !== 'in_progress') return
    setBusy(true)
    setNotice(null)
    try {
      const endedAt = new Date().toISOString()
      const startedAt = trip.startedAt || endedAt
      const overlap = await findDriverTripOverlap({
        startedAt,
        endedAt,
        excludeTripId: trip.id,
      })
      if (overlap) {
        flash(
          t(
            'taxi_fleet.driverApp.trips.overlap',
            'This trip overlaps another registered trip.',
          ),
          'error',
        )
        return
      }
      const { queued } = await putTripUpdate(
        {
          id: trip.id,
          endedAt,
          status: 'completed',
        },
        { status: 'completed', endedAt },
      )
      setTrip({ ...trip, status: 'completed', endedAt })
      setNotice(
        queued
          ? t(
              'taxi_fleet.driverApp.trips.completedQueuedOffline',
              'Trip completed offline. It will sync when you are online.',
            )
          : t('taxi_fleet.driverApp.trips.completed', 'Trip completed. End time updated.'),
      )
    } catch (err) {
      const message =
        (err as { body?: { error?: string }; message?: string } | null)?.body?.error ||
        (err as { message?: string } | null)?.message
      flash(
        message || t('taxi_fleet.driverApp.trips.completeFailed', 'Could not complete trip.'),
        'error',
      )
    } finally {
      setBusy(false)
    }
  }

  const isScheduled = trip?.status === 'scheduled'
  const isInProgress = trip?.status === 'in_progress'
  const isFinished = Boolean(trip && isDriverTripFinishedStatus(trip.status))
  const isPlatformTrip = Boolean(trip && isPlatformIngestedTrip(trip.metadata ?? null))
  const canSupplementReceipt =
    Boolean(
      trip &&
        (trip.status === 'completed' || trip.status === 'scheduled') &&
        trip.tripType !== 'internal' &&
        !tripHasReceiptAttachment(trip),
    ) && !isPlatformTrip
  const facingStatus = trip ? resolveDriverFacingTripStatus(trip.status) : ''
  const isPrepaid = trip ? isDriverTripElectronicallyPrepaid(trip) : false
  const resolvedReceiptAttachmentId = trip ? resolveTripReceiptAttachmentId(trip) : null
  const receiptStatusItem = {
    receiptAttachmentId: resolvedReceiptAttachmentId,
    ocrStatus: trip?.ocrStatus ?? null,
    warnings: trip?.warnings ?? [],
  }
  const receiptProcessing = Boolean(trip && isTripReceiptProcessing(receiptStatusItem))
  const receiptVerified = Boolean(trip && isTripReceiptVerified(receiptStatusItem))
  const showReceiptProcessingNotice = receiptProcessing && !receiptVerified
  const receiptWarningMessages = (() => {
    if (!trip || receiptProcessing) return [] as string[]
    const fromWarnings = (trip.warnings ?? []).map((warning) =>
      formatReceiptOcrWarningLabel(t, warning),
    )
    if (fromWarnings.length > 0) return fromWarnings
    if (trip.ocrStatus === 'needs_review' || trip.ocrStatus === 'failed') {
      return [
        t(
          'taxi_fleet.driverApp.trips.needsReview',
          'Document needs review — check OCR results.',
        ),
      ]
    }
    return []
  })()
  const request = trip
    ? tripRequestDetailsFromMetadata(trip.metadata ?? null, {
        distanceKm: trip.distanceKm != null ? String(trip.distanceKm) : null,
        revenueAmount: trip.revenueAmount != null ? String(trip.revenueAmount) : null,
      })
    : null
  const quoteSnapshot = trip ? readQuoteSnapshotFromMetadata(trip.metadata ?? null) : null
  const currency = hasText(trip?.currencyCode) ? trip!.currencyCode!.trim() : 'PLN'
  const unitKm = t('taxi_fleet.driverApp.trips.unitKm', 'km')
  const prepaidLabel = t('taxi_fleet.driverApp.trips.prepaid', 'Prepayment')
  const revenueDisplay = isPrepaid
    ? prepaidLabel
    : withUnit(formatAmount(trip?.revenueAmount), currency)
  const distanceDisplay = withUnit(formatAmount(trip?.distanceKm), unitKm)
  const basePriceRaw =
    typeof quoteSnapshot?.basePrice === 'number' && Number.isFinite(quoteSnapshot.basePrice)
      ? String(quoteSnapshot.basePrice)
      : request?.basePrice?.trim() || null
  const basePriceDisplay = withUnit(basePriceRaw, currency)
  const quoteSurcharges = Array.isArray(quoteSnapshot?.surcharges)
    ? (quoteSnapshot.surcharges as Array<{ code?: string; label?: string; amount?: number }>)
    : []
  const nightOrHolidaySurcharges = quoteSurcharges.filter(
    (line) =>
      (line.code === 'NIGHT' || line.code === 'HOLIDAY') &&
      typeof line.amount === 'number' &&
      Number.isFinite(line.amount),
  )
  const receiptNumber =
    trip?.metadata && typeof trip.metadata.receiptDocumentNumber === 'string'
      ? trip.metadata.receiptDocumentNumber.trim()
      : ''
  const receiptAttachmentIdForPreview = resolvedReceiptAttachmentId ?? ''
  const yesLabel = t('taxi_fleet.driverApp.common.yes', 'Yes')
  const noLabel = t('taxi_fleet.driverApp.common.no', 'No')
  const serviceTypeLabel = request?.serviceType
    ? t(`taxi_fleet.trips.form.serviceTypes.${request.serviceType}`, request.serviceType)
    : null
  const paymentTypeLabel = request?.paymentType
    ? t(`taxi_fleet.trips.form.paymentTypes.${request.paymentType}`, request.paymentType)
    : null
  const vehicleCategoryLabel = request?.vehicleCategory
    ? t(
        `taxi_fleet.trips.form.vehicleCategories.${request.vehicleCategory}`,
        request.vehicleCategory,
      )
    : null

  return (
      <div className="space-y-4">
        <Link
          href="/driver/trips"
          className="inline-flex h-10 items-center gap-2 rounded-md px-1 text-sm font-medium text-[#78829D] transition-colors hover:bg-[#F1F1F4]/50 hover:text-[#4B5675]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t('taxi_fleet.driverApp.trips.backToList', 'Back to trips')}
        </Link>
        {notice ? <Notice variant="info">{notice}</Notice> : null}
        {isPlatformTrip ? (
          <Notice variant="info">
            {t(
              'taxi_fleet.platformSync.driverReadOnly',
              'This trip was imported from a platform app and cannot be edited in the driver app.',
            )}
          </Notice>
        ) : null}
        {showReceiptProcessingNotice ? (
          <Notice variant="info">
            {t(
              'taxi_fleet.driverApp.trips.receiptProcessing',
              'Receipt recognition in progress.',
            )}
          </Notice>
        ) : null}
        {receiptWarningMessages.length > 0 ? (
          <div
            className="rounded-lg border border-[#F6E5A5] bg-[#FFF8DD] px-3 py-2.5"
            role="status"
          >
            <div className="flex gap-2.5">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#DFA000]" aria-hidden />
              <div className="min-w-0 space-y-1">
                <div className="text-xs font-semibold text-[#7A5B00]">
                  {t('taxi_fleet.driverApp.trips.warningTitle', 'Attention')}
                </div>
                <ul className="space-y-1">
                  {receiptWarningMessages.map((message, index) => (
                    <li key={`${message}-${index}`} className="text-sm text-[#7A5B00]">
                      {message}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}
        {trip && request ? (
          <>
            <div className={driverCardClass}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className={driverSectionTitleClass}>
                    {t('taxi_fleet.driverApp.trips.detail', 'Trip')}
                  </div>
                  <p className={driverSectionDescClass}>
                    {isScheduled
                      ? t(
                          'taxi_fleet.driverApp.trips.scheduledHint',
                          'You can adjust price and distance, then start the trip.',
                        )
                      : isInProgress
                        ? t(
                            'taxi_fleet.driverApp.trips.inProgressHint',
                            'Trip is running. Finish when the passenger gets off — only end time will change.',
                          )
                        : isFinished
                          ? t(
                              'taxi_fleet.driverApp.trips.finishedHint',
                              'This trip is finished and cannot be edited.',
                            )
                          : t('taxi_fleet.driverApp.trips.detailHint', 'Overview of this reported trip.')}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <span
                    className={`${isScheduled || isInProgress ? driverBadgeWarningClass : driverBadgeNeutralClass}`}
                  >
                    {resolveTripStatusLabel(facingStatus || trip.status)}
                  </span>
                  <DriverTripReceiptStatusBadge
                    item={receiptStatusItem}
                    t={t}
                  />
                </div>
              </div>

              <div className="mt-4">
                <OptionalDetailRow
                  label={t('taxi_fleet.driverApp.trips.from', 'From')}
                  value={request.fromAddress || null}
                />
                <OptionalDetailRow
                  label={t('taxi_fleet.driverApp.trips.to', 'To')}
                  value={request.toAddress || null}
                />
                <OptionalDetailRow
                  label={t('taxi_fleet.driverApp.trips.startedAt', 'Started at')}
                  value={trip.startedAt ? new Date(trip.startedAt).toLocaleString() : null}
                />
                <OptionalDetailRow
                  label={t('taxi_fleet.driverApp.trips.endedAt', 'Ended at')}
                  value={trip.endedAt ? new Date(trip.endedAt).toLocaleString() : null}
                />
                <OptionalDetailRow
                  label={t('taxi_fleet.driverApp.trips.distance', 'Distance')}
                  value={distanceDisplay}
                />
                <OptionalDetailRow
                  label={t('taxi_fleet.driverApp.trips.revenue', 'Collected payment')}
                  value={revenueDisplay}
                />
              </div>

              {isScheduled ? (
                <div className="mt-4 border-t border-[#F1F1F4] pt-1">
                  <OptionalDetailRow
                    label={t('taxi_fleet.driverApp.trips.customer', 'Customer')}
                    value={
                      request.companyName ||
                      request.contactName ||
                      null
                    }
                  />
                  <OptionalDetailRow
                    label={t('taxi_fleet.driverApp.trips.companyTaxId', 'NIP')}
                    value={request.companyTaxId || null}
                  />
                  <OptionalDetailRow
                    label={t('taxi_fleet.driverApp.trips.contactPhone', 'Phone')}
                    value={request.contactPhone || null}
                  />
                  <OptionalDetailRow
                    label={t('taxi_fleet.driverApp.trips.notes', 'Notes')}
                    value={hasText(trip.notes) ? trip.notes : null}
                  />
                </div>
              ) : null}
            </div>

            {canSupplementReceipt ? (
              <div className={driverCardClass}>
                <div className={driverSectionTitleClass}>
                  {t('taxi_fleet.driverApp.trips.receiptSupplementTitle', 'Add receipt')}
                </div>
                <p className={driverSectionDescClass}>
                  {isScheduled
                    ? t(
                        'taxi_fleet.driverApp.trips.receiptCompletesScheduledHint',
                        'Uploading a receipt will mark this scheduled trip as completed.',
                      )
                    : t(
                        'taxi_fleet.driverApp.trips.receiptSupplementHint',
                        'This trip has no receipt yet. You can add one now.',
                      )}
                </p>
                <div className="mt-4">
                  <DriverReceiptFields
                    documentNumber={receiptDocumentNumber}
                    attachmentId={receiptAttachmentId}
                    attachmentName={receiptAttachmentName}
                    draftRecordId={trip.id}
                    purpose="trip"
                    required
                    disabled={busy}
                    onDocumentNumberChange={setReceiptDocumentNumber}
                    onAttachmentChange={({ id, fileName }) => {
                      setReceiptAttachmentId(id)
                      setReceiptAttachmentName(fileName)
                      setReceiptBlobId(null)
                    }}
                    onOfflineFile={async (file) => {
                      const dataBase64 = await fileToBase64(file)
                      const row = await saveReceiptBlob({
                        draftRecordId: trip.id,
                        fileName: file.name,
                        mime: file.type || 'application/octet-stream',
                        dataBase64,
                      })
                      return { blobId: row.id, fileName: row.fileName }
                    }}
                    onOfflineStored={({ blobId, fileName }) => {
                      setReceiptBlobId(blobId)
                      setReceiptAttachmentId(null)
                      setReceiptAttachmentName(fileName)
                    }}
                  />
                </div>
                <Button
                  type="button"
                  className={`${driverPrimaryActionClass} mt-4`}
                  disabled={busy || (!receiptAttachmentId && !receiptBlobId)}
                  onClick={() => void saveReceipt()}
                >
                  {busy
                    ? t('taxi_fleet.driverApp.trips.saving', 'Saving…')
                    : t('taxi_fleet.driverApp.trips.saveReceipt', 'Save receipt')}
                </Button>
              </div>
            ) : null}

            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              className="h-11 w-full gap-2 text-[#78829D] hover:!bg-[#F1F1F4]/50 hover:!text-[#4B5675]"
              onClick={() => setShowDetails((open) => !open)}
              aria-expanded={showDetails}
            >
              <List className="size-4" aria-hidden />
              {showDetails
                ? t('taxi_fleet.driverApp.trips.hideDetails', 'Hide details')
                : t('taxi_fleet.driverApp.trips.showDetails', 'Details')}
              <ChevronDown
                className={`size-4 transition-transform ${showDetails ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </Button>

            {showDetails ? (
              <div className={driverCardClass}>
                <div className={driverSectionTitleClass}>
                  {t('taxi_fleet.driverApp.trips.moreDetails', 'More details')}
                </div>
                <div className="mt-4">
                  <OptionalDetailRow
                    label={t('taxi_fleet.driverApp.trips.type', 'Type')}
                    value={trip.tripType ? resolveTripTypeLabel(trip.tripType) : null}
                  />
                  <OptionalDetailRow
                    label={t('taxi_fleet.driverApp.trips.serviceType', 'Service')}
                    value={serviceTypeLabel}
                  />
                  <OptionalDetailRow
                    label={t('taxi_fleet.driverApp.trips.waypoints', 'Via')}
                    value={request.waypointAddresses || null}
                  />
                  <OptionalDetailRow
                    label={t('taxi_fleet.driverApp.trips.duration', 'Duration')}
                    value={request.durationText || null}
                  />
                  <OptionalDetailRow
                    label={t('taxi_fleet.driverApp.trips.passengers', 'Passengers')}
                    value={request.passengers || null}
                  />
                  <OptionalDetailRow
                    label={t('taxi_fleet.driverApp.trips.vehicleCategory', 'Vehicle')}
                    value={vehicleCategoryLabel}
                  />
                  <OptionalDetailRow
                    label={t('taxi_fleet.driverApp.trips.paymentType', 'Payment')}
                    value={paymentTypeLabel}
                  />
                  <OptionalDetailRow
                    label={t('taxi_fleet.driverApp.trips.basePrice', 'Base price')}
                    value={basePriceDisplay}
                  />
                  {nightOrHolidaySurcharges.map((line) => (
                    <OptionalDetailRow
                      key={line.code ?? line.label}
                      label={
                        line.label?.trim() ||
                        (line.code === 'NIGHT'
                          ? t('taxi_fleet.driverApp.trips.surchargeNight', 'Night surcharge')
                          : t('taxi_fleet.driverApp.trips.surchargeHoliday', 'Sunday/holiday surcharge'))
                      }
                      value={withUnit(
                        typeof line.amount === 'number' ? line.amount.toFixed(2) : null,
                        currency,
                      )}
                    />
                  ))}
                  <OptionalDetailRow
                    label={t('taxi_fleet.driverApp.trips.contactName', 'Contact')}
                    value={request.contactName || null}
                  />
                  <OptionalDetailRow
                    label={t('taxi_fleet.driverApp.trips.contactPhone', 'Phone')}
                    value={request.contactPhone || null}
                  />
                  <OptionalDetailRow
                    label={t('taxi_fleet.driverApp.trips.contactEmail', 'Email')}
                    value={request.contactEmail || null}
                  />
                  <OptionalDetailRow
                    label={t('taxi_fleet.driverApp.trips.companyName', 'Company')}
                    value={request.companyName || null}
                  />
                  <OptionalDetailRow
                    label={t('taxi_fleet.driverApp.trips.flightNumber', 'Flight')}
                    value={request.flightNumber || null}
                  />
                  <OptionalDetailRow
                    label={t('taxi_fleet.driverApp.trips.childSeats', 'Child seats')}
                    value={Number(request.childSeats) > 0 ? request.childSeats : null}
                  />
                  <OptionalDetailRow
                    label={t('taxi_fleet.driverApp.trips.boosterSeats', 'Booster seats')}
                    value={Number(request.boosterSeats) > 0 ? request.boosterSeats : null}
                  />
                  <OptionalDetailRow
                    label={t('taxi_fleet.driverApp.trips.handLuggage', 'Hand luggage')}
                    value={Number(request.handLuggage) > 0 ? request.handLuggage : null}
                  />
                  <OptionalDetailRow
                    label={t('taxi_fleet.driverApp.trips.holdLuggage', 'Hold luggage')}
                    value={Number(request.holdLuggage) > 0 ? request.holdLuggage : null}
                  />
                  <OptionalDetailRow
                    label={t('taxi_fleet.driverApp.trips.meetAndGreet', 'Meet & greet')}
                    value={request.meetAndGreet ? yesNo(true, yesLabel, noLabel) : null}
                  />
                  <OptionalDetailRow
                    label={t('taxi_fleet.driverApp.trips.englishDriver', 'English-speaking driver')}
                    value={
                      request.englishSpeakingDriver ? yesNo(true, yesLabel, noLabel) : null
                    }
                  />
                  <OptionalDetailRow
                    label={t('taxi_fleet.driverApp.receipt.number', 'Receipt number')}
                    value={receiptNumber || null}
                  />
                  {receiptAttachmentIdForPreview ? (
                    <div className="border-b border-[#F1F1F4] py-3 last:border-b-0">
                      <div className={driverMutedTextClass}>
                        {t('taxi_fleet.driverApp.receipt.photo', 'Receipt photo')}
                      </div>
                      <DriverReceiptPreview attachmentId={receiptAttachmentIdForPreview} />
                    </div>
                  ) : null}
                  <OptionalDetailRow
                    label={t('taxi_fleet.driverApp.trips.notes', 'Notes')}
                    value={hasText(trip.notes) ? trip.notes : null}
                  />
                </div>
              </div>
            ) : null}

            {isScheduled && !isPlatformTrip ? (
              <div className="space-y-3">
                <div className={driverCardClass}>
                  <div className={driverSectionTitleClass}>
                    {t('taxi_fleet.driverApp.trips.pricingTitle', 'Price and distance')}
                  </div>
                  <p className={driverSectionDescClass}>
                    {isPrepaid
                      ? t(
                          'taxi_fleet.driverApp.trips.pricingHintPrepaid',
                          'Payment was collected online. You can still correct the distance.',
                        )
                      : t(
                          'taxi_fleet.driverApp.trips.pricingHint',
                          'Only these fields can be changed while the trip is scheduled.',
                        )}
                  </p>
                  <div className="mt-4 space-y-4">
                    <div>
                      <div className={driverLabelClass}>
                        {t('taxi_fleet.driverApp.trips.revenue', 'Collected payment')}
                      </div>
                      {isPrepaid ? (
                        <div className={`${driverFieldClass} flex items-center bg-[#F9F9F9] text-[#071437]`}>
                          {prepaidLabel}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            id="revenueAmount"
                            type="text"
                            inputMode="decimal"
                            disabled={busy}
                            value={revenueAmount}
                            onChange={(event) => setRevenueAmount(event.target.value)}
                            className={`${driverFieldClass} min-w-0 flex-1 tabular-nums`}
                          />
                          <span className={`shrink-0 ${driverMutedTextClass}`}>{currency}</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <label htmlFor="distanceKm" className={driverLabelClass}>
                        {t('taxi_fleet.driverApp.trips.distance', 'Distance')}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          id="distanceKm"
                          type="text"
                          inputMode="decimal"
                          disabled={busy}
                          value={distanceKm}
                          onChange={(event) => setDistanceKm(event.target.value)}
                          className={`${driverFieldClass} min-w-0 flex-1 tabular-nums`}
                        />
                        <span className={`shrink-0 ${driverMutedTextClass}`}>{unitKm}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  className={driverSecondaryActionClass}
                  disabled={busy}
                  onClick={() => void savePricing()}
                >
                  {busy
                    ? t('taxi_fleet.driverApp.trips.saving', 'Saving…')
                    : isPrepaid
                      ? t('taxi_fleet.driverApp.trips.saveDistance', 'Save distance')
                      : t('taxi_fleet.driverApp.trips.savePricing', 'Save price and distance')}
                </Button>
                <Button
                  type="button"
                  className={driverPrimaryActionClass}
                  disabled={busy || !shiftActive}
                  onClick={() => void startTrip()}
                >
                  {busy
                    ? t('taxi_fleet.driverApp.trips.starting', 'Starting…')
                    : !shiftActive
                      ? t(
                          'taxi_fleet.driverApp.trips.startNeedsShift',
                          'Start shift to begin trip',
                        )
                      : t('taxi_fleet.driverApp.trips.start', 'Start trip')}
                </Button>
              </div>
            ) : null}

            {isInProgress && !isPlatformTrip ? (
              <Button
                type="button"
                className={driverPrimaryActionClass}
                disabled={busy}
                onClick={() => void completeTrip()}
              >
                {busy
                  ? t('taxi_fleet.driverApp.trips.ending', 'Ending…')
                  : t('taxi_fleet.driverApp.trips.endLive', 'End trip')}
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
  )
}
