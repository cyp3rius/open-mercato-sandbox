'use client'

import React from 'react'
import { DRIVER_APP_VERSION } from '../../lib/driverAppVersion'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const RELOAD_FLAG = 'taxi_fleet.driver.swReloaded'

function registerDriverServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(null)
  }
  return navigator.serviceWorker
    .register(`/driver-sw.js?v=${DRIVER_APP_VERSION}`, {
      scope: '/driver',
      updateViaCache: 'none',
    })
    .catch(() => null)
}

function activateWaitingWorker(registration: ServiceWorkerRegistration): void {
  const waiting = registration.waiting
  if (!waiting) return
  waiting.postMessage({ type: 'SKIP_WAITING' })
}

/**
 * Install prompt + forced update for home-screen / standalone driver PWA.
 * When a new service worker is published (version bump), activate it and reload once.
 */
export function useDriverPwa() {
  const [deferred, setDeferred] = React.useState<BeforeInstallPromptEvent | null>(null)
  const [updateReady, setUpdateReady] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    let cancelled = false
    let registration: ServiceWorkerRegistration | null = null

    const onControllerChange = () => {
      try {
        if (sessionStorage.getItem(RELOAD_FLAG) === DRIVER_APP_VERSION) return
        sessionStorage.setItem(RELOAD_FLAG, DRIVER_APP_VERSION)
      } catch {
        // private mode
      }
      window.location.reload()
    }

    const onBip = (event: Event) => {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
    }

    const watchRegistration = (reg: ServiceWorkerRegistration) => {
      registration = reg
      if (reg.waiting) {
        setUpdateReady(true)
        activateWaitingWorker(reg)
      }
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing
        if (!installing) return
        installing.addEventListener('statechange', () => {
          if (installing.state !== 'installed') return
          if (navigator.serviceWorker.controller) {
            setUpdateReady(true)
            activateWaitingWorker(reg)
          }
        })
      })
    }

    void registerDriverServiceWorker().then((reg) => {
      if (cancelled || !reg) return
      watchRegistration(reg)
      void reg.update().catch(() => undefined)
    })

    navigator.serviceWorker?.addEventListener('controllerchange', onControllerChange)
    window.addEventListener('beforeinstallprompt', onBip)

    const onVisibleOrOnline = () => {
      if (document.visibilityState === 'hidden') return
      void registration?.update().catch(() => undefined)
    }
    document.addEventListener('visibilitychange', onVisibleOrOnline)
    window.addEventListener('online', onVisibleOrOnline)
    const interval = window.setInterval(() => {
      void registration?.update().catch(() => undefined)
    }, 60_000)

    return () => {
      cancelled = true
      navigator.serviceWorker?.removeEventListener('controllerchange', onControllerChange)
      window.removeEventListener('beforeinstallprompt', onBip)
      document.removeEventListener('visibilitychange', onVisibleOrOnline)
      window.removeEventListener('online', onVisibleOrOnline)
      window.clearInterval(interval)
    }
  }, [])

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
  }

  function applyUpdate() {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    void navigator.serviceWorker.getRegistration('/driver').then((reg) => {
      if (!reg?.waiting) {
        window.location.reload()
        return
      }
      activateWaitingWorker(reg)
    })
  }

  return {
    canInstall: Boolean(deferred),
    install,
    updateReady,
    applyUpdate,
    appVersion: DRIVER_APP_VERSION,
  }
}
