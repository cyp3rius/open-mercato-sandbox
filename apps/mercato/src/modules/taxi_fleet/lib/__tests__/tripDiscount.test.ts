import { parseTripDiscountJson, tripHasAppliedDiscount } from '../tripDiscount'

describe('tripDiscount', () => {
  it('reads applied discount from json', () => {
    const snapshot = parseTripDiscountJson(
      JSON.stringify({
        code: 'SUMMER10',
        discountType: 'percent',
        value: 10,
        discountAmount: 20,
        totalBefore: 200,
        totalAfter: 180,
      }),
    )
    expect(snapshot?.code).toBe('SUMMER10')
    expect(snapshot?.discountAmount).toBe(20)
    expect(tripHasAppliedDiscount({ discountJson: JSON.stringify(snapshot) })).toBe(true)
  })

  it('ignores empty or zero discounts', () => {
    expect(parseTripDiscountJson('')).toBeNull()
    expect(
      parseTripDiscountJson(JSON.stringify({ code: 'X', discountAmount: 0, totalBefore: 100 })),
    ).toBeNull()
    expect(tripHasAppliedDiscount({ discountJson: '' })).toBe(false)
  })
})
