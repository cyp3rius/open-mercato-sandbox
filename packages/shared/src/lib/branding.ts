import { parseBooleanToken } from './boolean'

export const DEFAULT_BRAND_LOGO_SRC = '/open-mercato.svg'

export type ResolvedAppBranding = {
  logoSrc: string
  faviconSrc: string
  /** When `null`, UI should render logo only (no product name label). */
  productName: string | null
}

export function normalizePublicAssetPath(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed.length) return null
  if (trimmed.startsWith('/')) return trimmed
  return `/${trimmed.replace(/^\/+/, '')}`
}

export function resolveAppBranding(options?: {
  logoEnv?: string | null
  faviconEnv?: string | null
  nameEnv?: string | null
  fallbackName?: string | null
}): ResolvedAppBranding {
  const logoEnv = options?.logoEnv ?? process.env.BRAND_LOGO ?? process.env.OM_BRAND_LOGO
  const faviconEnv = options?.faviconEnv ?? process.env.BRAND_FAVICON ?? process.env.OM_BRAND_FAVICON
  const nameEnv = options?.nameEnv ?? process.env.BRAND_NAME ?? process.env.OM_BRAND_NAME
  const logoSrc = normalizePublicAssetPath(logoEnv) ?? DEFAULT_BRAND_LOGO_SRC
  const faviconSrc = normalizePublicAssetPath(faviconEnv) ?? logoSrc

  if (nameEnv !== undefined && nameEnv !== null && String(nameEnv).trim().length) {
    const nameBool = parseBooleanToken(nameEnv)
    if (nameBool === false) {
      return { logoSrc, faviconSrc, productName: null }
    }
    const trimmedName = String(nameEnv).trim()
    if (trimmedName.length) {
      return { logoSrc, faviconSrc, productName: trimmedName }
    }
  }

  const fallbackName = options?.fallbackName?.trim()
  return {
    logoSrc,
    faviconSrc,
    productName: fallbackName?.length ? fallbackName : null,
  }
}
