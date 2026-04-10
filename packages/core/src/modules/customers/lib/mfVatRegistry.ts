import { normalizeNipDigits } from './nip'
import { normalizeRegonDigits } from './regon'

export type MfRegistryCompanyData = {
  displayName: string
  legalName: string
  nip: string | null
  regon: string | null
  /** Single-line street + numbers when address is present */
  addressLine1?: string | null
  postalCode?: string | null
  city?: string | null
  country?: string | null
}

type MfAddress = {
  street?: string | null
  buildingNumber?: string | null
  apartmentNumber?: string | null
  zipCode?: string | null
  city?: string | null
  country?: string | null
}

type MfSubject = {
  name?: string | null
  nip?: string | null
  regon?: string | null
  /** MF API returns a single formatted line, e.g. `ul/ Prosta 49 00-838 Warszawa` */
  residenceAddress?: MfAddress | string | null
  workingAddress?: MfAddress | string | null
}

function formatAddress(addr: MfAddress | null | undefined): {
  line1: string | null
  postalCode: string | null
  city: string | null
  country: string | null
} {
  if (!addr) {
    return { line1: null, postalCode: null, city: null, country: null }
  }
  const street = typeof addr.street === 'string' ? addr.street.trim() : ''
  const bn = typeof addr.buildingNumber === 'string' ? addr.buildingNumber.trim() : ''
  const an = typeof addr.apartmentNumber === 'string' ? addr.apartmentNumber.trim() : ''
  const num = [bn, an].filter(Boolean).join('/').trim()
  const lineParts = [street, num].filter((x) => x.length > 0)
  const line1 = lineParts.length ? lineParts.join(' ').trim() : null
  const zip = typeof addr.zipCode === 'string' ? addr.zipCode.trim() : null
  const city = typeof addr.city === 'string' ? addr.city.trim() : null
  const country = typeof addr.country === 'string' ? addr.country.trim().toUpperCase() : null
  return { line1, postalCode: zip, city, country }
}

/** MF whitelist often returns one string: street … `00-000` `City` */
function formatAddressFromApiField(raw: MfAddress | string | null | undefined): ReturnType<typeof formatAddress> {
  if (raw == null) return { line1: null, postalCode: null, city: null, country: null }
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (!s.length) return { line1: null, postalCode: null, city: null, country: null }
    const postalMatch = s.match(/\b(\d{2}-\d{3})\s+(.+)$/)
    if (postalMatch) {
      const postalCode = postalMatch[1] ?? null
      const city = (postalMatch[2] ?? '').trim() || null
      const before = s.slice(0, postalMatch.index).trim()
      return {
        line1: before.length ? before : s,
        postalCode,
        city,
        country: 'PL',
      }
    }
    return { line1: s, postalCode: null, city: null, country: null }
  }
  return formatAddress(raw)
}

function pickAddress(subject: MfSubject): ReturnType<typeof formatAddress> {
  const w = formatAddressFromApiField(subject.workingAddress)
  if (w.line1 || w.postalCode || w.city) return w
  return formatAddressFromApiField(subject.residenceAddress)
}

function parseSubject(subject: MfSubject | null | undefined): MfRegistryCompanyData | null {
  if (!subject) return null
  const name = typeof subject.name === 'string' ? subject.name.trim() : ''
  if (!name.length) return null
  const nipRaw = typeof subject.nip === 'string' ? normalizeNipDigits(subject.nip) : null
  const regonRaw = typeof subject.regon === 'string' ? normalizeRegonDigits(subject.regon) : null
  const addr = pickAddress(subject)
  return {
    displayName: name,
    legalName: name,
    nip: nipRaw && nipRaw.length === 10 ? nipRaw : null,
    regon: regonRaw && (regonRaw.length === 9 || regonRaw.length === 14) ? regonRaw : null,
    addressLine1: addr.line1,
    postalCode: addr.postalCode,
    city: addr.city,
    country: addr.country,
  }
}

function registryDateParam(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Fetches company data from Polish Ministry of Finance VAT whitelist API (no API key).
 * @see https://wl-api.mf.gov.pl/
 */
export async function fetchCompanyFromMfVatRegistry(params: {
  nip?: string | null
  regon?: string | null
}): Promise<MfRegistryCompanyData | null> {
  const date = registryDateParam()
  const nip = params.nip ? normalizeNipDigits(params.nip) : null
  const regon = params.regon ? normalizeRegonDigits(params.regon) : null
  if (!nip && !regon) return null
  const url = nip
    ? `https://wl-api.mf.gov.pl/api/search/nip/${encodeURIComponent(nip)}?date=${encodeURIComponent(date)}`
    : `https://wl-api.mf.gov.pl/api/search/regon/${encodeURIComponent(regon!)}?date=${encodeURIComponent(date)}`

  const response = await fetch(url, {
    method: 'GET',
    headers: { accept: 'application/json' },
  })

  if (!response.ok) return null

  const json = (await response.json()) as { result?: { subject?: MfSubject } }
  const subject = json?.result?.subject
  return parseSubject(subject)
}
