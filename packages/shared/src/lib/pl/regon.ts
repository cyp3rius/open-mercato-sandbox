/** Digits-only REGON after stripping separators (9 or 14 digits). */
export function normalizeRegonDigits(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  const digits = raw.replace(/\D/g, '')
  return digits.length ? digits : null
}

function isValidRegon9(digits: string): boolean {
  if (!/^\d{9}$/.test(digits)) return false
  const weights = [8, 9, 2, 3, 4, 5, 6, 7]
  let sum = 0
  for (let i = 0; i < 8; i += 1) {
    sum += Number(digits[i]) * weights[i]!
  }
  let control = sum % 11
  if (control === 10) control = 0
  return control === Number(digits[8])
}

function isValidRegon14(digits: string): boolean {
  if (!/^\d{14}$/.test(digits)) return false
  if (!isValidRegon9(digits.slice(0, 9))) return false
  const weights = [2, 4, 8, 5, 0, 9, 7, 3, 6, 1, 2, 4, 8]
  let sum = 0
  for (let i = 0; i < 13; i += 1) {
    sum += Number(digits[i]) * weights[i]!
  }
  let control = sum % 11
  if (control === 10) control = 0
  return control === Number(digits[13])
}

/** Validates Polish REGON (9 or 14 digits with correct checksum). */
export function isValidRegon(digits: string): boolean {
  if (digits.length === 9) return isValidRegon9(digits)
  if (digits.length === 14) return isValidRegon14(digits)
  return false
}
