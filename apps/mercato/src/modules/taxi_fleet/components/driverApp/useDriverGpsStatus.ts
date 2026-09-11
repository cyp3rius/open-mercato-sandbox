'use client'

import React from 'react'

export type DriverGpsStatus = 'ready' | 'prompt' | 'denied' | 'unavailable'

type DriverGpsController = {
  status: DriverGpsStatus
  /**
   * True only for a first-time hard denial (before GPS was ever granted in this browser).
   * Returning drivers who already allowed location never see the blocking banner again.
   */
  showConsentBanner: boolean
  /** Triggers the OS location permission dialog (when still allowed) / refreshes a fix. */
  requestAccess: () => Promise<DriverGpsStatus>
}

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 5_000,
  timeout: 20_000,
}

/** In-tab sticky; cleared on logout is fine — local grant survives. */
const SESSION_READY_KEY = 'taxi_fleet_driver_gps_ready'
/** Survives logout/login — GPS was successfully granted at least once on this device. */
export const DRIVER_GPS_GRANTED_KEY = 'taxi_fleet_driver_gps_granted'

export function readDriverGpsGranted(): boolean {
  try {
    return localStorage.getItem(DRIVER_GPS_GRANTED_KEY) === '1'
  } catch {
    return false
  }
}

export function writeDriverGpsGranted(): void {
  try {
    localStorage.setItem(DRIVER_GPS_GRANTED_KEY, '1')
  } catch {
    // ignore
  }
}

function readSessionReady(): boolean {
  try {
    return sessionStorage.getItem(SESSION_READY_KEY) === '1'
  } catch {
    return false
  }
}

function writeSessionReady(): void {
  try {
    sessionStorage.setItem(SESSION_READY_KEY, '1')
  } catch {
    // ignore
  }
}

/**
 * Geolocation readiness for the driver shell indicator.
 * - Consent banner at most once (until first successful grant).
 * - On every login/mount, re-activate GPS via getCurrentPosition when possible.
 * - Once granted, status stays sticky against Permissions API `prompt` flaps.
 */
export function useDriverGpsStatus(): DriverGpsController {
  const [status, setStatus] = React.useState<DriverGpsStatus>(() => {
    if (typeof navigator === 'undefined') return 'unavailable'
    if (!navigator.geolocation) return 'unavailable'
    if (typeof window !== 'undefined' && !window.isSecureContext) return 'unavailable'
    if (typeof window !== 'undefined' && (readSessionReady() || readDriverGpsGranted())) {
      return 'ready'
    }
    return 'prompt'
  })
  const [everGranted, setEverGranted] = React.useState(() =>
    typeof window !== 'undefined' ? readDriverGpsGranted() : false,
  )
  const readyRef = React.useRef(status === 'ready')

  const markReady = React.useCallback(() => {
    readyRef.current = true
    writeSessionReady()
    writeDriverGpsGranted()
    setEverGranted(true)
    setStatus('ready')
  }, [])

  const requestAccess = React.useCallback(async (): Promise<DriverGpsStatus> => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unavailable')
      return 'unavailable'
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setStatus('unavailable')
      return 'unavailable'
    }

    return await new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => {
          markReady()
          resolve('ready')
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            readyRef.current = false
            setStatus('denied')
            resolve('denied')
            return
          }
          // Timeout / POSITION_UNAVAILABLE: keep prior ready if we already had a fix
          // (or a prior grant on this device — common after login remount).
          if (readyRef.current || readDriverGpsGranted()) {
            markReady()
            resolve('ready')
            return
          }
          setStatus('unavailable')
          resolve('unavailable')
        },
        GEO_OPTIONS,
      )
    })
  }, [markReady])

  React.useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unavailable')
      return
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setStatus('unavailable')
      return
    }

    let cancelled = false
    let permissionStatus: PermissionStatus | null = null

    const applyPermissionState = (state: PermissionState) => {
      if (cancelled) return
      if (state === 'granted') {
        markReady()
        return
      }
      if (state === 'denied') {
        // Do not trust Permissions API alone — iOS/PWA can flap. Live probe below.
        if (readyRef.current || readDriverGpsGranted()) {
          setStatus('ready')
          return
        }
        setStatus('denied')
        return
      }
      // Permissions API `prompt` on iOS can flap after grant — never downgrade from ready.
      if (readyRef.current || readDriverGpsGranted()) {
        setStatus('ready')
        return
      }
      setStatus('prompt')
    }

    const syncFromPermissionApi = async (): Promise<PermissionState | null> => {
      try {
        if (!navigator.permissions?.query) return null
        permissionStatus = await navigator.permissions.query({
          name: 'geolocation' as PermissionName,
        })
        applyPermissionState(permissionStatus.state)
        permissionStatus.onchange = () => {
          if (cancelled || !permissionStatus) return
          applyPermissionState(permissionStatus.state)
        }
        return permissionStatus.state
      } catch {
        return null
      }
    }

    const bootstrap = async () => {
      // Restore sticky ready from prior grant (survives logout).
      if (readDriverGpsGranted() || readSessionReady()) {
        markReady()
      }

      const permissionState = await syncFromPermissionApi()
      if (cancelled) return

      if (permissionState === 'granted') {
        markReady()
      }

      // Always re-activate GPS on login/mount (silent if already allowed).
      // Never skip the live probe on Permissions `denied` — verify with getCurrentPosition.
      await requestAccess()
    }

    void bootstrap()

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      // Already active — do not re-prompt on every tab focus.
      if (readyRef.current) return
      void syncFromPermissionApi().then(() => {
        if (!cancelled) void requestAccess()
      })
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      if (permissionStatus) permissionStatus.onchange = null
    }
  }, [markReady, requestAccess])

  const showConsentBanner = status === 'denied' && !everGranted

  return { status, showConsentBanner, requestAccess }
}
