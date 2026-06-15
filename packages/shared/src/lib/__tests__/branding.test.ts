import { describe, expect, it } from '@jest/globals'
import {
  DEFAULT_BRAND_LOGO_SRC,
  normalizePublicAssetPath,
  resolveAppBranding,
} from '../branding'

describe('branding', () => {
  it('normalizes public asset paths', () => {
    expect(normalizePublicAssetPath('brand/logo.png')).toBe('/brand/logo.png')
    expect(normalizePublicAssetPath('/brand/logo.png')).toBe('/brand/logo.png')
    expect(normalizePublicAssetPath('  ')).toBeNull()
  })

  it('uses defaults when env is empty', () => {
    expect(
      resolveAppBranding({
        logoEnv: '',
        nameEnv: '',
        fallbackName: 'Open Mercato',
      }),
    ).toEqual({
      logoSrc: DEFAULT_BRAND_LOGO_SRC,
      faviconSrc: DEFAULT_BRAND_LOGO_SRC,
      productName: 'Open Mercato',
      documentTitle: 'Open Mercato',
    })
  })

  it('hides product name when BRAND_NAME is false', () => {
    expect(
      resolveAppBranding({
        logoEnv: '/brand/moto-concierge.png',
        nameEnv: 'false',
        fallbackName: 'Open Mercato',
      }),
    ).toEqual({
      logoSrc: '/brand/moto-concierge.png',
      faviconSrc: '/brand/moto-concierge.png',
      productName: null,
      documentTitle: 'Open Mercato',
    })
  })

  it('uses BRAND_TITLE for document title while sidebar stays logo-only', () => {
    expect(
      resolveAppBranding({
        logoEnv: '/brand/logo-wide.svg',
        faviconEnv: '/brand/favicon.svg',
        nameEnv: 'false',
        titleEnv: 'RS Moto :: CRM | Open Mercato',
        fallbackName: 'Open Mercato',
      }),
    ).toEqual({
      logoSrc: '/brand/logo-wide.svg',
      faviconSrc: '/brand/favicon.svg',
      productName: null,
      documentTitle: 'RS Moto :: CRM | Open Mercato',
    })
  })

  it('uses explicit brand name when provided', () => {
    expect(
      resolveAppBranding({
        logoEnv: 'brand/custom.svg',
        nameEnv: 'MOTO Concierge',
        fallbackName: 'Open Mercato',
      }),
    ).toEqual({
      logoSrc: '/brand/custom.svg',
      faviconSrc: '/brand/custom.svg',
      productName: 'MOTO Concierge',
      documentTitle: 'MOTO Concierge',
    })
  })

  it('uses dedicated favicon when provided', () => {
    expect(
      resolveAppBranding({
        logoEnv: '/brand/logo-wide.svg',
        faviconEnv: '/brand/favicon.svg',
        nameEnv: 'RS Moto :: CRM | Open Mercato',
        fallbackName: 'Open Mercato',
      }),
    ).toEqual({
      logoSrc: '/brand/logo-wide.svg',
      faviconSrc: '/brand/favicon.svg',
      productName: 'RS Moto :: CRM | Open Mercato',
      documentTitle: 'RS Moto :: CRM | Open Mercato',
    })
  })
})
