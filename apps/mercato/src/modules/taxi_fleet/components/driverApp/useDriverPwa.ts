'use client'

import React from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function useDriverPwa() {
  const [deferred, setDeferred] = React.useState<BeforeInstallPromptEvent | null>(null)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/driver-sw.js', { scope: '/driver' }).catch(() => undefined)
    }
    const onBip = (event: Event) => {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBip)
    return () => window.removeEventListener('beforeinstallprompt', onBip)
  }, [])

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
  }

  return { canInstall: Boolean(deferred), install }
}
