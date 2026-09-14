'use client'

import React from 'react'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

export type DriverPushStatus = 'ready' | 'prompt' | 'denied' | 'unavailable' | 'unsupported'

type DriverPushController = {
  status: DriverPushStatus
  showConsentBanner: boolean
  configured: boolean
  requestAccess: () => Promise<DriverPushStatus>
}

const DRIVER_PUSH_GRANTED_KEY = 'taxi_fleet_driver_push_granted'
const DRIVER_PUSH_DISMISSED_KEY = 'taxi_fleet_driver_push_dismissed'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

function readGranted(): boolean {
  try {
    return localStorage.getItem(DRIVER_PUSH_GRANTED_KEY) === '1'
  } catch {
    return false
  }
}

function writeGranted(): void {
  try {
    localStorage.setItem(DRIVER_PUSH_GRANTED_KEY, '1')
  } catch {
    // ignore
  }
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DRIVER_PUSH_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

function supportsPush(): boolean {
  if (typeof window === 'undefined') return false
  if (!window.isSecureContext) return false
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return false
  }
  return true
}

async function persistSubscription(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('Invalid push subscription')
  }
  const { ok, status } = await apiCall('/api/taxi_fleet/driver/push-subscription', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      endpoint: json.endpoint,
      expirationTime: json.expirationTime ?? null,
      keys: {
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
    }),
  })
  if (!ok) {
    throw new Error(`Failed to persist push subscription (${status})`)
  }
}

/**
 * Web Push permission + subscription for the driver PWA.
 * Banner shows until first successful subscribe (or permanent denial / unsupported).
 */
export function useDriverPush(): DriverPushController {
  const [status, setStatus] = React.useState<DriverPushStatus>(() => {
    if (typeof window === 'undefined') return 'unavailable'
    if (!supportsPush()) return 'unsupported'
    if (Notification.permission === 'granted' && readGranted()) return 'ready'
    if (Notification.permission === 'denied') return 'denied'
    return 'prompt'
  })
  const [configured, setConfigured] = React.useState(false)
  const [everGranted, setEverGranted] = React.useState(() =>
    typeof window !== 'undefined' ? readGranted() : false,
  )

  React.useEffect(() => {
    if (!supportsPush()) {
      setStatus('unsupported')
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const { result } = await apiCall<{
          configured: boolean
          subscribed: boolean
          vapidPublicKey: string | null
        }>('/api/taxi_fleet/driver/push-subscription')
        if (cancelled) return
        setConfigured(Boolean(result?.configured))
        if (!result?.configured) {
          setStatus('unavailable')
          return
        }
        if (Notification.permission === 'granted' && result.subscribed) {
          writeGranted()
          setEverGranted(true)
          setStatus('ready')
          return
        }
        if (Notification.permission === 'denied') {
          setStatus('denied')
          return
        }
        if (Notification.permission === 'granted' && result.vapidPublicKey) {
          // Permission already granted — refresh subscription silently.
          try {
            const registration = await navigator.serviceWorker.ready
            let subscription = await registration.pushManager.getSubscription()
            if (!subscription) {
              subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(
                  result.vapidPublicKey,
                ) as BufferSource,
              })
            }
            await persistSubscription(subscription)
            writeGranted()
            setEverGranted(true)
            setStatus('ready')
            return
          } catch {
            setStatus('prompt')
            return
          }
        }
        setStatus('prompt')
      } catch {
        if (!cancelled) setStatus(Notification.permission === 'denied' ? 'denied' : 'prompt')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const requestAccess = React.useCallback(async (): Promise<DriverPushStatus> => {
    if (!supportsPush()) {
      setStatus('unsupported')
      return 'unsupported'
    }
    try {
      const { result } = await apiCall<{
        configured: boolean
        vapidPublicKey: string | null
      }>('/api/taxi_fleet/driver/push-subscription')
      if (!result?.configured || !result.vapidPublicKey) {
        setConfigured(false)
        setStatus('unavailable')
        return 'unavailable'
      }
      setConfigured(true)

      const permission =
        Notification.permission === 'granted'
          ? 'granted'
          : await Notification.requestPermission()
      if (permission === 'denied') {
        setStatus('denied')
        return 'denied'
      }
      if (permission !== 'granted') {
        setStatus('prompt')
        return 'prompt'
      }

      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(result.vapidPublicKey) as BufferSource,
        })
      }
      await persistSubscription(subscription)
      writeGranted()
      setEverGranted(true)
      setStatus('ready')
      return 'ready'
    } catch {
      setStatus(Notification.permission === 'denied' ? 'denied' : 'prompt')
      return Notification.permission === 'denied' ? 'denied' : 'prompt'
    }
  }, [])

  const showConsentBanner =
    configured &&
    (status === 'prompt' || status === 'denied') &&
    !everGranted &&
    !readDismissed()

  return { status, showConsentBanner, configured, requestAccess }
}
