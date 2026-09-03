'use client'

import React from 'react'

export type DriverGpsStatus = 'ready' | 'prompt' | 'denied' | 'unavailable'

type DriverGpsController = {
  status: DriverGpsStatus
  /** Triggers the OS location permission dialog (when still allowed). */
  requestAccess: () => Promise<DriverGpsStatus>
}

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 5_000,
  timeout: 20_000,
}

const SESSION_READY_KEY = 'taxi_fleet_driver_gps_ready'

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
 * Once granted (`ready`), status stays sticky — timeouts / remount / Permissions
 * API `prompt` quirks must not resurrect the denial banner.
 */
export function useDriverGpsStatus(): DriverGpsController {
  const [status, setStatus] = React.useState<DriverGpsStatus>(() => {
    if (typeof navigator === 'undefined') return 'unavailable'
    if (!navigator.geolocation) return 'unavailable'
    if (typeof window !== 'undefined' && !window.isSecureContext) return 'unavailable'
    if (typeof window !== 'undefined' && readSessionReady()) return 'ready'
    return 'prompt'
  })
  const readyRef = React.useRef(status === 'ready')

  const markReady = React.useCallback(() => {
    readyRef.current = true
    writeSessionReady()
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
          // Timeout / POSITION_UNAVAILABLE: keep prior ready if we already had a fix.
          if (readyRef.current) {
            setStatus('ready')
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
        readyRef.current = false
        setStatus('denied')
        return
      }
      // Permissions API `prompt` on iOS can flap after grant — never downgrade from ready.
      if (readyRef.current) {
        setStatus('ready')
        return
      }
      setStatus('prompt')
    }

    const syncFromPermissionApi = async () => {
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
      if (readyRef.current || readSessionReady()) {
        markReady()
        return
      }
      const permissionState = await syncFromPermissionApi()
      if (cancelled) return
      if (permissionState === 'granted') {
        markReady()
        return
      }
      if (permissionState === 'denied') {
        setStatus('denied')
        return
      }
      // Still need an explicit getCurrentPosition to trigger iOS prompt.
      await requestAccess()
    }

    void bootstrap()

    const onVisible = () => {
      if (readyRef.current) return
      void syncFromPermissionApi()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      if (permissionStatus) permissionStatus.onchange = null
    }
  }, [markReady, requestAccess])

  return { status, requestAccess }
}
