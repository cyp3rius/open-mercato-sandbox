'use client'

import React from 'react'
import { CalendarClock, Check, ChevronLeft, ChevronRight, History, Play } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { parseNumericValue } from '@open-mercato/shared/lib/numeric'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Button } from '@open-mercato/ui/primitives/button'
import {
  DriverCommercialStep,
  validateCommercialStep,
  type DriverCommercialValue,
} from '../../../../components/driverApp/DriverCommercialStep'
import { DriverRouteStep, type DriverRouteStepValue } from '../../../../components/driverApp/DriverRouteStep'
import { DriverTripGate } from '../../../../components/driverApp/DriverTripGate'
import {
  driverCardClass,
  driverMutedTextClass,
  driverPrimaryActionClass,
  driverSecondaryActionClass,
  driverSectionDescClass,
  driverSectionTitleClass,
} from '../../../../components/driverApp/driverUi'
import {
  appendPendingTripToCache,
  enqueueDriverMutation,
} from '../../../../lib/driverOffline/outbox'
import {
  buildDriverTripPayload,
  fileToBase64,
  fromDateTimeLocalValue,
  toDateTimeLocalValue,
} from '../../../../lib/driverOffline/buildTripPayload'
import {
  clearLiveTripDraft,
  getActiveLiveTripDraft,
  newClientId,
  saveReceiptBlob,
  startLiveTripDraft,
  upsertLiveTripDraft,
} from '../../../../lib/driverOffline/tripDrafts'
import { createEmptyPlace, formatCoordAddress } from '../../../../lib/driverOffline/tripTypes'
import {
  canDriverCreateLiveTrip,
  findDriverShiftForTripWindow,
  isDriverOnOpenShift,
  type DriverShiftAssignmentLike,
} from '../../../../lib/driverTripShiftWindow'
import { findDriverTripOverlap } from '../../../../lib/driverTripOverlapClient'

type Mode = 'choose' | 'past-route' | 'past-commercial' | 'schedule-route' | 'schedule-commercial'

type AssignmentListItem = DriverShiftAssignmentLike & {
  assignmentDate?: string
  resourceLabel?: string | null
}

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

function emptyRoute(): DriverRouteStepValue {
  const now = toDateTimeLocalValue(new Date())
  return {
    from: createEmptyPlace(),
    to: createEmptyPlace(),
    waypoints: [],
    startedAtLocal: now,
    endedAtLocal: now,
    distanceKm: '',
    durationText: '',
  }
}

function emptyScheduleRoute(): DriverRouteStepValue {
  const start = new Date()
  start.setHours(start.getHours() + 1, 0, 0, 0)
  return {
    ...emptyRoute(),
    startedAtLocal: toDateTimeLocalValue(start),
    endedAtLocal: '',
    distanceKm: '',
    durationText: '',
  }
}

function toDateParam(date: Date): string {
  return date.toISOString().slice(0, 10)
}

async function loadAssignmentsAround(startedAt: Date, endedAt: Date): Promise<AssignmentListItem[]> {
  const from = new Date(startedAt)
  from.setUTCDate(from.getUTCDate() - 1)
  const to = new Date(endedAt)
  to.setUTCDate(to.getUTCDate() + 1)
  const params = new URLSearchParams({
    dateFrom: toDateParam(from),
    dateTo: toDateParam(to),
  })
  const { result } = await apiCall<{ items: AssignmentListItem[] }>(
    `/api/taxi_fleet/driver/assignments?${params}`,
  )
  return Array.isArray(result?.items) ? result.items : []
}

export default function DriverTripCreatePage() {
  const t = useT()
  const router = useRouter()
  const [mode, setMode] = React.useState<Mode>('choose')
  const [busy, setBusy] = React.useState(false)
  const [resourceId, setResourceId] = React.useState('')
  const [assignmentId, setAssignmentId] = React.useState<string | null>(null)
  const [resourceLabel, setResourceLabel] = React.useState<string | null>(null)
  const [onOpenShift, setOnOpenShift] = React.useState(false)
  const [route, setRoute] = React.useState<DriverRouteStepValue>(emptyRoute)
  const [commercial, setCommercial] = React.useState<DriverCommercialValue>(emptyCommercial)
  const [receiptDraftRecordId] = React.useState(newClientId)
  const [activeLiveId, setActiveLiveId] = React.useState<string | null>(null)

  const canLive = canDriverCreateLiveTrip(onOpenShift)

  React.useEffect(() => {
    void apiCall<{
      todayAssignment: {
        id: string
        resourceId: string
        resourceLabel?: string | null
        shiftStart: string | null
        shiftEnd: string | null
      } | null
      profile: {
        defaultResourceId?: string | null
        defaultResourceLabel?: string | null
        defaultResourceIds?: { id: string; label: string; plate?: string | null }[]
      } | null
    }>('/api/taxi_fleet/driver/me')
      .then(({ result }) => {
        if (!result) return
        const today = result.todayAssignment
        const open = isDriverOnOpenShift(today)
        setOnOpenShift(open)
        if (open && today?.resourceId) {
          setResourceId(today.resourceId)
          setAssignmentId(today.id)
          setResourceLabel(today.resourceLabel?.trim() || null)
          return
        }
        const primaryDefault = result.profile?.defaultResourceIds?.[0]
        setResourceId(today?.resourceId || primaryDefault?.id || result.profile?.defaultResourceId || '')
        setAssignmentId(today?.id ?? null)
        setResourceLabel(
          today?.resourceLabel?.trim() ||
            primaryDefault?.label?.trim() ||
            result.profile?.defaultResourceLabel?.trim() ||
            null,
        )
      })
      .catch(() => undefined)
    void getActiveLiveTripDraft().then((draft) => setActiveLiveId(draft?.id ?? null))
  }, [])

  async function startLive() {
    if (!canLive) {
      flash(
        t(
          'taxi_fleet.driverApp.trips.liveRequiresOpenShift',
          'Start a live trip only while your shift is open.',
        ),
        'error',
      )
      return
    }
    if (!resourceId || !assignmentId) {
      flash(
        t(
          'taxi_fleet.driverApp.trips.vehicleRequired',
          'No vehicle is assigned for this shift.',
        ),
        'error',
      )
      return
    }
    setBusy(true)
    try {
      if (activeLiveId) {
        router.replace(`/driver/trips/live?id=${encodeURIComponent(activeLiveId)}`)
        return
      }
      const liveStartAt = new Date()
      const overlap = await findDriverTripOverlap({
        startedAt: liveStartAt.toISOString(),
        endedAt: null,
        now: liveStartAt,
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
      let from = createEmptyPlace()
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
              `/api/taxi_fleet/route/reverse-geocode?lat=${lat}&lng=${lon}&lang=pl`,
            )
            from = {
              address: result?.address?.trim() || formatCoordAddress(lat, lon),
              lat,
              lon,
            }
          } catch {
            from = { address: formatCoordAddress(lat, lon), lat, lon }
          }
        } catch {
          // keep empty from
        }
      }
      const draft = await startLiveTripDraft({ from, resourceId, assignmentId })

      if (navigator.onLine && resourceId) {
        try {
          const stubCommercial: DriverCommercialValue = { ...emptyCommercial(), tripType: 'private' }
          const payload = buildDriverTripPayload({
            route: {
              from: draft.from,
              to: createEmptyPlace(),
              waypoints: [],
              startedAt: draft.startedAt,
              endedAt: '',
              distanceKm: null,
            },
            commercial: stubCommercial,
            resourceId,
            assignmentId,
            status: 'in_progress',
          })
          const { result } = await apiCall<{ id?: string }>('/api/taxi_fleet/driver/trips', {
            method: 'POST',
            body: JSON.stringify({ ...payload, clientMutationId: draft.clientMutationId }),
          })
          if (result?.id) await upsertLiveTripDraft({ ...draft, serverTripId: result.id })
        } catch (err) {
          const status = (err as { status?: number } | null)?.status
          const message =
            (err as { body?: { error?: string }; message?: string } | null)?.body?.error ||
            (err as { message?: string } | null)?.message
          if (status && status >= 400 && status < 500) {
            await clearLiveTripDraft(draft.id)
            flash(
              message ||
                t(
                  'taxi_fleet.driverApp.trips.overlap',
                  'This trip overlaps another registered trip.',
                ),
              'error',
            )
            return
          }
        }
      }

      router.replace(`/driver/trips/live?id=${encodeURIComponent(draft.id)}`)
    } catch {
      flash(t('taxi_fleet.driverApp.trips.liveStartFailed', 'Could not start live trip.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function resolveShiftForPastTrip(startedAt: string, endedAt: string) {
    const started = new Date(startedAt)
    const ended = new Date(endedAt)
    if (Number.isNaN(started.getTime()) || Number.isNaN(ended.getTime())) {
      return {
        error: t('taxi_fleet.driverApp.trips.timesRequired', 'Start and end time are required.'),
      }
    }
    const nowMs = Date.now()
    if (started.getTime() > nowMs || ended.getTime() > nowMs) {
      return {
        error: t(
          'taxi_fleet.driverApp.trips.outsideShift',
          'Trip times must fall within a past or current shift.',
        ),
      }
    }
    try {
      const items = await loadAssignmentsAround(started, ended)
      const match = findDriverShiftForTripWindow(items, started, ended)
      if (!match) {
        return {
          error: t(
            'taxi_fleet.driverApp.trips.outsideShift',
            'Trip times must fall within a past or current shift.',
          ),
        }
      }
      const matchedRow = items.find((row) => row.id === match.assignmentId)
      return {
        match: {
          ...match,
          resourceLabel: matchedRow?.resourceLabel?.trim() || null,
        },
      }
    } catch {
      return {
        error: t(
          'taxi_fleet.driverApp.trips.outsideShift',
          'Trip times must fall within a past or current shift.',
        ),
      }
    }
  }

  async function submitPast() {
    const commercialError = validateCommercialStep(commercial, t)
    if (commercialError) {
      flash(commercialError, 'error')
      return
    }
    if (!route.from.address.trim() || !route.to.address.trim()) {
      flash(t('taxi_fleet.driverApp.trips.routeRequired', 'From and to addresses are required.'), 'error')
      return
    }
    if (!route.startedAtLocal || !route.endedAtLocal) {
      flash(t('taxi_fleet.driverApp.trips.timesRequired', 'Start and end time are required.'), 'error')
      return
    }
    const startedAt = fromDateTimeLocalValue(route.startedAtLocal)
    const endedAt = fromDateTimeLocalValue(route.endedAtLocal)
    const shift = await resolveShiftForPastTrip(startedAt, endedAt)
    if ('error' in shift && shift.error) {
      flash(shift.error, 'error')
      return
    }
    if (!('match' in shift) || !shift.match) {
      flash(
        t(
          'taxi_fleet.driverApp.trips.outsideShift',
          'Trip times must fall within a past or current shift.',
        ),
        'error',
      )
      return
    }
    const distance = parseNumericValue(route.distanceKm)
    setBusy(true)
    try {
      if (shift.match.resourceLabel) setResourceLabel(shift.match.resourceLabel)
      setResourceId(shift.match.resourceId)
      setAssignmentId(shift.match.assignmentId)
      const payload = buildDriverTripPayload({
        route: {
          from: route.from,
          to: route.to,
          waypoints: route.waypoints,
          startedAt,
          endedAt,
          distanceKm: distance,
          durationText: route.durationText,
        },
        commercial,
        resourceId: shift.match.resourceId,
        assignmentId: shift.match.assignmentId,
        status: 'completed',
      })
      if (!payload.resourceId) {
        flash(
          t(
            'taxi_fleet.driverApp.trips.vehicleRequired',
            'No vehicle is assigned for this shift.',
          ),
          'error',
        )
        return
      }
      const clientMutationId = newClientId()
      if (!navigator.onLine) {
        await enqueueDriverMutation({ type: 'trip.create', payload, clientMutationId })
        await appendPendingTripToCache({
          id: clientMutationId,
          tripType: commercial.tripType,
          status: 'completed',
          startedAt: payload.startedAt,
          endedAt: payload.endedAt,
          distanceKm: payload.distanceKm,
          revenueAmount: payload.revenueAmount,
          notes: commercial.notes,
          pending: true,
        })
        router.replace('/driver/trips')
        return
      }
      await apiCall('/api/taxi_fleet/driver/trips', {
        method: 'POST',
        body: JSON.stringify({ ...payload, clientMutationId }),
      })
      router.replace('/driver/trips')
    } catch (err) {
      const message =
        (err as { body?: { error?: string }; message?: string } | null)?.body?.error ||
        (err as { message?: string } | null)?.message
      flash(
        message || t('taxi_fleet.driverApp.trips.saveFailed', 'Could not save trip.'),
        'error',
      )
    } finally {
      setBusy(false)
    }
  }

  function validateScheduleCommercial(): string | null {
    if (commercial.tripType === 'client' && !commercial.customerEntityId) {
      return t(
        'taxi_fleet.driverApp.trips.customerRequired',
        'Select or create a customer for client trips.',
      )
    }
    const revenue = parseNumericValue(commercial.revenueAmount)
    if (revenue === null || revenue < 0) {
      return t('taxi_fleet.driverApp.trips.revenueInvalid', 'Enter a valid revenue amount.')
    }
    return null
  }

  async function submitSchedule() {
    const commercialError = validateScheduleCommercial()
    if (commercialError) {
      flash(commercialError, 'error')
      return
    }
    if (!route.from.address.trim() || !route.to.address.trim()) {
      flash(t('taxi_fleet.driverApp.trips.routeRequired', 'From and to addresses are required.'), 'error')
      return
    }
    if (!route.startedAtLocal) {
      flash(t('taxi_fleet.driverApp.trips.startRequired', 'Start time is required.'), 'error')
      return
    }
    const startedAt = fromDateTimeLocalValue(route.startedAtLocal)
    const startedMs = new Date(startedAt).getTime()
    if (Number.isNaN(startedMs) || startedMs <= Date.now()) {
      flash(
        t(
          'taxi_fleet.driverApp.trips.scheduleFutureRequired',
          'Scheduled trips must start in the future.',
        ),
        'error',
      )
      return
    }
    let endedAt = ''
    if (route.endedAtLocal.trim()) {
      endedAt = fromDateTimeLocalValue(route.endedAtLocal)
      const endedMs = new Date(endedAt).getTime()
      if (Number.isNaN(endedMs) || endedMs <= startedMs) {
        flash(
          t(
            'taxi_fleet.driverApp.trips.invalidTimes',
            'Trip end time must be after start time.',
          ),
          'error',
        )
        return
      }
    }
    const overlap = await findDriverTripOverlap({
      startedAt,
      endedAt: endedAt || null,
      now: new Date(),
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
    const distance = parseNumericValue(route.distanceKm)
    setBusy(true)
    try {
      const payload = buildDriverTripPayload({
        route: {
          from: route.from,
          to: route.to,
          waypoints: route.waypoints,
          startedAt,
          endedAt,
          distanceKm: distance,
          durationText: route.durationText,
        },
        commercial: { ...commercial, completionMode: 'manual' },
        resourceId: resourceId || undefined,
        assignmentId: assignmentId || undefined,
        status: 'scheduled',
      })
      const clientMutationId = newClientId()
      if (!navigator.onLine) {
        await enqueueDriverMutation({ type: 'trip.create', payload, clientMutationId })
        await appendPendingTripToCache({
          id: clientMutationId,
          tripType: commercial.tripType,
          status: 'scheduled',
          startedAt: payload.startedAt,
          endedAt: payload.endedAt,
          distanceKm: payload.distanceKm,
          revenueAmount: payload.revenueAmount,
          notes: commercial.notes,
          pending: true,
        })
        flash(
          t('taxi_fleet.driverApp.trips.scheduleSavedOffline', 'Trip scheduled offline. It will sync when you are online.'),
          'success',
        )
        router.replace('/driver/trips')
        return
      }
      const { result } = await apiCall<{ id?: string }>('/api/taxi_fleet/driver/trips', {
        method: 'POST',
        body: JSON.stringify({ ...payload, clientMutationId }),
      })
      flash(t('taxi_fleet.driverApp.trips.scheduleSaved', 'Trip scheduled.'), 'success')
      if (result?.id) {
        router.replace(`/driver/trips/${result.id}`)
        return
      }
      router.replace('/driver/trips')
    } catch (err) {
      const message =
        (err as { body?: { error?: string }; message?: string } | null)?.body?.error ||
        (err as { message?: string } | null)?.message
      flash(
        message || t('taxi_fleet.driverApp.trips.saveFailed', 'Could not save trip.'),
        'error',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <DriverTripGate title={t('taxi_fleet.driverApp.trips.new', 'New trip')}>
      <div className="space-y-4">

        {mode === 'choose' ? (
          <div className="space-y-3">
            <div className={driverCardClass}>
              <div className={driverSectionTitleClass}>
                {t('taxi_fleet.driverApp.trips.chooseMode', 'How do you want to add a trip?')}
              </div>
              <p className={driverSectionDescClass}>
                {canLive
                  ? t(
                      'taxi_fleet.driverApp.trips.chooseModeHint',
                      'Start a live trip, schedule a future one, or log a finished trip.',
                    )
                  : t(
                      'taxi_fleet.driverApp.trips.chooseModeHintOffShift',
                      'You are off shift. You can schedule a future trip or add a finished trip from a past shift.',
                    )}
              </p>
              {onOpenShift && resourceLabel ? (
                <p className={`mt-3 ${driverMutedTextClass}`}>
                  {t('taxi_fleet.driverApp.trips.vehicleOnShift', 'Vehicle on this shift')}:{' '}
                  <span className="font-semibold text-[#071437]">{resourceLabel}</span>
                </p>
              ) : null}
            </div>
            {canLive || activeLiveId ? (
              <Button
                type="button"
                className={`${driverPrimaryActionClass} gap-2`}
                disabled={busy || (!canLive && !activeLiveId)}
                onClick={() => void startLive()}
              >
                <Play className="size-4" aria-hidden />
                {activeLiveId
                  ? t('taxi_fleet.driverApp.trips.resumeLive', 'Resume live trip')
                  : t('taxi_fleet.driverApp.trips.modeLive', 'Start live trip')}
              </Button>
            ) : null}
            <Button
              type="button"
              className={`${driverSecondaryActionClass} gap-2`}
              disabled={busy}
              onClick={() => {
                setRoute(emptyScheduleRoute())
                setCommercial(emptyCommercial())
                setMode('schedule-route')
              }}
            >
              <CalendarClock className="size-4" aria-hidden />
              {t('taxi_fleet.driverApp.trips.modeSchedule', 'Schedule trip')}
            </Button>
            <Button
              type="button"
              className={`${driverSecondaryActionClass} gap-2`}
              disabled={busy}
              onClick={() => {
                setMode('past-route')
              }}
            >
              <History className="size-4" aria-hidden />
              {t('taxi_fleet.driverApp.trips.modePast', 'Past trip')}
            </Button>
          </div>
        ) : null}

        {mode === 'past-route' ? (
          <div className="space-y-4">
            <div className={driverCardClass}>
              <div className={driverSectionTitleClass}>
                {t('taxi_fleet.driverApp.trips.routeStep', 'Route and times')}
              </div>
              <p className={driverSectionDescClass}>
                {t(
                  'taxi_fleet.driverApp.trips.routeStepHintShift',
                  'Enter from/to, times, and distance. Times must fall within one of your shifts.',
                )}
              </p>
              <div className="mt-5">
                <DriverRouteStep value={route} disabled={busy} onChange={setRoute} onError={(message) => flash(message, 'error')} />
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
                  const shift = await resolveShiftForPastTrip(startedAt, endedAt)
                  if ('error' in shift && shift.error) {
                    flash(shift.error, 'error')
                    return
                  }
                  const overlap = await findDriverTripOverlap({ startedAt, endedAt })
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
                  setMode('past-commercial')
                  if ('match' in shift && shift.match?.resourceLabel) {
                    setResourceLabel(shift.match.resourceLabel)
                  }
                  if ('match' in shift && shift.match) {
                    setResourceId(shift.match.resourceId)
                    setAssignmentId(shift.match.assignmentId)
                  }
                })()
              }}
            >
              {t('taxi_fleet.driverApp.trips.nextCommercial', 'Next: trip details')}
              <ChevronRight className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              className={`${driverSecondaryActionClass} gap-2`}
              disabled={busy}
              onClick={() => setMode('choose')}
            >
              <ChevronLeft className="size-4" aria-hidden />
              {t('taxi_fleet.driverApp.trips.back', 'Back')}
            </Button>
          </div>
        ) : null}

        {mode === 'past-commercial' ? (
          <div className="space-y-4">
            {resourceLabel ? (
              <div className={`${driverCardClass} py-3`}>
                <p className={driverMutedTextClass}>
                  {t('taxi_fleet.driverApp.trips.vehicleOnShift', 'Vehicle on this shift')}:{' '}
                  <span className="font-semibold text-[#071437]">{resourceLabel}</span>
                </p>
              </div>
            ) : null}
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
              onClick={() => void submitPast()}
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
              onClick={() => setMode('past-route')}
            >
              <ChevronLeft className="size-4" aria-hidden />
              {t('taxi_fleet.driverApp.trips.back', 'Back')}
            </Button>
          </div>
        ) : null}

        {mode === 'schedule-route' ? (
          <div className="space-y-4">
            <div className={driverCardClass}>
              <div className={driverSectionTitleClass}>
                {t('taxi_fleet.driverApp.trips.scheduleRouteStep', 'Route and schedule')}
              </div>
              <p className={driverSectionDescClass}>
                {t(
                  'taxi_fleet.driverApp.trips.scheduleRouteHint',
                  'Set a future start time, addresses, and optional planned end.',
                )}
              </p>
              <div className="mt-5">
                <DriverRouteStep
                  value={route}
                  disabled={busy}
                  requireEndedAt={false}
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
                if (!route.startedAtLocal) {
                  flash(t('taxi_fleet.driverApp.trips.startRequired', 'Start time is required.'), 'error')
                  return
                }
                const startedAt = fromDateTimeLocalValue(route.startedAtLocal)
                const startedMs = new Date(startedAt).getTime()
                if (Number.isNaN(startedMs) || startedMs <= Date.now()) {
                  flash(
                    t(
                      'taxi_fleet.driverApp.trips.scheduleFutureRequired',
                      'Scheduled trips must start in the future.',
                    ),
                    'error',
                  )
                  return
                }
                if (route.endedAtLocal.trim()) {
                  const endedMs = new Date(fromDateTimeLocalValue(route.endedAtLocal)).getTime()
                  if (Number.isNaN(endedMs) || endedMs <= startedMs) {
                    flash(
                      t(
                        'taxi_fleet.driverApp.trips.invalidTimes',
                        'Trip end time must be after start time.',
                      ),
                      'error',
                    )
                    return
                  }
                }
                void (async () => {
                  const overlap = await findDriverTripOverlap({
                    startedAt,
                    endedAt: route.endedAtLocal.trim()
                      ? fromDateTimeLocalValue(route.endedAtLocal)
                      : null,
                    now: new Date(),
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
                  setMode('schedule-commercial')
                })()
              }}
            >
              {t('taxi_fleet.driverApp.trips.nextCommercial', 'Next: trip details')}
              <ChevronRight className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              className={`${driverSecondaryActionClass} gap-2`}
              disabled={busy}
              onClick={() => setMode('choose')}
            >
              <ChevronLeft className="size-4" aria-hidden />
              {t('taxi_fleet.driverApp.trips.back', 'Back')}
            </Button>
          </div>
        ) : null}

        {mode === 'schedule-commercial' ? (
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
              onClick={() => void submitSchedule()}
            >
              <Check className="size-4" aria-hidden />
              {busy
                ? t('taxi_fleet.driverApp.trips.saving', 'Saving…')
                : t('taxi_fleet.driverApp.trips.scheduleSave', 'Schedule trip')}
            </Button>
            <Button
              type="button"
              className={`${driverSecondaryActionClass} gap-2`}
              disabled={busy}
              onClick={() => setMode('schedule-route')}
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
