'use client'

import React from 'react'

export type DriverGpsStatus = 'ready' | 'denied' | 'unavailable'

/**
 * Geolocation readiness for the driver shell indicator.
 * - ready: permission granted (or Permissions API unavailable but geolocation exists)
 * - denied: permission denied / prompt not accepted
 * - unavailable: no geolocation API
 */
export function useDriverGpsStatus(): DriverGpsStatus {
  const [status, setStatus] = React.useState<DriverGpsStatus>(() => {
    if (typeof navigator === 'undefined') return 'unavailable'
    if (!navigator.geolocation) return 'unavailable'
    return 'denied'
  })

  React.useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unavailable')
      return
    }

    let cancelled = false
    let permissionStatus: PermissionStatus | null = null

    const applyState = (state: PermissionState | 'unsupported') => {
      if (cancelled) return
      if (state === 'granted') setStatus('ready')
      else if (state === 'denied' || state === 'prompt') setStatus('denied')
      else setStatus('denied')
    }

    const readPermission = async () => {
      try {
        if (!navigator.permissions?.query) {
          // Without Permissions API we cannot know deny vs grant without prompting.
          // Treat as denied (orange) until a successful position read proves otherwise.
          setStatus('denied')
          return
        }
        permissionStatus = await navigator.permissions.query({
          name: 'geolocation' as PermissionName,
        })
        if (cancelled) return
        applyState(permissionStatus.state)
        permissionStatus.onchange = () => {
          applyState(permissionStatus?.state ?? 'prompt')
        }
      } catch {
        if (!cancelled) setStatus('denied')
      }
    }

    void readPermission()

    const onVisible = () => {
      void readPermission()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      if (permissionStatus) permissionStatus.onchange = null
    }
  }, [])

  return status
}
