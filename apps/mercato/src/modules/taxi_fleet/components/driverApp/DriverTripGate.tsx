'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Button } from '@open-mercato/ui/primitives/button'
import { DriverShell } from './DriverShell'
import {
  DriverShiftVehiclePicker,
  buildShiftVehicleOptions,
  useShiftVehicleSelection,
  type DriverDefaultVehicleOption,
} from './DriverShiftVehiclePicker'
import { DriverSyncStatusBadge } from './DriverSyncStatusBadge'
import { hasDriverTripsBypass } from './driverTripAccess'
import {
  driverCardClass,
  driverMutedTextClass,
  driverPrimaryActionClass,
  driverSecondaryActionClass,
  driverSectionDescClass,
  driverSectionTitleClass,
} from './driverUi'
import { useDriverOnlineStatus } from './useDriverOnlineStatus'
import { useDriverOutboxItems } from './useDriverOutboxItems'
import { isDriverOnOpenShift } from '../../lib/driverTripShiftWindow'
import {
  loadDriverMeWithCache,
  queueOrSendShiftMutation,
} from '../../lib/driverOffline/queueOrSendShiftMutation'
import { resolveShiftOutboxSyncState } from '../../lib/driverOffline/outboxSyncState'

type MeResponse = {
  member: { id: string; displayName: string }
  impersonation?: { active: true; readOnly?: true } | null
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
  const online = useDriverOnlineStatus()
  const { items: outboxItems } = useDriverOutboxItems()
  const [me, setMe] = React.useState<MeResponse | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [bypass, setBypass] = React.useState(false)
  const [ready, setReady] = React.useState(false)
  const [fromCache, setFromCache] = React.useState(false)

  const load = React.useCallback(async () => {
    const { me: next, fromCache: cached } = await loadDriverMeWithCache<MeResponse>()
    if (next) {
      setMe(next)
      setFromCache(cached)
      if (cached) {
        flash(t('taxi_fleet.driverApp.usingCache', 'Showing cached data (offline).'), 'warning')
      }
    } else if (!navigator.onLine) {
      flash(
        t(
          'taxi_fleet.driverApp.home.profileCacheMissing',
          'No saved driver profile on this device. Connect once to download vehicles and shift data.',
        ),
        'error',
      )
    } else {
      flash(t('taxi_fleet.driverApp.home.loadFailed', 'Could not load driver session.'), 'error')
      router.replace('/driver/login')
      return
    }
    setBypass(hasDriverTripsBypass())
    setReady(true)
  }, [router, t])

  React.useEffect(() => {
    void load()
  }, [load])

  const assignment = me?.todayAssignment ?? null
  const readOnly = Boolean(me?.impersonation?.active)
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
        ignoreAvailability: !online || fromCache,
      }),
    [assignment, fromCache, me?.profile?.defaultResourceIds, online],
  )
  const { selectedResourceId, setSelectedResourceId, needsVehiclePick } = useShiftVehicleSelection(
    shiftVehicles,
    assignment?.resourceId,
  )
  const shiftSyncState = resolveShiftOutboxSyncState(outboxItems)

  async function clockInPlanned() {
    if (readOnly) return
    if (!me || !assignment || !selectedResourceId) {
      flash(
        t('taxi_fleet.driverApp.shift.vehicleRequired', 'Select a vehicle before starting your shift.'),
        'error',
      )
      return
    }
    setBusy(true)
    try {
      const optimisticMe: MeResponse = {
        ...me,
        todayAssignment: {
          ...assignment,
          resourceId: selectedResourceId,
          shiftStart: new Date().toISOString(),
          shiftEnd: null,
          status: 'confirmed',
        },
      }
      const { queued } = await queueOrSendShiftMutation({
        kind: 'planned',
        assignmentId: assignment.id,
        action: 'start',
        resourceId: selectedResourceId,
        optimisticMe,
      })
      setMe(optimisticMe)
      if (queued) {
        flash(
          t(
            'taxi_fleet.driverApp.shift.queuedOffline',
            'Shift started offline. It will sync when you are online.',
          ),
          'success',
        )
      } else {
        await load()
      }
    } catch {
      flash(t('taxi_fleet.driverApp.home.shiftFailed', 'Could not update shift.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function clockInAdHoc() {
    if (readOnly) return
    if (!me || !selectedResourceId) {
      flash(
        t('taxi_fleet.driverApp.shift.vehicleRequired', 'Select a vehicle before starting your shift.'),
        'error',
      )
      return
    }
    setBusy(true)
    try {
      const picked = shiftVehicles.find((v) => v.id === selectedResourceId)
      const optimisticMe: MeResponse = {
        ...me,
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
      const { queued } = await queueOrSendShiftMutation({
        kind: 'ad_hoc',
        resourceId: selectedResourceId,
        optimisticMe,
      })
      setMe(optimisticMe)
      if (queued) {
        flash(
          t(
            'taxi_fleet.driverApp.shift.queuedOffline',
            'Shift started offline. It will sync when you are online.',
          ),
          'success',
        )
      } else {
        await load()
      }
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

  const showPlannedPrompt =
    !readOnly && showShiftPrompt && !shiftActive && assignment && !assignment.shiftStart
  const showAdHocPrompt =
    !readOnly &&
    showShiftPrompt &&
    !shiftActive &&
    needsVehiclePick &&
    (!assignment || Boolean(assignment.shiftEnd))

  return (
    <DriverTripGateContext.Provider value={{ shiftActive, ready }}>
      <DriverShell title={title} shiftActive={shiftActive} assignmentId={assignment?.id ?? null}>
        {shiftSyncState ? (
          <div className="mb-3">
            <DriverSyncStatusBadge state={shiftSyncState} />
          </div>
        ) : null}
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
