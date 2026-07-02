import { NextResponse } from 'next/server'
import { locales, type Locale } from '@open-mercato/shared/lib/i18n/config'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager } from '@mikro-orm/postgresql'
import { User } from '../../data/entities'
import { normalizeUserLocale } from '../../lib/userLocale'

const supportedLocales = new Set<Locale>(locales)

export const metadata = {
  GET: { requireAuth: false },
  POST: { requireAuth: false },
}

async function persistPreferredLocale(req: Request, locale: Locale): Promise<void> {
  const auth = await getAuthFromRequest(req)
  if (!auth?.sub) return

  const container = await createRequestContainer()
  const em = (container.resolve('em') as EntityManager).fork()
  const user = await em.findOne(User, { id: auth.sub, deletedAt: null })
  if (!user) return

  user.preferredLocale = locale
  await em.flush()
}

export async function POST(req: Request) {
  const { t } = await resolveTranslations()
  try {
    const { locale } = await req.json()
    if (typeof locale !== 'string' || !supportedLocales.has(locale as Locale)) {
      return NextResponse.json({ error: t('api.errors.invalidLocale', 'Invalid locale') }, { status: 400 })
    }
    const normalizedLocale = normalizeUserLocale(locale)
    if (!normalizedLocale) {
      return NextResponse.json({ error: t('api.errors.invalidLocale', 'Invalid locale') }, { status: 400 })
    }

    await persistPreferredLocale(req, normalizedLocale)

    const res = NextResponse.json({ ok: true })
    res.cookies.set('locale', normalizedLocale, { path: '/', maxAge: 60 * 60 * 24 * 365 })
    return res
  } catch {
    return NextResponse.json({ error: t('api.errors.badRequest', 'Bad request') }, { status: 400 })
  }
}

export async function GET(req: Request) {
  const { t } = await resolveTranslations()
  const url = new URL(req.url)
  const locale = url.searchParams.get('locale')
  if (!locale || !supportedLocales.has(locale as Locale)) {
    return NextResponse.json({ error: t('api.errors.invalidLocale', 'Invalid locale') }, { status: 400 })
  }
  const normalizedLocale = normalizeUserLocale(locale)
  if (!normalizedLocale) {
    return NextResponse.json({ error: t('api.errors.invalidLocale', 'Invalid locale') }, { status: 400 })
  }

  await persistPreferredLocale(req, normalizedLocale)

  const res = NextResponse.redirect(url.searchParams.get('redirect') || '/')
  res.cookies.set('locale', normalizedLocale, { path: '/', maxAge: 60 * 60 * 24 * 365 })
  return res
}
