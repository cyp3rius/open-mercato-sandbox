import { expenseGrossToNet, normalizeExpenseVatRatePercent } from '../expenseVat'

describe('expenseVat', () => {
  it('defaults unknown rates to 23%', () => {
    expect(normalizeExpenseVatRatePercent(undefined)).toBe(23)
    expect(normalizeExpenseVatRatePercent(99)).toBe(23)
  })

  it('accepts 8% VAT', () => {
    expect(normalizeExpenseVatRatePercent(8)).toBe(8)
  })

  it('converts gross to net', () => {
    expect(expenseGrossToNet(468.82, 23)).toBeCloseTo(381.15, 2)
    expect(expenseGrossToNet(108, 8)).toBeCloseTo(100, 2)
  })
})
