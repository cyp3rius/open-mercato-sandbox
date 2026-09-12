import {
  resolveFuelIndicatorLed,
  resolveRevenueIndicatorLed,
} from '../settlementIndicatorLed'

describe('resolveFuelIndicatorLed', () => {
  const range = { min: 0.1, max: 0.2 }

  it('returns red above max', () => {
    expect(resolveFuelIndicatorLed(0.21, range)).toBe('red')
  })

  it('returns yellow between midpoint and max', () => {
    expect(resolveFuelIndicatorLed(0.16, range)).toBe('yellow')
  })

  it('returns green below midpoint', () => {
    expect(resolveFuelIndicatorLed(0.14, range)).toBe('green')
  })

  it('returns green below min', () => {
    expect(resolveFuelIndicatorLed(0.05, range)).toBe('green')
  })

  it('uses max-only range with implicit midpoint at half of max', () => {
    expect(resolveFuelIndicatorLed(0.25, { min: null, max: 0.2 })).toBe('red')
    expect(resolveFuelIndicatorLed(0.16, { min: null, max: 0.2 })).toBe('yellow')
    expect(resolveFuelIndicatorLed(0.08, { min: null, max: 0.2 })).toBe('green')
  })
})

describe('resolveRevenueIndicatorLed', () => {
  const range = { min: 1.0, max: 2.0 }

  it('returns red below min', () => {
    expect(resolveRevenueIndicatorLed(0.9, range)).toBe('red')
  })

  it('returns yellow between min and midpoint', () => {
    expect(resolveRevenueIndicatorLed(1.2, range)).toBe('yellow')
  })

  it('returns green above midpoint', () => {
    expect(resolveRevenueIndicatorLed(1.6, range)).toBe('green')
  })

  it('returns green above max', () => {
    expect(resolveRevenueIndicatorLed(2.5, range)).toBe('green')
  })
})
