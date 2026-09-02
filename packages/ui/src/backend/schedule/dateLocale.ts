import type { Locale as AppLocale } from '@open-mercato/shared/lib/i18n/config'
import type { Locale as DateFnsLocale } from 'date-fns'
import { de } from 'date-fns/locale/de'
import { enUS } from 'date-fns/locale/en-US'
import { es } from 'date-fns/locale/es'
import { pl } from 'date-fns/locale/pl'

export const SCHEDULE_DATE_FNS_LOCALES: Record<string, DateFnsLocale> = {
  'en-US': enUS,
  en: enUS,
  pl,
  es,
  de,
}

export function resolveScheduleDateFnsLocale(locale: AppLocale | string | null | undefined): DateFnsLocale {
  if (!locale) return enUS
  return SCHEDULE_DATE_FNS_LOCALES[locale] ?? SCHEDULE_DATE_FNS_LOCALES[locale.split('-')[0] ?? ''] ?? enUS
}

export function resolveScheduleCulture(locale: AppLocale | string | null | undefined): string {
  if (!locale) return 'en-US'
  if (locale === 'en' || locale.startsWith('en-')) return 'en-US'
  if (locale === 'pl' || locale.startsWith('pl-')) return 'pl'
  if (locale === 'es' || locale.startsWith('es-')) return 'es'
  if (locale === 'de' || locale.startsWith('de-')) return 'de'
  return 'en-US'
}
