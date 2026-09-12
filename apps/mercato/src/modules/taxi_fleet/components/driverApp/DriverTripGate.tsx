'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Button } from '@open-mercato/ui/primitives/button'
import { DriverShell } from './DriverShell'
import {
  DriverShiftVehiclePicker,
  buildShiftVehicleOptions,
  useShiftVehicleSelection,
  type DriverDefaultVehicleOption,
} from './DriverShiftVehiclePicker'
import { hasDriverTripsBypass } from './driverTripAccess'
import {
  driverCardClass,
  driverMutedTextClass,
  driverPrimaryActionClass,
  driverSecondaryActionClass,
  driverSectionDescClass,
  driverSectionTitleClass,
} from './driverUi'
import { isDriverOnOpenShift } from '../../lib/driverTripShiftWindow'
import { cacheDriverJson, enqueueDriverMutation, readCachedDriverJson } from '../../lib/driverOffline/outbox'

type MeResponse = {
  member: { id: string; displayName: string }
  profile: {
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

type DriverTripGateContextValue = {
  shiftActive: boolean
  ready: boolean
}

const DriverTripGateContext = React.createContext<DriverTripGateContextValue>({
  shiftActive: false,
  ready: false,
})

export function useDriverTripGateShift(): DriverTripGateContextValue {
  return React.useContext(DriverTripGateContext)
}

type Props = {
  children: React.ReactNode
  title: string
  /** Soft clock-in CTA when today’s assignment exists but shift not started. Off on trip list (browse/add past trips freely). */
  showShiftPrompt?: boolean
}

export function DriverTripGate({ children, title, showShiftPrompt = true }: Props) {
  const t = useT()
  const router = useRouter()
  const [me, setMe] = React.useState<MeResponse | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [bypass, setBypass] = React.useState(false)
  const [ready, setReady] = React.useState(false)

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
      } else {
        const status = (err as { status?: number } | null)?.status
        if (status === 401 || status === 403) {
          router.replace('/driver/login')
          return
        }
        flash(t('taxi_fleet.driverApp.home.loadFailed', 'Could not load driver session.'), 'error')
      }
    } finally {
      setBypass(hasDriverTripsBypass())
      setReady(true)
    }
  }, [router, t])

  React.useEffect(() => {
    void load()
  }, [load])

  const assignment = me?.todayAssignment ?? null
  const shiftActive = isDriverOnOpenShift(assignment)
  const shiftVehicles = React.useMemo(
    () =>
      buildShiftVehicleOptions({
        defaults: me?.profile?.defaultResourceIds ?? [],
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
    [assignment, me?.profile?.defaultResourceIds],
  )
  const { selectedResourceId, setSelectedResourceId, needsVehiclePick } = useShiftVehicleSelection(
    shiftVehicles,
    assignment?.resourceId,
  )

  async function clockInPlanned() {
    if (!assignment || !selectedResourceId) {
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
          type: 'assignment.shift',
          payload: {
            assignmentId: assignment.id,
            action: 'start',
            resourceId: selectedResourceId,
          },
        })
        setMe((prev) =>
          prev && prev.todayAssignment
            ? {
                ...prev,
                todayAssignment: {
                  ...prev.todayAssignment,
                  resourceId: selectedResourceId,
                  shiftStart: new Date().toISOString(),
                  status: 'confirmed',
                },
              }
            : prev,
        )
        return
      }
      await apiCall(`/api/taxi_fleet/driver/assignments/${assignment.id}/shift`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'start',
          resourceId: selectedResourceId,
        }),
      })
      await load()
    } catch {
      flash(t('taxi_fleet.driverApp.home.shiftFailed', 'Could not update shift.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function clockInAdHoc() {
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
        setMe((prev) =>
          prev
            ? {
                ...prev,
                todayAssignment: {
                  id: `local-${selectedResourceId}`,
                  resourceId: selectedResourceId,
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

  if (!ready) {
    return (
      <DriverShell title={title} shiftActive={false} assignmentId={null}>
        <div className={`px-1 py-8 text-center ${driverMutedTextClass}`}>
          {t('taxi_fleet.driverApp.loading', 'Loading…')}
        </div>
      </DriverShell>
    )
  }

  const showPlannedPrompt = showShiftPrompt && !shiftActive && assignment && !assignment.shiftStart
  const showAdHocPrompt =
    showShiftPrompt &&
    !shiftActive &&
    needsVehiclePick &&
    (!assignment || Boolean(assignment.shiftEnd))

  return (
    <DriverTripGateContext.Provider value={{ shiftActive, ready }}>
      <DriverShell title={title} shiftActive={shiftActive} assignmentId={assignment?.id ?? null}>
        {showPlannedPrompt ? (
          <div className={`${driverCardClass} mb-3 space-y-3`}>
            <div className={driverSectionTitleClass}>
              {t('taxi_fleet.driverApp.trips.gateTitle', 'Start your shift for a live trip')}
            </div>
            <p className={driverSectionDescClass}>
              {t(
                'taxi_fleet.driverApp.trips.gateHintPastOnly',
                'You can add past trips anytime. Start your shift to run a live trip.',
              )}
            </p>
            {needsVehiclePick ? (
              <DriverShiftVehiclePicker
                vehicles={shiftVehicles}
                assignmentResourceId={assignment.resourceId}
                value={selectedResourceId}
                onChange={setSelectedResourceId}
                disabled={busy}
              />
            ) : null}
            <Button
              type="button"
              className={driverPrimaryActionClass}
              disabled={busy || !selectedResourceId}
              onClick={() => void clockInPlanned()}
            >
              {busy
                ? t('taxi_fleet.driverApp.home.starting', 'Starting…')
                : t('taxi_fleet.driverApp.home.clockIn', 'Start shift')}
            </Button>
            {!bypass ? (
              <Link href="/driver" className={`${driverSecondaryActionClass} inline-flex`}>
                {t('taxi_fleet.driverApp.trips.backHome', 'Back to home')}
              </Link>
            ) : null}
          </div>
        ) : null}
        {showAdHocPrompt ? (
          <div className={`${driverCardClass} mb-3 space-y-3`}>
            <div className={driverSectionTitleClass}>
              {t('taxi_fleet.driverApp.trips.gateAdHocTitle', 'Start an ad-hoc shift')}
            </div>
            <p className={driverSectionDescClass}>
              {t(
                'taxi_fleet.driverApp.trips.gateAdHocHint',
                'No planned assignment today. Pick a default vehicle to start working.',
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
              onClick={() => void clockInAdHoc()}
            >
              {busy
                ? t('taxi_fleet.driverApp.home.starting', 'Starting…')
                : t('taxi_fleet.driverApp.home.clockInAdHoc', 'Start ad-hoc shift')}
            </Button>
            {!bypass ? (
              <Link href="/driver" className={`${driverSecondaryActionClass} inline-flex`}>
                {t('taxi_fleet.driverApp.trips.backHome', 'Back to home')}
              </Link>
            ) : null}
          </div>
        ) : null}
        {children}
      </DriverShell>
    </DriverTripGateContext.Provider>
  )
}
