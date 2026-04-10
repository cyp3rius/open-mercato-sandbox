/** Digits-only PESEL (11 characters) after stripping separators. */
export function normalizePeselDigits(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  const digits = raw.replace(/\D/g, '')
  return digits.length ? digits : null
}

/** Validates Polish PESEL checksum (11 digits). */
export function isValidPesel(digits: string): boolean {
  if (!/^\d{11}$/.test(digits)) return false
  const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3]
  let sum = 0
  for (let i = 0; i < 10; i += 1) {
    sum += Number(digits[i]) * weights[i]
  }
  const checksum = (10 - (sum % 10)) % 10
  return checksum === Number(digits[10])
}

/** Splits user-entered PESEL list (commas / whitespace). */
export function splitPeselTokens(raw: string): string[] {
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export function validatePeselList(raw: string): { ok: true } | { ok: false; invalidTokens: string[] } {
  const tokens = splitPeselTokens(raw)
  if (!tokens.length) return { ok: true }
  const invalid: string[] = []
  for (const token of tokens) {
    const digits = normalizePeselDigits(token)
    if (!digits || !isValidPesel(digits)) invalid.push(token)
  }
  return invalid.length ? { ok: false, invalidTokens: invalid } : { ok: true }
}
