'use client'

import React, { Suspense } from 'react'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useT } from '@open-mercato/shared/lib/i18n/context'
import { parseNumericValue } from '@open-mercato/shared/lib/numeric'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Button } from '@open-mercato/ui/primitives/button'
import { Notice } from '@open-mercato/ui/primitives/Notice'
import {
  DriverCommercialStep,
  validateCommercialStep,
  type DriverCommercialValue,
} from '../../../../components/driverApp/DriverCommercialStep'
import { DriverRouteStep, type DriverRouteStepValue } from '../../../../components/driverApp/DriverRouteStep'
import { DriverTripGate } from '../../../../components/driverApp/DriverTripGate'
import {
  driverCardClass,
  driverPrimaryActionClass,
  driverSecondaryActionClass,
  driverSectionDescClass,
  driverSectionTitleClass,
} from '../../../../components/driverApp/driverUi'
import {
  appendPendingTripToCache,
  enqueueDriverMutation,
} from '../../../../lib/driverOffline/outbox'
import { findDriverTripOverlap } from '../../../../lib/driverTripOverlapClient'
import {
  buildDriverTripPayload,
  fileToBase64,
  fromDateTimeLocalValue,
  toDateTimeLocalValue,
} from '../../../../lib/driverOffline/buildTripPayload'
import {
  clearLiveTripDraft,
  getLiveTripDraft,
  newClientId,
  saveReceiptBlob,
  upsertLiveTripDraft,
} from '../../../../lib/driverOffline/tripDrafts'
import {
  createEmptyPlace,
  endsDistanceKm,
  formatCoordAddress,
  trackDistanceKm,
  type DriverLiveTripDraft,
} from '../../../../lib/driverOffline/tripTypes'

type Phase = 'active' | 'route' | 'commercial'

function emptyCommercial(): DriverCommercialValue {
  return {
    completionMode: 'manual',
    tripType: 'client',
    platform: null,
    paymentType: 'cash',
    customerEntityId: '',
    customerLabel: '',
    revenueAmount: '0.00',
    receiptDocumentNumber: '',
    receiptAttachmentId: null,
    receiptAttachmentName: null,
    receiptBlobId: null,
    notes: '',
  }
}

export default function DriverLiveTripPage() {
  return (
    <Suspense fallback={null}>
      <DriverLiveTripPageInner />
    </Suspense>
  )
}

function DriverLiveTripPageInner() {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const draftId = searchParams.get('id') || ''
  const [busy, setBusy] = React.useState(false)
  const [draft, setDraft] = React.useState<DriverLiveTripDraft | null>(null)
  const [phase, setPhase] = React.useState<Phase>('active')
  const [route, setRoute] = React.useState<DriverRouteStepValue | null>(null)
  const [commercial, setCommercial] = React.useState<DriverCommercialValue>(emptyCommercial)
  const [receiptDraftRecordId] = React.useState(newClientId)

  React.useEffect(() => {
    if (!draftId) return
    void getLiveTripDraft(draftId).then(async (row) => {
      if (!row) {
        router.replace('/driver/trips/new')
        return
      }
      if (row.serverTripId && navigator.onLine) {
        try {
          const { result } = await apiCall<{ items?: Array<{ id: string; status?: string }> }>(
            '/api/taxi_fleet/driver/trips',
          )
          const serverTrip = (result?.items ?? []).find((item) => item.id === row.serverTripId)
          if (!serverTrip || serverTrip.status !== 'in_progress') {
            await clearLiveTripDraft(row.id)
            flash(
              t('taxi_fleet.driverApp.trips.liveGone', 'This trip is no longer available.'),
              'warning',
            )
            router.replace('/driver/trips')
            return
          }
        } catch {
          // keep local draft when the check fails (offline / transient error)
        }
      }
      setDraft(row)
      if (row.phase === 'ended' || row.phase === 'finishing') {
        setPhase('route')
        setRoute({
          from: row.from,
          to: row.to,
          waypoints: row.waypoints,
          startedAtLocal: toDateTimeLocalValue(new Date(row.startedAt)),
          endedAtLocal: toDateTimeLocalValue(new Date(row.endedAt || Date.now())),
          distanceKm: row.distanceKm != null ? String(row.distanceKm) : '',
          durationText: row.durationText || '',
        })
      }
    })
  }, [draftId, router, t])

  // Track GPS while active
  React.useEffect(() => {
    if (!draft || draft.phase !== 'active' || !navigator.geolocation) return
    let wakeLock: WakeLockSentinel | null = null
    void navigator.wakeLock?.request('screen').then((lock) => {
      wakeLock = lock
    }).catch(() => undefined)

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const point = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          recordedAt: new Date().toISOString(),
        }
        void (async () => {
          const current = await getLiveTripDraft(draft.id)
          if (!current || current.phase !== 'active') return
          const track = [...current.track, point].slice(-500)
          const next = await upsertLiveTripDraft({ ...current, track })
          setDraft(next)
        })()
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    )

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const point = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            recordedAt: new Date().toISOString(),
          }
          void (async () => {
            const current = await getLiveTripDraft(draft.id)
            if (!current || current.phase !== 'active') return
            await upsertLiveTripDraft({ ...current, track: [...current.track, point].slice(-500) })
          })()
        },
        () => undefined,
        { enableHighAccuracy: true, timeout: 10000 },
      )
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      navigator.geolocation.clearWatch(watchId)
      document.removeEventListener('visibilitychange', onVisible)
      void wakeLock?.release().catch(() => undefined)
    }
  }, [draft?.id, draft?.phase])

  async function endTrip() {
    if (!draft) return
    setBusy(true)
    try {
      let to = createEmptyPlace()
      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 12000,
            })
          })
          const lat = position.coords.latitude
          const lon = position.coords.longitude
          try {
            const { result } = await apiCall<{ address?: string }>(
              `/api/taxi_fleet/route/reverse-geocode?lat=${lat}&lng=${lon}&lang=${locale === 'en' ? 'en' : 'pl'}`,
            )
            to = {
              address: result?.address?.trim() || formatCoordAddress(lat, lon),
              lat,
              lon,
            }
          } catch {
            to = { address: formatCoordAddress(lat, lon), lat, lon }
          }
        } catch {
          // leave empty for manual edit
        }
      }

      const endedAt = new Date().toISOString()
      let distanceKm =
        trackDistanceKm(draft.track) ??
        endsDistanceKm(draft.from, to)

      if (navigator.onLine && draft.from.address && to.address) {
        try {
          const stops = [draft.from, ...draft.waypoints, to]
            .filter((p) => p.address.trim())
            .map((p) => ({ address: p.address, lat: p.lat ?? undefined, lon: p.lon ?? undefined }))
          const { result } = await apiCall<{ distanceKm?: number; durationText?: string }>(
            '/api/taxi_fleet/route/distance',
            {
              method: 'POST',
              body: JSON.stringify({ stops, lang: locale === 'en' ? 'en' : 'pl' }),
            },
          )
          if (typeof result?.distanceKm === 'number') distanceKm = result.distanceKm
          const next = await upsertLiveTripDraft({
            ...draft,
            phase: 'ended',
            to,
            endedAt,
            distanceKm: distanceKm ?? null,
            durationText: result?.durationText ?? null,
          })
          setDraft(next)
          setRoute({
            from: next.from,
            to: next.to,
            waypoints: next.waypoints,
            startedAtLocal: toDateTimeLocalValue(new Date(next.startedAt)),
            endedAtLocal: toDateTimeLocalValue(new Date(endedAt)),
            distanceKm: next.distanceKm != null ? String(next.distanceKm) : '',
            durationText: next.durationText || '',
          })
          setPhase('route')
          return
        } catch {
          // fall through
        }
      }

      const next = await upsertLiveTripDraft({
        ...draft,
        phase: 'ended',
        to,
        endedAt,
        distanceKm: distanceKm ?? null,
      })
      setDraft(next)
      setRoute({
        from: next.from,
        to: next.to,
        waypoints: next.waypoints,
        startedAtLocal: toDateTimeLocalValue(new Date(next.startedAt)),
        endedAtLocal: toDateTimeLocalValue(new Date(endedAt)),
        distanceKm: next.distanceKm != null ? String(next.distanceKm) : '',
        durationText: '',
      })
      setPhase('route')
    } catch {
      flash(t('taxi_fleet.driverApp.trips.liveEndFailed', 'Could not end live trip.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function finishTrip() {
    if (!draft || !route) return
    const commercialError = validateCommercialStep(commercial, t)
    if (commercialError) {
      flash(commercialError, 'error')
      return
    }
    if (!route.from.address.trim() || !route.to.address.trim()) {
      flash(t('taxi_fleet.driverApp.trips.routeRequired', 'From and to addresses are required.'), 'error')
      return
    }
    setBusy(true)
    try {
      const distance = parseNumericValue(route.distanceKm)
      const payload = buildDriverTripPayload({
        route: {
          from: route.from,
          to: route.to,
          waypoints: route.waypoints,
          startedAt: fromDateTimeLocalValue(route.startedAtLocal),
          endedAt: fromDateTimeLocalValue(route.endedAtLocal),
          distanceKm: distance,
          durationText: route.durationText,
        },
        commercial,
        resourceId: draft.resourceId,
        assignmentId: draft.assignmentId,
        status: 'completed',
        serverTripId: draft.serverTripId,
      })
      const mutationType = draft.serverTripId ? 'trip.update' : 'trip.create'
      if (!navigator.onLine) {
        await enqueueDriverMutation({
          type: mutationType,
          payload,
          clientMutationId: draft.clientMutationId,
        })
        await appendPendingTripToCache({
          id: draft.serverTripId || draft.clientMutationId,
          tripType: commercial.tripType,
          status: 'completed',
          startedAt: payload.startedAt,
          endedAt: payload.endedAt,
          distanceKm: payload.distanceKm,
          revenueAmount: payload.revenueAmount,
          notes: commercial.notes,
          pending: true,
        })
        await clearLiveTripDraft(draft.id)
        router.replace('/driver/trips')
        return
      }
      await apiCall('/api/taxi_fleet/driver/trips', {
        method: mutationType === 'trip.update' ? 'PUT' : 'POST',
        body: JSON.stringify({ ...payload, clientMutationId: draft.clientMutationId }),
      })
      await clearLiveTripDraft(draft.id)
      router.replace('/driver/trips')
    } catch (err) {
      const message =
        (err as { body?: { error?: string }; message?: string } | null)?.body?.error ||
        (err as { message?: string } | null)?.message
      flash(message || t('taxi_fleet.driverApp.trips.saveFailed', 'Could not save trip.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!draft) {
    return (
      <DriverTripGate title={t('taxi_fleet.driverApp.trips.liveTitle', 'Live trip')}>
        <Notice>{t('taxi_fleet.driverApp.trips.loading', 'Loading…')}</Notice>
      </DriverTripGate>
    )
  }

  return (
    <DriverTripGate title={t('taxi_fleet.driverApp.trips.liveTitle', 'Live trip')}>
      <div className="space-y-4">

        {phase === 'active' ? (
          <div className="space-y-4">
            <div className={driverCardClass}>
              <div className={driverSectionTitleClass}>
                {t('taxi_fleet.driverApp.trips.liveInProgress', 'Trip in progress')}
              </div>
              <p className={driverSectionDescClass}>
                {t(
                  'taxi_fleet.driverApp.trips.liveInProgressHint',
                  'Start location is saved. End the trip when the passenger gets off.',
                )}
              </p>
              <div className="mt-4 space-y-2 text-sm text-[#071437]">
                <div>
                  <span className="text-[#78829D]">
                    {t('taxi_fleet.driverApp.trips.from', 'From')}:{' '}
                  </span>
                  {draft.from.address || '—'}
                </div>
                <div>
                  <span className="text-[#78829D]">
                    {t('taxi_fleet.driverApp.trips.startedAt', 'Started at')}:{' '}
                  </span>
                  {new Date(draft.startedAt).toLocaleString()}
                </div>
                <div>
                  <span className="text-[#78829D]">
                    {t('taxi_fleet.driverApp.trips.trackPoints', 'GPS points')}:{' '}
                  </span>
                  {draft.track.length}
                </div>
              </div>
            </div>
            <Button
              type="button"
              className={driverPrimaryActionClass}
              disabled={busy}
              onClick={() => void endTrip()}
            >
              {busy
                ? t('taxi_fleet.driverApp.trips.ending', 'Ending…')
                : t('taxi_fleet.driverApp.trips.endLive', 'End trip')}
            </Button>
          </div>
        ) : null}

        {phase === 'route' && route ? (
          <div className="space-y-4">
            <div className={driverCardClass}>
              <div className={driverSectionTitleClass}>
                {t('taxi_fleet.driverApp.trips.routeStep', 'Route and times')}
              </div>
              <div className="mt-5">
                <DriverRouteStep
                  value={route}
                  disabled={busy}
                  onChange={setRoute}
                  onError={(message) => flash(message, 'error')}
                />
              </div>
            </div>
            <Button
              type="button"
              className={`${driverPrimaryActionClass} gap-2`}
              disabled={busy}
              onClick={() => {
                if (!route.from.address.trim() || !route.to.address.trim()) {
                  flash(
                    t('taxi_fleet.driverApp.trips.routeRequired', 'From and to addresses are required.'),
                    'error',
                  )
                  return
                }
                if (!route.startedAtLocal || !route.endedAtLocal) {
                  flash(t('taxi_fleet.driverApp.trips.timesRequired', 'Start and end time are required.'), 'error')
                  return
                }
                void (async () => {
                  const startedAt = fromDateTimeLocalValue(route.startedAtLocal)
                  const endedAt = fromDateTimeLocalValue(route.endedAtLocal)
                  const startedMs = new Date(startedAt).getTime()
                  const endedMs = new Date(endedAt).getTime()
                  if (Number.isNaN(startedMs) || Number.isNaN(endedMs)) {
                    flash(
                      t('taxi_fleet.driverApp.trips.timesRequired', 'Start and end time are required.'),
                      'error',
                    )
                    return
                  }
                  if (endedMs <= startedMs) {
                    flash(
                      t(
                        'taxi_fleet.driverApp.trips.invalidTimes',
                        'Trip end time must be after start time.',
                      ),
                      'error',
                    )
                    return
                  }
                  const overlap = await findDriverTripOverlap({
                    startedAt,
                    endedAt,
                    excludeTripId: draft.serverTripId,
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
                  setPhase('commercial')
                })()
              }}
            >
              {t('taxi_fleet.driverApp.trips.nextCommercial', 'Next: trip details')}
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
        ) : null}

        {phase === 'commercial' ? (
          <div className="space-y-4">
            <div className={driverCardClass}>
              <DriverCommercialStep
                value={commercial}
                disabled={busy}
                receiptDraftRecordId={receiptDraftRecordId}
                onChange={setCommercial}
                onReceiptFileOffline={async (file) => {
                  const dataBase64 = await fileToBase64(file)
                  const row = await saveReceiptBlob({
                    draftRecordId: receiptDraftRecordId,
                    fileName: file.name,
                    mime: file.type || 'application/octet-stream',
                    dataBase64,
                  })
                  return { blobId: row.id, fileName: row.fileName }
                }}
              />
            </div>
            <Button
              type="button"
              className={`${driverPrimaryActionClass} gap-2`}
              disabled={busy}
              onClick={() => void finishTrip()}
            >
              <Check className="size-4" aria-hidden />
              {busy
                ? t('taxi_fleet.driverApp.trips.saving', 'Saving…')
                : t('taxi_fleet.driverApp.trips.saveChanges', 'Save Changes')}
            </Button>
            <Button
              type="button"
              className={`${driverSecondaryActionClass} gap-2`}
              disabled={busy}
              onClick={() => setPhase('route')}
            >
              <ChevronLeft className="size-4" aria-hidden />
              {t('taxi_fleet.driverApp.trips.back', 'Back')}
            </Button>
          </div>
        ) : null}
      </div>
    </DriverTripGate>
  )
}
