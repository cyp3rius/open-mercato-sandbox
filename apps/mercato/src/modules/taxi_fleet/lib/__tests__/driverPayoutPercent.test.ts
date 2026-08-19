import { resolveDriverPayoutPercent } from '../driverPayoutPercent'

describe('resolveDriverPayoutPercent', () => {
  it('uses profile percent when set above zero', () => {
    expect(
      resolveDriverPayoutPercent({
        profilePayoutPercent: 42,
        defaultPayoutPercent: 50,
      }),
    ).toBe(42)
  })

  it('falls back to organization default when profile is zero', () => {
    expect(
      resolveDriverPayoutPercent({
        profilePayoutPercent: 0,
        defaultPayoutPercent: 50,
      }),
    ).toBe(50)
  })

  it('falls back to organization default when profile is missing or invalid', () => {
    expect(
      resolveDriverPayoutPercent({
        profilePayoutPercent: null,
        defaultPayoutPercent: '35',
      }),
    ).toBe(35)

    expect(
      resolveDriverPayoutPercent({
        profilePayoutPercent: 'not-a-number',
        defaultPayoutPercent: 25,
      }),
    ).toBe(25)
  })

  it('returns zero when neither profile nor default is usable', () => {
    expect(
      resolveDriverPayoutPercent({
        profilePayoutPercent: 0,
        defaultPayoutPercent: undefined,
      }),
    ).toBe(0)
  })
})
