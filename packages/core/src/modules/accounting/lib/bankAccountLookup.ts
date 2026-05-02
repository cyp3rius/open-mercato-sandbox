import { getBankDataFromIBAN } from 'iban-utils'

export type BankAccountLookupResult = {
  valid: boolean
  normalizedIban: string | null
  countryCode: string | null
  bankName: string | null
  bic: string | null
  /** PL — znaleziono wpis w katalogu EWIB (nazwa banku / BIC). */
  directoryHit: boolean
}

/**
 * Wyciąga kod SWIFT/BIC z wpisów EWIB (`BIC WBKPPLPPXXX`, `BIC SEPA …`).
 */
export function extractPrimarySwiftFromEwibBicCodes(
  bicCodes: string[] | string | null | undefined,
): string | null {
  if (bicCodes == null) return null
  const list = Array.isArray(bicCodes) ? bicCodes : [bicCodes]
  const preferred =
    list.find((s) => typeof s === 'string' && /\bSEPA\b/i.test(s)) ??
    list.find((s) => typeof s === 'string' && /\bBIC\b/i.test(s))
  const raw = preferred ?? list[0]
  if (typeof raw !== 'string') return null
  const m = raw.match(/\b([A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)\b/)
  return m?.[1] ?? null
}

/** Usuwa spacje i myślniki — jedna forma do walidacji IBAN (wpisy ze spacjami lub bez). */
export function compactBankAccountInput(rawInput: string): string {
  return rawInput.trim().replace(/[\s-]+/g, '').toUpperCase()
}

/** Standardowy zapis IBAN ze spacjami co 4 znaki (np. przy persystencji spółek sprzedających). */
export function formatIbanWithSpaces(compactIban: string): string {
  const c = compactIban.trim().replace(/[\s-]+/g, '').toUpperCase()
  if (!c.length) return ''
  return c.replace(/(.{4})/g, '$1 ').trim()
}

/**
 * Walidacja strukturalna IBAN + dla PL katalog EWIB (nazwa banku, BIC).
 * Dla innych krajów: tylko walidacja — bez nazwy/BIC.
 * Akceptuje wpisy ze spacjami lub myślnikami.
 */
export function lookupBankAccountStructured(rawInput: string): BankAccountLookupResult {
  const trimmed = rawInput.trim()
  if (!trimmed.length) {
    return {
      valid: false,
      normalizedIban: null,
      countryCode: null,
      bankName: null,
      bic: null,
      directoryHit: false,
    }
  }

  const compact = compactBankAccountInput(trimmed)
  if (!compact.length) {
    return {
      valid: false,
      normalizedIban: null,
      countryCode: null,
      bankName: null,
      bic: null,
      directoryHit: false,
    }
  }

  let parsed: ReturnType<typeof getBankDataFromIBAN>
  try {
    parsed = getBankDataFromIBAN(compact)
  } catch {
    return {
      valid: false,
      normalizedIban: null,
      countryCode: null,
      bankName: null,
      bic: null,
      directoryHit: false,
    }
  }

  if (!parsed.valid) {
    return {
      valid: false,
      normalizedIban: null,
      countryCode: null,
      bankName: null,
      bic: null,
      directoryHit: false,
    }
  }

  const normalizedIban =
    'countryCode' in parsed && parsed.countryCode && parsed.checkDigits && parsed.bban
      ? `${parsed.countryCode}${parsed.checkDigits}${parsed.bban}`.toUpperCase()
      : null

  const bank = parsed.bank
  const bicCodes = bank?.branch?.bank_number_data?.bic_codes
  const bic = bank ? extractPrimarySwiftFromEwibBicCodes(bicCodes) : null
  const bankName = bank?.name?.trim() ? bank.name.trim() : null

  return {
    valid: true,
    normalizedIban,
    countryCode: 'countryCode' in parsed ? (parsed.countryCode ?? null) : null,
    bankName,
    bic,
    directoryHit: Boolean(bank),
  }
}

/**
 * Persystencja kont sprzedających: IBAN → zweryfikowany zapis wielkimi literami ze spacjami;
 * inne wartości → tylko zwarte znaki (bez spacji).
 */
export function normalizeBankAccountNumberForStorage(rawInput: string): string {
  const compact = compactBankAccountInput(rawInput)
  if (!compact.length) return ''
  const lookup = lookupBankAccountStructured(compact)
  if (lookup.valid && lookup.normalizedIban) {
    return formatIbanWithSpaces(lookup.normalizedIban)
  }
  return compact
}
