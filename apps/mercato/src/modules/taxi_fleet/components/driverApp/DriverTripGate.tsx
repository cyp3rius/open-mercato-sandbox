'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Button } from '@open-mercato/ui/primitives/button'
import { DriverShell } from './DriverShell'
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
  todayAssignment: {
    id: string
    resourceId: string
    status: string
    shiftStart: string | null
    shiftEnd: string | null
  } | null
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

  async function clockIn() {
    if (!assignment) return
    setBusy(true)
    try {
      if (!navigator.onLine) {
        await enqueueDriverMutation({
          type: 'assignment.shift',
          payload: { assignmentId: assignment.id, action: 'start' },
        })
        setMe((prev) =>
          prev && prev.todayAssignment
            ? {
                ...prev,
                todayAssignment: {
                  ...prev.todayAssignment,
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
        body: JSON.stringify({ action: 'start' }),
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

  return (
    <DriverShell title={title} shiftActive={shiftActive} assignmentId={assignment?.id ?? null}>
      {showShiftPrompt && !shiftActive && assignment && !assignment.shiftStart ? (
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
          <Button
            type="button"
            className={driverPrimaryActionClass}
            disabled={busy}
            onClick={() => void clockIn()}
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
      {children}
    </DriverShell>
  )
}
