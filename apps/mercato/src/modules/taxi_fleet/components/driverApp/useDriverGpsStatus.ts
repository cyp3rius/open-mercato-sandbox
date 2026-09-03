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

function readPermissionState(state: PermissionState): DriverGpsStatus {
  if (state === 'granted') return 'ready'
  if (state === 'denied') return 'denied'
  return 'prompt'
}

/**
 * Geolocation readiness for the driver shell indicator.
 * Actively calls getCurrentPosition so iOS/Safari shows the system permission prompt
 * (Permissions API alone never triggers it).
 */
export function useDriverGpsStatus(): DriverGpsController {
  const [status, setStatus] = React.useState<DriverGpsStatus>(() => {
    if (typeof navigator === 'undefined') return 'unavailable'
    if (!navigator.geolocation) return 'unavailable'
    if (typeof window !== 'undefined' && !window.isSecureContext) return 'unavailable'
    return 'prompt'
  })

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
          setStatus('ready')
          resolve('ready')
        },
        (error) => {
          const next: DriverGpsStatus =
            error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable'
          setStatus(next)
          resolve(next)
        },
        GEO_OPTIONS,
      )
    })
  }, [])

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

    const syncFromPermissionApi = async () => {
      try {
        if (!navigator.permissions?.query) return null
        permissionStatus = await navigator.permissions.query({
          name: 'geolocation' as PermissionName,
        })
        if (cancelled) return permissionStatus.state
        setStatus(readPermissionState(permissionStatus.state))
        permissionStatus.onchange = () => {
          if (cancelled || !permissionStatus) return
          setStatus(readPermissionState(permissionStatus.state))
        }
        return permissionStatus.state
      } catch {
        return null
      }
    }

    const bootstrap = async () => {
      const permissionState = await syncFromPermissionApi()
      if (cancelled) return
      // Always call geolocation when not already granted — this is what shows the iOS prompt.
      if (permissionState !== 'granted' && permissionState !== 'denied') {
        await requestAccess()
      } else if (permissionState === 'granted') {
        setStatus('ready')
      } else if (permissionState === 'denied') {
        setStatus('denied')
      } else {
        // Permissions API missing (common on older iOS): still request to trigger the dialog.
        await requestAccess()
      }
    }

    void bootstrap()

    const onVisible = () => {
      void syncFromPermissionApi()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      if (permissionStatus) permissionStatus.onchange = null
    }
  }, [requestAccess])

  return { status, requestAccess }
}
