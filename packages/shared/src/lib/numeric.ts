export function parseNumericValue(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const normalized = value.trim().replace(',', '.')
  if (!normalized.length) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function sanitizePercentTypingInput(raw: string, fractionDigits = 2): string {
  const normalized = raw.replace(',', '.').replace(/[^\d.]/g, '')
  const dotIndex = normalized.indexOf('.')
  if (dotIndex === -1) return normalized
  const whole = normalized.slice(0, dotIndex)
  const fraction = normalized.slice(dotIndex + 1).replace(/\./g, '').slice(0, fractionDigits)
  return `${whole}.${fraction}`
}

export type PercentFormatOptions = {
  min?: number
  max?: number
  fractionDigits?: number
}

export function formatPercentInputValue(
  value: string | number | null | undefined,
  options?: PercentFormatOptions,
): string {
  const min = options?.min ?? 0
  const max = options?.max ?? 100
  const fractionDigits = options?.fractionDigits ?? 2
  const parsed = parseNumericValue(value)
  if (parsed === null) return '0'
  const clamped = Math.min(max, Math.max(min, parsed))
  if (Number.isInteger(clamped)) return String(clamped)
  const fixed = clamped.toFixed(fractionDigits)
  return fixed.replace(/0+$/, '').replace(/\.$/, '')
}

export function formatPercentDisplay(
  value: string | number | null | undefined,
  locale?: string,
): string {
  const parsed = parseNumericValue(value)
  if (parsed === null) return '—'
  const formatter = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })
  return formatter.format(parsed / 100)
}

export type MoneyFormatOptions = {
  locale?: string
  currency?: string
  minimumFractionDigits?: number
  maximumFractionDigits?: number
}

export function formatMoneyDisplay(
  value: string | number | null | undefined,
  options?: MoneyFormatOptions,
): string {
  const parsed = parseNumericValue(value)
  if (parsed === null) return '—'
  const formatter = new Intl.NumberFormat(options?.locale, {
    style: 'currency',
    currency: options?.currency ?? 'PLN',
    minimumFractionDigits: options?.minimumFractionDigits ?? 2,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  })
  return formatter.format(parsed)
}

export function formatSignedMoneyDisplay(
  value: string | number | null | undefined,
  options?: MoneyFormatOptions & { sign?: 'income' | 'expense' },
): string {
  const parsed = parseNumericValue(value)
  if (parsed === null) return '—'
  const absolute = formatMoneyDisplay(Math.abs(parsed), options)
  if (options?.sign === 'expense') return `−${absolute}`
  if (options?.sign === 'income') return `+${absolute}`
  return absolute
}
