'use client'

import React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { flash, FlashMessages } from '@open-mercato/ui/backend/FlashMessages'
import { Button } from '@open-mercato/ui/primitives/button'
import { DriverBrandMark } from '../../../components/driverApp/DriverBrandMark'
import { useDriverDefaultLocale } from '../../../components/driverApp/useDriverDefaultLocale'
import { useDriverForcedLightTheme } from '../../../components/driverApp/useDriverForcedLightTheme'
import {
  driverCardClass,
  driverFieldClass,
  driverLabelClass,
  driverMutedTextClass,
  driverPageBgClass,
  driverPrimaryActionClass,
} from '../../../components/driverApp/driverUi'

type LoginSuccess = {
  ok?: boolean
  mfa_required?: boolean
  redirect?: string
  error?: string
}

/** Keep driver PWA inside /driver — never land on /backend or the main /login. */
function resolveDriverPostLoginPath(raw: string | null | undefined): string {
  const value = String(raw ?? '').trim()
  if (!value.startsWith('/') || value.startsWith('//')) return '/driver'
  if (value === '/login' || value.startsWith('/login/') || value.startsWith('/login?')) return '/driver'
  if (value === '/backend' || value.startsWith('/backend/') || value.startsWith('/backend?')) {
    return '/driver'
  }
  if (value === '/driver' || value.startsWith('/driver/') || value.startsWith('/driver?')) {
    return value
  }
  return '/driver'
}

export default function DriverLoginPage() {
  const t = useT()
  useDriverDefaultLocale()
  useDriverForcedLightTheme()
  const [clientReady, setClientReady] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')

  React.useEffect(() => {
    setClientReady(true)
  }, [])

  React.useEffect(() => {
    if (typeof document === 'undefined') return
    const viewport = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null
    if (viewport) {
      viewport.content = 'width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1'
    }
    const theme = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
    if (theme) theme.content = '#F1F1F4'
    const id = 'driver-web-manifest'
    if (!document.getElementById(id)) {
      const link = document.createElement('link')
      link.id = id
      link.rel = 'manifest'
      link.href = '/driver/manifest.webmanifest'
      document.head.appendChild(link)
    }
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/driver-sw.js', { scope: '/driver' }).catch(() => undefined)
    }
  }, [])

  // Scrub credentials leaked by a prior GET submit (default form method).
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (!params.has('email') && !params.has('password')) return
    const leakedEmail = params.get('email')?.trim() ?? ''
    if (leakedEmail) setEmail(leakedEmail)
    window.history.replaceState(null, '', '/driver/login')
  }, [])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (!clientReady || submitting) return
    setSubmitting(true)
    try {
      const body = new URLSearchParams()
      body.set('email', email.trim())
      body.set('password', password)
      body.set('requireFeature', 'taxi_fleet.driver')
      body.set('redirect', '/driver')
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
          'x-mercato-login-response': 'json',
          'x-om-unauthorized-redirect': '0',
          'x-om-forbidden-redirect': '0',
        },
        body,
        credentials: 'same-origin',
      })
      if (res.redirected) {
        try {
          const next = new URL(res.url || '/driver', window.location.origin)
          window.location.assign(resolveDriverPostLoginPath(`${next.pathname}${next.search}${next.hash}`))
        } catch {
          window.location.assign('/driver')
        }
        return
      }
      const data = (await res.json().catch(() => null)) as LoginSuccess | null
      if (!res.ok) {
        flash(
          data?.error ||
            t(
              'taxi_fleet.driverApp.login.failed',
              'Login failed. Check credentials and taxi_fleet.driver access.',
            ),
          'error',
        )
        setSubmitting(false)
        return
      }
      if (data?.mfa_required === true) {
        flash(
          t(
            'taxi_fleet.driverApp.login.mfaUnsupported',
            'Multi-factor login is not supported in the driver app. Use the main login or ask an admin.',
          ),
          'error',
        )
        setSubmitting(false)
        return
      }
      window.location.assign(resolveDriverPostLoginPath(data?.redirect))
    } catch {
      flash(
        t(
          'taxi_fleet.driverApp.login.failed',
          'Login failed. Check credentials and taxi_fleet.driver access.',
        ),
        'error',
      )
      setSubmitting(false)
    }
  }

  return (
    <div
      className={`flex min-h-dvh items-center justify-center px-4 py-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] touch-manipulation ${driverPageBgClass}`}
    >
      <FlashMessages />
      {/*
        Same pattern as /login: action stays on the page so a pre-hydration submit
        never navigates to /api/auth/login and dumps raw JSON in the browser.
      */}
      <form
        method="post"
        action="/driver/login"
        autoComplete="on"
        onSubmit={onSubmit}
        className={`${driverCardClass} mx-auto w-full max-w-100 space-y-6 p-8! sm:p-10!`}
      >
        <input type="hidden" name="requireFeature" value="taxi_fleet.driver" />
        <input type="hidden" name="redirect" value="/driver" />
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="flex w-full items-center justify-center rounded-lg border border-[#F1F1F4] bg-[#F9F9F9] px-6 py-5">
            <DriverBrandMark className="mx-auto h-14 w-auto max-w-55 object-contain" />
          </div>
          <div>
            <h1 className="text-[1.35rem] font-semibold tracking-tight text-[#071437]">
              {t('taxi_fleet.driverApp.login.title', 'Sign in')}
            </h1>
            <p className={`mt-2 ${driverMutedTextClass}`}>
              {t('taxi_fleet.driverApp.login.subtitle', 'Sign in with your fleet staff account.')}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="email" className={driverLabelClass}>
              {t('taxi_fleet.driverApp.login.email', 'Email')}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={driverFieldClass}
            />
          </div>
          <div>
            <label htmlFor="password" className={driverLabelClass}>
              {t('taxi_fleet.driverApp.login.password', 'Password')}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={driverFieldClass}
            />
          </div>
        </div>

        <Button
          type="submit"
          className={driverPrimaryActionClass}
          disabled={submitting || !clientReady}
        >
          {submitting
            ? t('taxi_fleet.driverApp.login.submitting', 'Signing in…')
            : t('taxi_fleet.driverApp.login.submit', 'Sign In')}
        </Button>
      </form>
    </div>
  )
}
