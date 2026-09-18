import { isValidNip, normalizeNipDigits } from '@open-mercato/core/modules/customers/lib/nip'
import { normalizeDriverCustomerPhone } from './driverCustomerPhone'

/** CRM `primaryPhone` requires `+` country code; calculator often sends PL national numbers. */
export function sanitizeTripInjectPhone(raw: string | null | undefined): string | null {
  return normalizeDriverCustomerPhone(raw)
}

export type TripInjectNipResolution =
  | { status: 'empty'; nip: null }
  | { status: 'valid'; nip: string }
  | { status: 'invalid'; nip: null }

/**
 * Empty tax id is allowed (optional). Non-empty values must be a valid Polish NIP
 * (10 digits + checksum) after stripping separators / PL prefix noise.
 */
export function resolveTripInjectNip(raw: string | null | undefined): TripInjectNipResolution {
  if (typeof raw !== 'string') return { status: 'empty', nip: null }
  const trimmed = raw.trim()
  if (!trimmed) return { status: 'empty', nip: null }
  const digits = normalizeNipDigits(trimmed)
  if (!digits || digits.length !== 10 || !isValidNip(digits)) {
    return { status: 'invalid', nip: null }
  }
  return { status: 'valid', nip: digits }
}

/** Digits-only NIP for CRM create; `null` when empty or invalid (callers must reject invalid). */
export function sanitizeTripInjectNip(raw: string | null | undefined): string | null {
  const resolved = resolveTripInjectNip(raw)
  return resolved.status === 'valid' ? resolved.nip : null
}
