import { extractPhoneDigits, isValidPhoneNumber } from '@open-mercato/shared/lib/phone'

/**
 * Normalize a phone for CRM create (requires `+` country code).
 * Driver app users usually type PL national numbers (e.g. 504013184) — prepend +48.
 */
export function normalizeDriverCustomerPhone(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (isValidPhoneNumber(trimmed)) return trimmed

  const digits = extractPhoneDigits(trimmed)
  if (!digits) return null

  let candidate = ''
  if (digits.startsWith('48') && digits.length >= 11) {
    candidate = `+${digits}`
  } else if (digits.startsWith('0') && digits.length >= 10) {
    candidate = `+48${digits.slice(1)}`
  } else if (digits.length >= 7 && digits.length <= 9) {
    // National PL number without country code (mobile is typically 9 digits)
    candidate = `+48${digits}`
  }

  if (candidate && isValidPhoneNumber(candidate)) return candidate
  return null
}
