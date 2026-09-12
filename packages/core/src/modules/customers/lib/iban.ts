/** Digits/letters only IBAN or domestic account after stripping separators. */
export function normalizeIbanDigits(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  const compact = raw.trim().replace(/[\s-]+/g, '').toUpperCase()
  return compact.length ? compact : null
}

/** Persist IBAN with spaces every 4 chars when it looks like an IBAN; otherwise compact. */
export function normalizeIbanForStorage(raw: string | null | undefined): string | null {
  const compact = normalizeIbanDigits(raw)
  if (!compact) return null
  if (/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(compact) && compact.length >= 15) {
    return compact.replace(/(.{4})/g, '$1 ').trim()
  }
  return compact
}
