import type { EntityManager } from '@mikro-orm/postgresql'
import { emailDefaultLocale, locales, type Locale } from '@open-mercato/shared/lib/i18n/config'
import { User } from '../data/entities'
import { computeEmailHash } from './emailHash'

const supportedLocales = new Set<Locale>(locales)

export function normalizeUserLocale(value: string | null | undefined): Locale | null {
  if (!value) return null
  const trimmed = value.trim().toLowerCase()
  return supportedLocales.has(trimmed as Locale) ? (trimmed as Locale) : null
}

export function resolveLocaleForEmail(preferredLocale: string | null | undefined): Locale {
  return normalizeUserLocale(preferredLocale) ?? emailDefaultLocale
}

type UserLocaleScope = {
  userId: string
  tenantId?: string | null
  organizationId?: string | null
}

export async function resolveUserLocale(em: EntityManager, scope: UserLocaleScope): Promise<Locale> {
  const where: Record<string, unknown> = {
    id: scope.userId,
    deletedAt: null,
  }
  if (scope.tenantId) {
    where.tenantId = scope.tenantId
  }
  if (scope.organizationId) {
    where.organizationId = scope.organizationId
  }

  const user = await em.findOne(User, where, { fields: ['preferredLocale'] })
  return resolveLocaleForEmail(user?.preferredLocale)
}

export async function resolveUserLocaleByEmail(
  em: EntityManager,
  email: string,
  scope?: { tenantId?: string | null },
): Promise<Locale> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) return emailDefaultLocale

  const emailHash = computeEmailHash(normalizedEmail)
  const where: Record<string, unknown> = {
    $or: [{ email: normalizedEmail }, { emailHash }],
    deletedAt: null,
  }
  if (scope?.tenantId) {
    where.tenantId = scope.tenantId
  }

  const user = await em.findOne(User, where as never, { fields: ['preferredLocale'] })
  return resolveLocaleForEmail(user?.preferredLocale)
}
