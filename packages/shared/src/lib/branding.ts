import { parseBooleanToken } from './boolean'

export const DEFAULT_BRAND_LOGO_SRC = '/open-mercato.svg'

export type ResolvedAppBranding = {
  logoSrc: string
  faviconSrc: string
  /** When `null`, UI should render logo only (no product name label). */
  productName: string | null
  /** Value for the HTML document `<title>` and root metadata. */
  documentTitle: string
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
  titleEnv?: string | null
  fallbackName?: string | null
}): ResolvedAppBranding {
  const logoEnv = options?.logoEnv ?? process.env.BRAND_LOGO ?? process.env.OM_BRAND_LOGO
  const faviconEnv = options?.faviconEnv ?? process.env.BRAND_FAVICON ?? process.env.OM_BRAND_FAVICON
  const nameEnv = options?.nameEnv ?? process.env.BRAND_NAME ?? process.env.OM_BRAND_NAME
  const titleEnv = options?.titleEnv ?? process.env.BRAND_TITLE ?? process.env.OM_BRAND_TITLE
  const logoSrc = normalizePublicAssetPath(logoEnv) ?? DEFAULT_BRAND_LOGO_SRC
  const faviconSrc = normalizePublicAssetPath(faviconEnv) ?? logoSrc
  const fallbackName = options?.fallbackName?.trim() || 'Open Mercato'

  let productName: string | null = null
  if (nameEnv !== undefined && nameEnv !== null && String(nameEnv).trim().length) {
    const nameBool = parseBooleanToken(nameEnv)
    if (nameBool !== false) {
      const trimmedName = String(nameEnv).trim()
      if (trimmedName.length) {
        productName = trimmedName
      }
    }
  } else if (fallbackName.length) {
    productName = fallbackName
  }

  const titleTrimmed = typeof titleEnv === 'string' ? titleEnv.trim() : ''
  if (titleTrimmed.length) {
    return { logoSrc, faviconSrc, productName, documentTitle: titleTrimmed }
  }

  if (productName !== null) {
    return { logoSrc, faviconSrc, productName, documentTitle: productName }
  }

  return { logoSrc, faviconSrc, productName: null, documentTitle: fallbackName }
}
