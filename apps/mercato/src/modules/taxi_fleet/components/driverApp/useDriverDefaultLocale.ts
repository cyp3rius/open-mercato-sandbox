'use client'

import React from 'react'
import { useLocale } from '@open-mercato/shared/lib/i18n/context'

const RELOAD_FLAG = 'taxi_fleet.driver.localeReloadPl'

/**
 * Driver portal defaults to Polish. Sets the locale cookie once and reloads
 * so server-rendered dictionaries switch to `pl`.
 */
export function useDriverDefaultLocale() {
  const locale = useLocale()

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if (locale === 'pl') {
      try {
        sessionStorage.removeItem(RELOAD_FLAG)
      } catch {
        // ignore
      }
      return
    }
    try {
      if (sessionStorage.getItem(RELOAD_FLAG) === '1') return
      sessionStorage.setItem(RELOAD_FLAG, '1')
    } catch {
      // continue without flag
    }
    void fetch('/api/auth/locale', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ locale: 'pl' }),
    })
      .then((res) => {
        if (res.ok) window.location.reload()
      })
      .catch(() => undefined)
  }, [locale])
}
