'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, CarFront, Clock3, Fuel, Plus } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Button } from '@open-mercato/ui/primitives/button'
import { DriverShell } from '../../components/driverApp/DriverShell'
import {
  DriverShiftVehiclePicker,
  buildShiftVehicleOptions,
  useShiftVehicleSelection,
  type DriverDefaultVehicleOption,
} from '../../components/driverApp/DriverShiftVehiclePicker'
import {
  enableDriverTripsBypass,
  hasDriverTripsBypass,
} from '../../components/driverApp/driverTripAccess'
import {
  driverBadgeNeutralClass,
  driverBadgeSuccessClass,
  driverCardClass,
  driverMutedTextClass,
  driverPrimaryActionClass,
  driverSecondaryActionClass,
  driverSectionDescClass,
  driverSectionTitleClass,
} from '../../components/driverApp/driverUi'
import { cacheDriverJson, enqueueDriverMutation, readCachedDriverJson } from '../../lib/driverOffline/outbox'
import { formatVehicleResourceLabel, stripPlateFromVehicleName } from '../../lib/vehicleResourceLabel'

type MeResponse = {
  member: { id: string; displayName: string }
  today?: string
  profile: {
    externalAppEnabled: boolean
    defaultResourceId?: string | null
    defaultResourceIds?: DriverDefaultVehicleOption[]
  } | null
  todayAssignment: {
    id: string
    resourceId: string
    resourceLabel?: string | null
    resourceName?: string | null
    resourcePlate?: string | null
    status: string
    shiftStart: string | null
    shiftEnd: string | null
  } | null
}

type HomeState = 'loading' | 'no_assignment' | 'ready' | 'on_shift' | 'ended'

function formatTime(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function resolveHomeState(assignment: MeResponse['todayAssignment'] | null | undefined): HomeState {
  if (assignment === undefined) return 'loading'
  if (!assignment) return 'no_assignment'
  if (!assignment.shiftStart) return 'ready'
  if (!assignment.shiftEnd) return 'on_shift'
  return 'ended'
}

function ShiftTimes({
  startedLabel,
  endedLabel,
  shiftStart,
  shiftEnd,
}: {
  startedLabel: string
  endedLabel: string
  shiftStart: string | null
  shiftEnd: string | null
}) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      <div className="rounded-lg border border-[#F1F1F4] bg-[#F9F9F9] px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-[#78829D]">
          <Clock3 className="size-3.5" aria-hidden />
          {startedLabel}
        </div>
        <div className="mt-1 text-base font-semibold text-[#071437]">{formatTime(shiftStart)}</div>
      </div>
      <div className="rounded-lg border border-[#F1F1F4] bg-[#F9F9F9] px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-[#78829D]">
          <Clock3 className="size-3.5" aria-hidden />
          {endedLabel}
        </div>
        <div className="mt-1 text-base font-semibold text-[#071437]">{formatTime(shiftEnd)}</div>
      </div>
    </div>
  )
}

function ShiftVehicle({
  label,
  vehicleName,
  vehicleLabel,
  vehiclePlate,
}: {
  label: string
  vehicleName?: string | null
  vehicleLabel: string | null | undefined
  vehiclePlate?: string | null
}) {
  const plate = vehiclePlate?.trim() || null
  const name =
    stripPlateFromVehicleName(vehicleName || vehicleLabel, plate) || null
  const singleLine = formatVehicleResourceLabel(name, plate)
  if (!singleLine) return null
  return (
    <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#F1F1F4] bg-[#F9F9F9] px-3 py-2.5">
      <CarFront className="size-4 shrink-0 text-[#78829D]" aria-hidden />
      <div className="min-w-0">
        <div className="text-xs font-medium text-[#78829D]">{label}</div>
        {name && plate ? (
          <>
            <div className="truncate text-sm font-semibold text-[#071437]">{name}</div>
            <div className="truncate text-xs font-medium text-[#4B5675]">{plate}</div>
          </>
        ) : (
          <div className="truncate text-sm font-semibold text-[#071437]">{singleLine}</div>
        )}
      </div>
    </div>
  )
}

export default function DriverHomePage() {
  const t = useT()
  const router = useRouter()
  const [me, setMe] = React.useState<MeResponse | null>(null)
  const [loaded, setLoaded] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    try {
      const { result } = await apiCall<MeResponse>('/api/taxi_fleet/driver/me')
      setMe(result)
      await cacheDriverJson('driver/me', result)
    } catch (err) {
      const cached = await readCachedDriverJson<MeResponse>('driver/me')
      if (cached) {
        setMe(cached)
        flash(t('taxi_fleet.driverApp.usingCache', 'Showing cached data (offline).'), 'warning')
        return
      }
      const status = (err as { status?: number } | null)?.status
      if (status === 401 || status === 403) {
        router.replace('/driver/login')
        return
      }
      flash(t('taxi_fleet.driverApp.home.loadFailed', 'Could not load driver session.'), 'error')
    } finally {
      setLoaded(true)
    }
  }, [router, t])

  React.useEffect(() => {
    void load()
  }, [load])

  const assignment = me?.todayAssignment ?? null
  const homeState = loaded ? resolveHomeState(assignment) : 'loading'
  const shiftActive = homeState === 'on_shift'
  const profileDefaults = me?.profile?.defaultResourceIds ?? []
  const shiftVehicles = React.useMemo(
    () =>
      buildShiftVehicleOptions({
        defaults: profileDefaults,
        assignment:
          assignment && !assignment.shiftStart
            ? {
                resourceId: assignment.resourceId,
                resourceLabel: assignment.resourceLabel,
                resourceName: assignment.resourceName,
                resourcePlate: assignment.resourcePlate,
              }
            : null,
      }),
    [assignment, profileDefaults],
  )
  const {
    selectedResourceId,
    setSelectedResourceId,
    needsVehiclePick,
  } = useShiftVehicleSelection(
    shiftVehicles,
    assignment && !assignment.shiftStart ? assignment.resourceId : null,
  )
  const hasDefaultsButNoneFree = profileDefaults.length > 0 && !needsVehiclePick

  async function runShift(action: 'start' | 'end') {
    if (!assignment) return
    if (action === 'start' && !selectedResourceId) {
      flash(
        t('taxi_fleet.driverApp.shift.vehicleRequired', 'Select a vehicle before starting your shift.'),
        'error',
      )
      return
    }
    setBusy(true)
    try {
      const resourceId = action === 'start' ? selectedResourceId : null
      if (!navigator.onLine) {
        await enqueueDriverMutation({
          type: 'assignment.shift',
          payload: {
            assignmentId: assignment.id,
            action,
            ...(resourceId ? { resourceId } : {}),
          },
        })
        const picked = resourceId ? shiftVehicles.find((v) => v.id === resourceId) : null
        setMe((prev) =>
          prev && prev.todayAssignment
            ? {
                ...prev,
                todayAssignment: {
                  ...prev.todayAssignment,
                  ...(resourceId
                    ? {
                        resourceId,
                        resourceLabel: picked?.label ?? prev.todayAssignment.resourceLabel,
                        resourceName: picked?.name ?? prev.todayAssignment.resourceName,
                        resourcePlate: picked?.plate ?? prev.todayAssignment.resourcePlate,
                      }
                    : {}),
                  shiftStart:
                    action === 'start' ? new Date().toISOString() : prev.todayAssignment.shiftStart,
                  shiftEnd:
                    action === 'end' ? new Date().toISOString() : prev.todayAssignment.shiftEnd,
                  status: action === 'start' ? 'confirmed' : 'completed',
                },
              }
            : prev,
        )
        return
      }
      await apiCall(`/api/taxi_fleet/driver/assignments/${assignment.id}/shift`, {
        method: 'POST',
        body: JSON.stringify({
          action,
          ...(resourceId ? { resourceId } : {}),
        }),
      })
      await load()
    } catch {
      flash(t('taxi_fleet.driverApp.home.shiftFailed', 'Could not update shift.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function startAdHocShift() {
    if (!selectedResourceId) {
      flash(
        t('taxi_fleet.driverApp.shift.vehicleRequired', 'Select a vehicle before starting your shift.'),
        'error',
      )
      return
    }
    setBusy(true)
    try {
      if (!navigator.onLine) {
        await enqueueDriverMutation({
          type: 'assignment.self_start',
          payload: { resourceId: selectedResourceId },
        })
        const picked = shiftVehicles.find((v) => v.id === selectedResourceId)
        setMe((prev) =>
          prev
            ? {
                ...prev,
                todayAssignment: {
                  id: `local-${selectedResourceId}`,
                  resourceId: selectedResourceId,
                  resourceLabel: picked?.label ?? null,
                  resourceName: picked?.name ?? null,
                  resourcePlate: picked?.plate ?? null,
                  status: 'confirmed',
                  shiftStart: new Date().toISOString(),
                  shiftEnd: null,
                },
              }
            : prev,
        )
        return
      }
      await apiCall('/api/taxi_fleet/driver/assignments/start', {
        method: 'POST',
        body: JSON.stringify({ resourceId: selectedResourceId }),
      })
      await load()
    } catch {
      flash(t('taxi_fleet.driverApp.home.shiftFailed', 'Could not update shift.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  function previewTripsWithoutClockIn() {
    enableDriverTripsBypass()
    router.push('/driver/trips')
  }

  return (
    <DriverShell
      title={t('taxi_fleet.driverApp.home.title', 'Driver home')}
      shiftActive={shiftActive}
      assignmentId={assignment?.id ?? null}
    >
      <div className="space-y-4">

        {homeState === 'loading' ? (
          <div className={`px-1 py-8 text-center ${driverMutedTextClass}`}>
            {t('taxi_fleet.driverApp.loading', 'Loading…')}
          </div>
        ) : null}

        {homeState === 'no_assignment' ? (
          <>
            <div className={driverCardClass}>
              <div className={driverSectionTitleClass}>
                {t('taxi_fleet.driverApp.home.noAssignment', 'No assignment today')}
              </div>
              <p className={driverSectionDescClass}>
                {needsVehiclePick
                  ? t(
                      'taxi_fleet.driverApp.home.adHocHint',
                      'No planned shift for today. Pick a default vehicle to start an ad-hoc shift.',
                    )
                  : hasDefaultsButNoneFree
                    ? t(
                        'taxi_fleet.driverApp.home.noAvailableVehicles',
                        'All your default vehicles are already assigned for today.',
                      )
                    : t(
                        'taxi_fleet.driverApp.home.noAssignmentHint',
                        'Ask dispatch to assign a vehicle for today, or set default vehicles on your profile.',
                      )}
              </p>
              {needsVehiclePick ? (
                <div className="mt-4">
                  <DriverShiftVehiclePicker
                    vehicles={shiftVehicles}
                    value={selectedResourceId}
                    onChange={setSelectedResourceId}
                    disabled={busy}
                  />
                </div>
              ) : null}
              {needsVehiclePick ? (
                <div className="mt-4">
                  <Button
                    type="button"
                    className={driverPrimaryActionClass}
                    disabled={busy || !selectedResourceId}
                    onClick={() => void startAdHocShift()}
                  >
                    {busy
                      ? t('taxi_fleet.driverApp.home.starting', 'Starting…')
                      : t('taxi_fleet.driverApp.home.clockInAdHoc', 'Start ad-hoc shift')}
                  </Button>
                </div>
              ) : null}
            </div>
            <Link href="/driver/assignments" className={`${driverSecondaryActionClass} gap-2`}>
              <CalendarDays className="size-4" aria-hidden />
              {t('taxi_fleet.driverApp.home.viewSchedule', 'View schedule')}
            </Link>
            <Link href="/driver/expenses/new" className={`${driverSecondaryActionClass} gap-2`}>
              <Fuel className="size-4" aria-hidden />
              {t('taxi_fleet.driverApp.home.reportExpense', 'Register a cost')}
            </Link>
          </>
        ) : null}

        {homeState === 'ready' && assignment ? (
          <>
            <div className={driverCardClass}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-[#99A1B7]">
                    {t('taxi_fleet.driverApp.home.todayShift', 'Today’s shift')}
                  </div>
                  <div className="mt-1 text-lg font-semibold capitalize text-[#071437]">
                    {assignment.status}
                  </div>
                </div>
                <span className={driverBadgeNeutralClass}>
                  {t('taxi_fleet.driverApp.offShift', 'Off shift')}
                </span>
              </div>
              <ShiftTimes
                startedLabel={t('taxi_fleet.driverApp.home.started', 'Started')}
                endedLabel={t('taxi_fleet.driverApp.home.ended', 'Ended')}
                shiftStart={assignment.shiftStart}
                shiftEnd={assignment.shiftEnd}
              />
              {!needsVehiclePick ? (
                hasDefaultsButNoneFree ? (
                  <p className={`mt-4 ${driverSectionDescClass}`}>
                    {t(
                      'taxi_fleet.driverApp.home.noAvailableVehicles',
                      'All your default vehicles are already assigned for today.',
                    )}
                  </p>
                ) : (
                  <ShiftVehicle
                    label={t('taxi_fleet.driverApp.vehicle', 'Vehicle')}
                    vehicleName={assignment.resourceName}
                    vehicleLabel={assignment.resourceLabel}
                    vehiclePlate={assignment.resourcePlate}
                  />
                )
              ) : (
                <div className="mt-4">
                  <DriverShiftVehiclePicker
                    vehicles={shiftVehicles}
                    assignmentResourceId={assignment.resourceId}
                    value={selectedResourceId}
                    onChange={setSelectedResourceId}
                    disabled={busy}
                  />
                </div>
              )}
              {needsVehiclePick ? (
                <div className="mt-4">
                  <Button
                    type="button"
                    className={driverPrimaryActionClass}
                    disabled={busy || !selectedResourceId}
                    onClick={() => void runShift('start')}
                  >
                    {t('taxi_fleet.driverApp.home.clockIn', 'Clock in')}
                  </Button>
                </div>
              ) : null}
            </div>
            <Button type="button" className={driverSecondaryActionClass} onClick={previewTripsWithoutClockIn}>
              {t('taxi_fleet.driverApp.home.previewTrips', 'Preview trips only')}
            </Button>
            <Link href="/driver/expenses/new" className={`${driverSecondaryActionClass} gap-2`}>
              <Fuel className="size-4" aria-hidden />
              {t('taxi_fleet.driverApp.home.reportExpense', 'Register a cost')}
            </Link>
            {hasDriverTripsBypass() ? (
              <p className="px-1 text-center text-xs text-[#99A1B7]">
                {t(
                  'taxi_fleet.driverApp.trips.bypassActive',
                  'Browsing without clock-in. Clock in before starting work.',
                )}
              </p>
            ) : null}
          </>
        ) : null}

        {homeState === 'on_shift' && assignment ? (
          <>
            <div className={driverCardClass}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-[#99A1B7]">
                    {t('taxi_fleet.driverApp.home.todayShift', 'Today’s shift')}
                  </div>
                  <div className="mt-1 text-lg font-semibold capitalize text-[#071437]">
                    {assignment.status}
                  </div>
                </div>
                <span className={driverBadgeSuccessClass}>
                  {t('taxi_fleet.driverApp.onShift', 'On shift')}
                </span>
              </div>
              <ShiftTimes
                startedLabel={t('taxi_fleet.driverApp.home.started', 'Started')}
                endedLabel={t('taxi_fleet.driverApp.home.ended', 'Ended')}
                shiftStart={assignment.shiftStart}
                shiftEnd={assignment.shiftEnd}
              />
              <ShiftVehicle
                label={t('taxi_fleet.driverApp.vehicle', 'Vehicle')}
                vehicleName={assignment.resourceName}
                vehicleLabel={assignment.resourceLabel}
                vehiclePlate={assignment.resourcePlate}
              />
            </div>
            <Link href="/driver/trips/new" className={`${driverPrimaryActionClass} gap-2`}>
              <Plus className="size-4" aria-hidden />
              {t('taxi_fleet.driverApp.home.reportTrip', 'Register a trip')}
            </Link>
            <Link href="/driver/expenses/new" className={`${driverSecondaryActionClass} gap-2`}>
              <Fuel className="size-4" aria-hidden />
              {t('taxi_fleet.driverApp.home.reportExpense', 'Register a cost')}
            </Link>
            <Button
              type="button"
              className={driverSecondaryActionClass}
              disabled={busy}
              onClick={() => void runShift('end')}
            >
              {t('taxi_fleet.driverApp.home.clockOut', 'Clock out')}
            </Button>
            <Link href="/driver/trips" className={`${driverSecondaryActionClass} gap-2`}>
              <CarFront className="size-4" aria-hidden />
              {t('taxi_fleet.driverApp.home.viewTrips', 'View trips')}
            </Link>
          </>
        ) : null}

        {homeState === 'ended' && assignment ? (
          <>
            <div className={driverCardClass}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-[#99A1B7]">
                    {t('taxi_fleet.driverApp.home.todayShift', 'Today’s shift')}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-[#071437]">
                    {t('taxi_fleet.driverApp.home.shiftEnded', 'Shift ended')}
                  </div>
                </div>
                <span className={driverBadgeNeutralClass}>
                  {t('taxi_fleet.driverApp.offShift', 'Off shift')}
                </span>
              </div>
              <ShiftTimes
                startedLabel={t('taxi_fleet.driverApp.home.started', 'Started')}
                endedLabel={t('taxi_fleet.driverApp.home.ended', 'Ended')}
                shiftStart={assignment.shiftStart}
                shiftEnd={assignment.shiftEnd}
              />
              <ShiftVehicle
                label={t('taxi_fleet.driverApp.vehicle', 'Vehicle')}
                vehicleName={assignment.resourceName}
                vehicleLabel={assignment.resourceLabel}
                vehiclePlate={assignment.resourcePlate}
              />
            </div>
            {needsVehiclePick ? (
              <div className={`${driverCardClass} space-y-3`}>
                <div className={driverSectionTitleClass}>
                  {t('taxi_fleet.driverApp.home.startAnother', 'Start another shift')}
                </div>
                <p className={driverSectionDescClass}>
                  {t(
                    'taxi_fleet.driverApp.home.startAnotherHint',
                    'Pick a default vehicle to start a new ad-hoc shift.',
                  )}
                </p>
                <DriverShiftVehiclePicker
                  vehicles={shiftVehicles}
                  value={selectedResourceId}
                  onChange={setSelectedResourceId}
                  disabled={busy}
                />
                <Button
                  type="button"
                  className={driverPrimaryActionClass}
                  disabled={busy || !selectedResourceId}
                  onClick={() => void startAdHocShift()}
                >
                  {busy
                    ? t('taxi_fleet.driverApp.home.starting', 'Starting…')
                    : t('taxi_fleet.driverApp.home.clockInAdHoc', 'Start ad-hoc shift')}
                </Button>
              </div>
            ) : hasDefaultsButNoneFree ? (
              <div className={driverCardClass}>
                <p className={driverSectionDescClass}>
                  {t(
                    'taxi_fleet.driverApp.home.noAvailableVehicles',
                    'All your default vehicles are already assigned for today.',
                  )}
                </p>
              </div>
            ) : null}
            <Link href="/driver/trips" className={`${driverSecondaryActionClass} gap-2`}>
              <CarFront className="size-4" aria-hidden />
              {t('taxi_fleet.driverApp.home.viewTrips', 'View trips')}
            </Link>
            <Link href="/driver/expenses/new" className={`${driverSecondaryActionClass} gap-2`}>
              <Fuel className="size-4" aria-hidden />
              {t('taxi_fleet.driverApp.home.reportExpense', 'Register a cost')}
            </Link>
            <Link href="/driver/assignments" className={`${driverSecondaryActionClass} gap-2`}>
              <CalendarDays className="size-4" aria-hidden />
              {t('taxi_fleet.driverApp.home.viewSchedule', 'View schedule')}
            </Link>
          </>
        ) : null}
      </div>
    </DriverShell>
  )
}
