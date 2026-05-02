/** Digits-only NIP (10 characters) after stripping separators. */
export function normalizeNipDigits(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  const digits = raw.replace(/\D/g, '')
  return digits.length ? digits : null
}

/** Validates Polish NIP (10 digits, weighted checksum; control digit rejects modulus 10). */
export function isValidNip(digits: string): boolean {
  if (!/^\d{10}$/.test(digits)) return false
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7]
  let sum = 0
  for (let i = 0; i < 9; i += 1) {
    sum += Number(digits[i]) * weights[i]!
  }
  const checksum = sum % 11
  if (checksum === 10) return false
  return checksum === Number(digits[9])
}
