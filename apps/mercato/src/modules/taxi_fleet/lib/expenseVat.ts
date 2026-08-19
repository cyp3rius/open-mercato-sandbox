export const EXPENSE_VAT_RATES = [8, 23] as const

export type ExpenseVatRatePercent = (typeof EXPENSE_VAT_RATES)[number]

export const DEFAULT_EXPENSE_VAT_RATE_PERCENT: ExpenseVatRatePercent = 23

export function normalizeExpenseVatRatePercent(value: unknown): ExpenseVatRatePercent {
  const parsed = Number(value)
  if (parsed === 8) return 8
  return DEFAULT_EXPENSE_VAT_RATE_PERCENT
}

export function expenseVatDivisor(vatRatePercent: number): number {
  return 1 + vatRatePercent / 100
}

export function expenseGrossToNet(gross: number, vatRatePercent: number): number {
  if (!Number.isFinite(gross)) return 0
  const divisor = expenseVatDivisor(vatRatePercent)
  return divisor > 0 ? gross / divisor : gross
}
