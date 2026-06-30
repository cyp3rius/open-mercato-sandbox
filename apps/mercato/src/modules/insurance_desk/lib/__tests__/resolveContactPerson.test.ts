import { normalizeStrapiReferralCode } from '../strapiLeadMapper'

describe('resolveContactPerson helpers', () => {
  it('normalizes referral codes consistently with partner resolution', () => {
    expect(normalizeStrapiReferralCode('jan-kowalski')).toBe('jankowalski')
    expect(normalizeStrapiReferralCode('ab')).toBeNull()
  })
})
