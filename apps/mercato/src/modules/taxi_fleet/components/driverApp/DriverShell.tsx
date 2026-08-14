'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import React from 'react'
import { CalendarDays, CarFront, Home, LogOut, Download } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { Button } from '@open-mercato/ui/primitives/button'
import { FlashMessages } from '@open-mercato/ui/backend/FlashMessages'
import { DriverBrandMark } from './DriverBrandMark'
import { useDriverDefaultLocale } from './useDriverDefaultLocale'
import { useDriverOnlineStatus } from './useDriverOnlineStatus'
import { useDriverGpsStatus } from './useDriverGpsStatus'
import { useDriverPwa } from './useDriverPwa'
import { flushDriverOutbox, getPendingOutboxCount } from '../../lib/driverOffline/outbox'
import { getActiveLiveTripDraft } from '../../lib/driverOffline/tripDrafts'
import { useDriverTracking } from './useDriverTracking'
import {
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
    ['apple-mobile-web-app-status-bar-style', 'default'],
    ['apple-mobile-web-app-title', 'Driver'],
    ['format-detection', 'telephone=no'],
    ['theme-color', '#ffffff'],
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

  const manifestId = 'driver-web-manifest'
  if (!document.getElementById(manifestId)) {
    const link = document.createElement('link')
    link.id = manifestId
    link.rel = 'manifest'
    link.href = '/driver/manifest.webmanifest'
    document.head.appendChild(link)
  }
}

export function DriverShell({ children, title, shiftActive, assignmentId }: Props) {
  const t = useT()
  const pathname = usePathname()
  const router = useRouter()
  useDriverDefaultLocale()
  const online = useDriverOnlineStatus()
  const gpsStatus = useDriverGpsStatus()
  const { canInstall, install } = useDriverPwa()
  const [pending, setPending] = React.useState(0)
  const [driverName, setDriverName] = React.useState<string | null>(null)
  const [liveTripId, setLiveTripId] = React.useState<string | null>(null)
  const [serverInProgressTripId, setServerInProgressTripId] = React.useState<string | null>(null)
  const [resolvedShiftActive, setResolvedShiftActive] = React.useState(Boolean(shiftActive))
  const [resolvedAssignmentId, setResolvedAssignmentId] = React.useState<string | null>(
    assignmentId ?? null,
  )
  const [activeVehicleLabel, setActiveVehicleLabel] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (typeof shiftActive === 'boolean') setResolvedShiftActive(shiftActive)
    if (assignmentId !== undefined) setResolvedAssignmentId(assignmentId ?? null)
  }, [shiftActive, assignmentId])

  React.useEffect(() => {
    let active = true
    void apiCall<{
      member: { displayName: string }
      todayAssignment: {
        id: string
        resourceLabel?: string | null
        shiftStart: string | null
        shiftEnd: string | null
      } | null
    }>('/api/taxi_fleet/driver/me')
      .then(({ result }) => {
        if (!active) return
        setDriverName(result.member?.displayName?.trim() || null)
        const assignment = result.todayAssignment
        const open = Boolean(assignment?.shiftStart && !assignment?.shiftEnd)
        if (typeof shiftActive !== 'boolean') {
          setResolvedAssignmentId(assignment?.id ?? null)
          setResolvedShiftActive(open)
        }
        setActiveVehicleLabel(
          open && assignment?.resourceLabel?.trim() ? assignment.resourceLabel.trim() : null,
        )
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [shiftActive, pathname])

  useDriverTracking({ enabled: resolvedShiftActive, assignmentId: resolvedAssignmentId })

  React.useEffect(() => {
    let active = true
    const refresh = async () => {
      const count = await getPendingOutboxCount()
      const live = await getActiveLiveTripDraft()
      let serverInProgressId: string | null = null
      if (!live && navigator.onLine) {
        try {
          const { result } = await apiCall<{ items?: Array<{ id: string; status?: string }> }>(
            '/api/taxi_fleet/driver/trips',
          )
          const inProgress = (result.items ?? []).find((row) => row.status === 'in_progress')
          serverInProgressId = inProgress?.id ?? null
        } catch {
          serverInProgressId = null
        }
      }
      if (active) {
        setPending(count)
        setLiveTripId(live?.id ?? null)
        setServerInProgressTripId(serverInProgressId)
      }
    }
    void refresh()
    const id = window.setInterval(() => void refresh(), 5000)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [online, pathname])

  React.useEffect(() => {
    if (!online) return
    void flushDriverOutbox().then(async () => {
      setPending(await getPendingOutboxCount())
    })
  }, [online])

  React.useEffect(() => {
    ensureDriverViewportMeta()
  }, [])

  async function logout() {
    await apiCall('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    router.replace('/driver/login')
  }

  const showLiveBanner = Boolean(liveTripId) && !pathname.startsWith('/driver/trips/live')
  const showScheduledInProgressBanner =
    !liveTripId &&
    Boolean(serverInProgressTripId) &&
    pathname !== `/driver/trips/${serverInProgressTripId}`

  return (
    <div className={`flex min-h-dvh flex-col touch-manipulation ${driverPageBgClass}`}>
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
            {canInstall ? (
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
          <span
            className={`${
              gpsStatus === 'ready' ? driverBadgeSuccessClass : driverBadgeWarningClass
            } gap-1.5`}
          >
            <span
              className={
                gpsStatus === 'ready'
                  ? driverStatusLampSuccessClass
                  : gpsStatus === 'denied'
                    ? driverStatusLampWarningClass
                    : driverStatusLampDangerClass
              }
              aria-hidden
            />
            {t('taxi_fleet.driverApp.gps', 'GPS')}
          </span>
          {pending > 0 ? (
            <span className={driverBadgeInfoClass}>
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
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[#F1F1F4] bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-lg grid-cols-3">
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
  )
}
