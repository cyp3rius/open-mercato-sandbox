'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import React from 'react'
import { CalendarDays, CarFront, Fuel, Home, LogOut, Download, Wallet } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { Button } from '@open-mercato/ui/primitives/button'
import { FlashMessages } from '@open-mercato/ui/backend/FlashMessages'
import { DriverBrandMark } from './DriverBrandMark'
import { useDriverDefaultLocale } from './useDriverDefaultLocale'
import { useDriverOnlineStatus } from './useDriverOnlineStatus'
import { useDriverGpsStatus } from './useDriverGpsStatus'
import { useDriverPwa } from './useDriverPwa'
import { useDriverPush } from './useDriverPush'
import { useDriverForcedLightTheme } from './useDriverForcedLightTheme'
import { clearDriverLocalData } from '../../lib/driverOffline/clearDriverLocalData'
import {
  flushDriverOutbox,
  getOutboxSyncCounts,
} from '../../lib/driverOffline/outbox'
import { loadDriverMeWithCache } from '../../lib/driverOffline/queueOrSendShiftMutation'
import { seedDriverOfflineSnapshots } from '../../lib/driverOffline/seedDriverOfflineSnapshots'
import { clearLiveTripDraft, getActiveLiveTripDraft } from '../../lib/driverOffline/tripDrafts'
import { installDriverPwaHead } from '../../lib/driverPwaHead'
import { useDriverTracking } from './useDriverTracking'
import { DriverPullToRefresh, DriverPullToRefreshProvider } from './DriverPullToRefresh'
import { DriverAppModeProvider } from './useDriverAppMode'
import type { DriverImpersonationInfo } from '../../lib/driverImpersonation'
import { TAXI_FLEET_BASE } from '../../backend/taxi-fleet/paths'
import {
  driverBadgeDangerClass,
  driverBadgeInfoClass,
  driverBadgeNeutralClass,
  driverBadgeSuccessClass,
  driverBadgeWarningClass,
  driverPageBgClass,
  driverPageTitleClass,
  driverStatusLampDangerClass,
  driverStatusLampSuccessClass,
  driverStatusLampWarningClass,
} from './driverUi'

type Props = {
  children: React.ReactNode
  /** Current place in the app (shown under the driver name). */
  title?: string
  shiftActive?: boolean
  assignmentId?: string | null
}

const NAV = [
  { href: '/driver', labelKey: 'taxi_fleet.driverApp.nav.home', fallback: 'Home', Icon: Home },
  { href: '/driver/trips', labelKey: 'taxi_fleet.driverApp.nav.trips', fallback: 'Trips', Icon: CarFront },
  { href: '/driver/expenses', labelKey: 'taxi_fleet.driverApp.nav.expenses', fallback: 'Costs', Icon: Fuel },
  {
    href: '/driver/settlements',
    labelKey: 'taxi_fleet.driverApp.nav.settlements',
    fallback: 'Pay',
    Icon: Wallet,
  },
  {
    href: '/driver/assignments',
    labelKey: 'taxi_fleet.driverApp.nav.assignments',
    fallback: 'Shifts',
    Icon: CalendarDays,
  },
] as const

function ensureDriverViewportMeta() {
  if (typeof document === 'undefined') return

  const viewportId = 'driver-viewport'
  let viewport = document.getElementById(viewportId) as HTMLMetaElement | null
  if (!viewport) {
    viewport = document.createElement('meta')
    viewport.id = viewportId
    viewport.name = 'viewport'
    document.head.appendChild(viewport)
  }
  viewport.content =
    'width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1'

  const pairs: Array<[string, string]> = [
    ['mobile-web-app-capable', 'yes'],
    ['apple-mobile-web-app-capable', 'yes'],
    // Light status bar + white theme for iOS standalone PWA.
    ['apple-mobile-web-app-status-bar-style', 'default'],
    ['apple-mobile-web-app-title', 'RS Moto Taxi - Kierowca'],
    ['format-detection', 'telephone=no'],
    ['theme-color', '#FFEB3D'],
  ]
  for (const [name, content] of pairs) {
    const id = `driver-meta-${name}`
    let meta = document.getElementById(id) as HTMLMetaElement | null
    if (!meta) {
      meta = document.createElement('meta')
      meta.id = id
      meta.name = name
      document.head.appendChild(meta)
    }
    meta.content = content
  }

  // Force light chrome behind iOS safe areas (status bar / home indicator).
  document.documentElement.style.backgroundColor = '#ffffff'
  document.body.style.backgroundColor = '#ffffff'

  installDriverPwaHead()
}

export function DriverShell({ children, title, shiftActive, assignmentId }: Props) {
  const t = useT()
  const pathname = usePathname()
  const router = useRouter()
  useDriverDefaultLocale()
  useDriverForcedLightTheme()
  const online = useDriverOnlineStatus()
  const {
    status: gpsStatus,
    showConsentBanner,
    requestAccess: requestGpsAccess,
  } = useDriverGpsStatus()
  const {
    status: pushStatus,
    showConsentBanner: showPushBanner,
    requestAccess: requestPushAccess,
  } = useDriverPush()
  const { canInstall, install, updateReady, applyUpdate } = useDriverPwa()
  const [gpsBusy, setGpsBusy] = React.useState(false)
  const [pushBusy, setPushBusy] = React.useState(false)
  const [pending, setPending] = React.useState(0)
  const [failedSync, setFailedSync] = React.useState(0)
  const [driverName, setDriverName] = React.useState<string | null>(null)
  const [liveTripId, setLiveTripId] = React.useState<string | null>(null)
  const [serverInProgressTripId, setServerInProgressTripId] = React.useState<string | null>(null)
  const [resolvedShiftActive, setResolvedShiftActive] = React.useState(Boolean(shiftActive))
  const [resolvedAssignmentId, setResolvedAssignmentId] = React.useState<string | null>(
    assignmentId ?? null,
  )
  const [activeVehicleLabel, setActiveVehicleLabel] = React.useState<string | null>(null)
  const [impersonation, setImpersonation] = React.useState<DriverImpersonationInfo | null>(null)
  const [impersonationBusy, setImpersonationBusy] = React.useState(false)

  React.useEffect(() => {
    if (typeof shiftActive === 'boolean') setResolvedShiftActive(shiftActive)
    if (assignmentId !== undefined) setResolvedAssignmentId(assignmentId ?? null)
  }, [shiftActive, assignmentId])

  const refreshDriverSession = React.useCallback(async () => {
    try {
      const { me: result } = await loadDriverMeWithCache<{
        member: { displayName: string }
        impersonation?: DriverImpersonationInfo | null
        todayAssignment: {
          id: string
          resourceLabel?: string | null
          shiftStart: string | null
          shiftEnd: string | null
        } | null
      }>()
      if (!result) return
      setDriverName(result.member?.displayName?.trim() || null)
      setImpersonation(result.impersonation?.active ? result.impersonation : null)
      const assignment = result.todayAssignment
      const open = Boolean(assignment?.shiftStart && !assignment?.shiftEnd)
      if (typeof shiftActive !== 'boolean') {
        setResolvedAssignmentId(assignment?.id ?? null)
        setResolvedShiftActive(open)
      }
      setActiveVehicleLabel(
        open && assignment?.resourceLabel?.trim() ? assignment.resourceLabel.trim() : null,
      )
    } catch {
      // keep prior header state
    }
  }, [shiftActive])

  const refreshLiveAndOutbox = React.useCallback(async () => {
    const counts = await getOutboxSyncCounts()
    let live = await getActiveLiveTripDraft()
    let serverInProgressId: string | null = null
    if (navigator.onLine) {
      try {
        const { result } = await apiCall<{ items?: Array<{ id: string; status?: string }> }>(
          '/api/taxi_fleet/driver/trips',
        )
        const items = result?.items ?? []
        if (live?.serverTripId) {
          const serverTripId = live.serverTripId
          const draftId = live.id
          const serverTrip = items.find((row) => row.id === serverTripId)
          if (!serverTrip || serverTrip.status !== 'in_progress') {
            await clearLiveTripDraft(draftId)
            live = null
          }
        }
        if (!live) {
          const inProgress = items.find((row) => row.status === 'in_progress')
          serverInProgressId = inProgress?.id ?? null
        }
      } catch {
        serverInProgressId = null
      }
    }
    setPending(counts.total)
    setFailedSync(counts.failed)
    setLiveTripId(live?.id ?? null)
    setServerInProgressTripId(serverInProgressId)
  }, [])

  const refreshShell = React.useCallback(async () => {
    await Promise.all([refreshDriverSession(), refreshLiveAndOutbox()])
    if (navigator.onLine) {
      await seedDriverOfflineSnapshots().catch(() => undefined)
      await flushDriverOutbox().catch(() => undefined)
      const counts = await getOutboxSyncCounts()
      setPending(counts.total)
      setFailedSync(counts.failed)
    }
    router.refresh()
  }, [refreshDriverSession, refreshLiveAndOutbox, router])

  React.useEffect(() => {
    void refreshDriverSession()
  }, [refreshDriverSession, pathname])

  React.useEffect(() => {
    if (!online) return
    let cancelled = false
    ;(async () => {
      await seedDriverOfflineSnapshots().catch(() => undefined)
      if (cancelled) return
      await flushDriverOutbox().catch(() => undefined)
      if (cancelled) return
      const counts = await getOutboxSyncCounts()
      if (cancelled) return
      setPending(counts.total)
      setFailedSync(counts.failed)
    })()
    return () => {
      cancelled = true
    }
  }, [online])

  useDriverTracking({
    enabled: resolvedShiftActive && !impersonation?.active,
    assignmentId: resolvedAssignmentId,
  })

  React.useEffect(() => {
    let active = true
    const tick = async () => {
      const counts = await getOutboxSyncCounts()
      let live = await getActiveLiveTripDraft()
      let serverInProgressId: string | null = null
      if (navigator.onLine) {
        try {
          const { result } = await apiCall<{ items?: Array<{ id: string; status?: string }> }>(
            '/api/taxi_fleet/driver/trips',
          )
          const items = result?.items ?? []
          if (live?.serverTripId) {
            const serverTripId = live.serverTripId
            const draftId = live.id
            const serverTrip = items.find((row) => row.id === serverTripId)
            if (!serverTrip || serverTrip.status !== 'in_progress') {
              await clearLiveTripDraft(draftId)
              live = null
            }
          }
          if (!live) {
            const inProgress = items.find((row) => row.status === 'in_progress')
            serverInProgressId = inProgress?.id ?? null
          }
        } catch {
          serverInProgressId = null
        }
      }
      if (!active) return
      setPending(counts.total)
      setFailedSync(counts.failed)
      setLiveTripId(live?.id ?? null)
      setServerInProgressTripId(serverInProgressId)
    }
    void tick()
    const id = window.setInterval(() => void tick(), 5000)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [online, pathname])

  React.useEffect(() => {
    ensureDriverViewportMeta()
  }, [])

  async function logout() {
    await clearDriverLocalData().catch(() => undefined)
    await apiCall('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    setLiveTripId(null)
    setServerInProgressTripId(null)
    setPending(0)
    setFailedSync(0)
    router.replace('/driver/login')
  }

  async function stopImpersonation() {
    if (impersonationBusy) return
    setImpersonationBusy(true)
    const profileId = impersonation?.profileId ?? null
    await apiCall('/api/taxi_fleet/driver/impersonation', { method: 'DELETE' }).catch(() => undefined)
    setImpersonation(null)
    setImpersonationBusy(false)
    window.location.assign(
      profileId
        ? `${TAXI_FLEET_BASE}/drivers/${encodeURIComponent(profileId)}`
        : `${TAXI_FLEET_BASE}/drivers`,
    )
  }

  const showLiveBanner = Boolean(liveTripId) && !pathname.startsWith('/driver/trips/live')
  const showScheduledInProgressBanner =
    !liveTripId &&
    Boolean(serverInProgressTripId) &&
    pathname !== `/driver/trips/${serverInProgressTripId}`

  const appMode = React.useMemo(
    () => ({
      readOnly: Boolean(impersonation?.active),
      impersonation,
    }),
    [impersonation],
  )

  return (
    <DriverAppModeProvider value={appMode}>
    <DriverPullToRefreshProvider>
    <div className={`flex min-h-dvh flex-col touch-manipulation overscroll-y-contain ${driverPageBgClass}`}>
      <FlashMessages />
      <header className="sticky top-0 z-20 border-b border-[#F1F1F4] bg-white/95 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#F1F1F4] bg-[#F9F9F9] px-1.5">
              <DriverBrandMark compact className="h-7 w-auto max-w-full object-contain" />
            </div>
            <div className="min-w-0">
              <div className={`${driverPageTitleClass} truncate`}>
                {driverName ?? t('taxi_fleet.driverApp.title', 'Driver')}
              </div>
              {title ? <div className="truncate text-xs text-[#78829D]">{title}</div> : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {canInstall && !impersonation?.active ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 border-[#DBDFE9] px-2.5 text-xs font-medium text-[#071437]"
                onClick={() => void install()}
              >
                <Download className="size-3.5" aria-hidden />
                {t('taxi_fleet.driverApp.install', 'Install')}
              </Button>
            ) : null}
            {!impersonation?.active ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5 px-2.5 text-xs font-medium text-[#78829D] hover:!bg-[#F1F1F4]/50 hover:!text-[#4B5675]"
                onClick={() => void logout()}
              >
                <LogOut className="size-3.5" aria-hidden />
                {t('taxi_fleet.driverApp.logout', 'Log out')}
              </Button>
            ) : null}
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-lg flex-wrap gap-1.5 px-4 pb-3">
          <span
            className={`${online ? driverBadgeSuccessClass : driverBadgeWarningClass} gap-1.5`}
          >
            <span
              className={online ? driverStatusLampSuccessClass : driverStatusLampDangerClass}
              aria-hidden
            />
            {online
              ? t('taxi_fleet.driverApp.online', 'Online')
              : t('taxi_fleet.driverApp.offline', 'Offline')}
          </span>
          <button
            type="button"
            disabled={gpsBusy || gpsStatus === 'ready'}
            onClick={() => {
              if (gpsStatus === 'ready' || gpsBusy) return
              setGpsBusy(true)
              void requestGpsAccess().finally(() => setGpsBusy(false))
            }}
            className={`${
              gpsStatus === 'ready' ? driverBadgeSuccessClass : driverBadgeWarningClass
            } gap-1.5 disabled:opacity-100`}
            title={
              gpsStatus === 'ready'
                ? t('taxi_fleet.driverApp.gpsReady', 'Location access granted')
                : t('taxi_fleet.driverApp.gpsTapToEnable', 'Tap to enable location')
            }
          >
            <span
              className={
                gpsStatus === 'ready'
                  ? driverStatusLampSuccessClass
                  : gpsStatus === 'denied' || gpsStatus === 'unavailable'
                    ? driverStatusLampDangerClass
                    : driverStatusLampWarningClass
              }
              aria-hidden
            />
            {gpsStatus === 'ready'
              ? t('taxi_fleet.driverApp.gps', 'GPS')
              : gpsBusy
                ? t('taxi_fleet.driverApp.gpsRequesting', 'GPS…')
                : t('taxi_fleet.driverApp.gpsEnable', 'Enable GPS')}
          </button>
          {pushStatus !== 'unsupported' && pushStatus !== 'unavailable' ? (
            <button
              type="button"
              disabled={pushBusy || pushStatus === 'ready'}
              onClick={() => {
                if (pushStatus === 'ready' || pushBusy) return
                setPushBusy(true)
                void requestPushAccess().finally(() => setPushBusy(false))
              }}
              className={`${
                pushStatus === 'ready' ? driverBadgeSuccessClass : driverBadgeWarningClass
              } gap-1.5 disabled:opacity-100`}
              title={
                pushStatus === 'ready'
                  ? t('taxi_fleet.driverApp.pushReady', 'Notifications enabled')
                  : t('taxi_fleet.driverApp.pushTapToEnable', 'Tap to enable notifications')
              }
            >
              <span
                className={
                  pushStatus === 'ready'
                    ? driverStatusLampSuccessClass
                    : pushStatus === 'denied'
                      ? driverStatusLampDangerClass
                      : driverStatusLampWarningClass
                }
                aria-hidden
              />
              {pushStatus === 'ready'
                ? t('taxi_fleet.driverApp.push', 'Alerts')
                : pushBusy
                  ? t('taxi_fleet.driverApp.pushRequesting', 'Alerts…')
                  : t('taxi_fleet.driverApp.pushEnable', 'Enable alerts')}
            </button>
          ) : null}
          {failedSync > 0 ? (
            <span className={driverBadgeDangerClass}>
              {t('taxi_fleet.driverApp.sync.failedCount', 'Sync failed')}: {failedSync}
            </span>
          ) : null}
          {pending > 0 ? (
            <span className={failedSync > 0 ? driverBadgeWarningClass : driverBadgeInfoClass}>
              {t('taxi_fleet.driverApp.pendingSync', 'Pending sync')}: {pending}
            </span>
          ) : null}
          <span className={resolvedShiftActive ? driverBadgeSuccessClass : driverBadgeNeutralClass}>
            {resolvedShiftActive
              ? t('taxi_fleet.driverApp.onShift', 'On shift')
              : t('taxi_fleet.driverApp.offShift', 'Off shift')}
          </span>
          {resolvedShiftActive && activeVehicleLabel ? (
            <span className={`${driverBadgeInfoClass} max-w-[12rem] truncate`} title={activeVehicleLabel}>
              {activeVehicleLabel}
            </span>
          ) : null}
        </div>
        {updateReady ? (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5">
            <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-3">
              <p className="text-xs font-medium text-amber-950">
                {t(
                  'taxi_fleet.driverApp.updateAvailable',
                  'A new driver app version is ready. Update now to continue.',
                )}
              </p>
              <Button
                type="button"
                size="sm"
                className="h-8 shrink-0 px-3 text-xs font-semibold"
                onClick={() => applyUpdate()}
              >
                {t('taxi_fleet.driverApp.updateNow', 'Update')}
              </Button>
            </div>
          </div>
        ) : null}
        {impersonation?.active ? (
          <div className="mx-auto w-full max-w-lg px-4 pb-3">
            <div className="flex flex-col gap-2 rounded-lg border border-[#FFE8A3] bg-[#FFF8DD] px-3 py-2.5 text-sm text-[#9A7700] sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="font-medium text-[#071437]">
                  {t('taxi_fleet.driverApp.impersonation.bannerTitle', 'Read-only preview')}
                </div>
                <div className="mt-0.5">
                  {t(
                    'taxi_fleet.driverApp.impersonation.bannerBody',
                    'Viewing the driver app as {name}. Changes are disabled.',
                    { name: impersonation.displayName },
                  )}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0 border-[#DBDFE9] bg-white text-[#071437]"
                disabled={impersonationBusy}
                onClick={() => void stopImpersonation()}
              >
                {impersonationBusy
                  ? t('taxi_fleet.driverApp.impersonation.stopping', 'Leaving…')
                  : t('taxi_fleet.driverApp.impersonation.exit', 'Exit preview')}
              </Button>
            </div>
          </div>
        ) : null}
        {showConsentBanner && !impersonation?.active ? (
          <div className="mx-auto w-full max-w-lg px-4 pb-3">
            <button
              type="button"
              disabled={gpsBusy}
              onClick={() => {
                setGpsBusy(true)
                void requestGpsAccess().finally(() => setGpsBusy(false))
              }}
              className="w-full rounded-lg border border-[#FFE8A3] bg-[#FFF8DD] px-3 py-2.5 text-left text-sm text-[#9A7700]"
            >
              <div className="font-medium text-[#071437]">
                {t('taxi_fleet.driverApp.gpsBannerTitle', 'Location access required')}
              </div>
              <div className="mt-0.5">
                {t(
                  'taxi_fleet.driverApp.gpsBannerDenied',
                  'Location was blocked. On iPhone: Settings → Safari (or this app) → Location → Allow, then tap here.',
                )}
              </div>
            </button>
          </div>
        ) : null}
        {showPushBanner && !impersonation?.active ? (
          <div className="mx-auto w-full max-w-lg px-4 pb-3">
            <button
              type="button"
              disabled={pushBusy}
              onClick={() => {
                setPushBusy(true)
                void requestPushAccess().finally(() => setPushBusy(false))
              }}
              className="w-full rounded-lg border border-[#FFE8A3] bg-[#FFF8DD] px-3 py-2.5 text-left text-sm text-[#9A7700]"
            >
              <div className="font-medium text-[#071437]">
                {t('taxi_fleet.driverApp.pushBannerTitle', 'Enable trip notifications')}
              </div>
              <div className="mt-0.5">
                {pushStatus === 'denied'
                  ? t(
                      'taxi_fleet.driverApp.pushBannerDenied',
                      'Notifications were blocked. On iPhone: install the app to Home Screen, then allow Notifications in Settings.',
                    )
                  : t(
                      'taxi_fleet.driverApp.pushBannerPrompt',
                      'Get alerts for new scheduled trips and 1 hour before pickup. Tap to allow.',
                    )}
              </div>
            </button>
          </div>
        ) : null}
        {showLiveBanner && liveTripId ? (
          <div className="mx-auto w-full max-w-lg px-4 pb-3">
            <Link
              href={`/driver/trips/live?id=${encodeURIComponent(liveTripId)}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-[#B2E1FF] bg-[#F1F8FF] px-3 py-2.5 text-sm font-medium text-[#056EE9]"
            >
              <span>{t('taxi_fleet.driverApp.trips.liveBanner', 'Live trip in progress')}</span>
              <span className="shrink-0 font-semibold">
                {t('taxi_fleet.driverApp.trips.liveBannerCta', 'Open')}
              </span>
            </Link>
          </div>
        ) : null}
        {showScheduledInProgressBanner && serverInProgressTripId ? (
          <div className="mx-auto w-full max-w-lg px-4 pb-3">
            <Link
              href={`/driver/trips/${encodeURIComponent(serverInProgressTripId)}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-[#B2E1FF] bg-[#F1F8FF] px-3 py-2.5 text-sm font-medium text-[#056EE9]"
            >
              <span>{t('taxi_fleet.driverApp.trips.liveBanner', 'Live trip in progress')}</span>
              <span className="shrink-0 font-semibold">
                {t('taxi_fleet.driverApp.trips.liveBannerCta', 'Open')}
              </span>
            </Link>
          </div>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-5 pb-[calc(5.75rem+env(safe-area-inset-bottom))]">
        <DriverPullToRefresh onShellRefresh={refreshShell}>{children}</DriverPullToRefresh>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[#F1F1F4] bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.map((item) => {
            const active =
              pathname === item.href || (item.href !== '/driver' && pathname.startsWith(item.href))
            const Icon = item.Icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 px-2 text-center transition-colors ${
                  active ? 'text-[#1B84FF]' : 'text-[#78829D]'
                }`}
              >
                <Icon className="size-5" aria-hidden strokeWidth={active ? 2.25 : 1.75} />
                <span className={`text-[11px] font-medium ${active ? 'font-semibold' : ''}`}>
                  {t(item.labelKey, item.fallback)}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
    </DriverPullToRefreshProvider>
    </DriverAppModeProvider>
  )
}
