import type { TranslateParams } from '@open-mercato/shared/lib/i18n/context'

/** Client `useT()` or server `translate` from `resolveTranslations()`. */
export type ProcedurePlaybookLabelTranslate = (
  key: string,
  fallback?: string,
  params?: TranslateParams,
) => string

export function formatProcedurePlaybookLabel(
  title: string,
  version: number | null | undefined,
  t: ProcedurePlaybookLabelTranslate,
): string {
  const base = typeof title === 'string' ? title.trim() : ''
  const raw = version === null || version === undefined ? null : Number(version)
  if (raw === null || Number.isNaN(raw)) return base
  const intVer = Math.trunc(raw)
  const suffix = t('cases.procedure.versionSuffix', 'Version {{version}}', { version: intVer })
  return base.length > 0 ? `${base} (${suffix})` : suffix
}
