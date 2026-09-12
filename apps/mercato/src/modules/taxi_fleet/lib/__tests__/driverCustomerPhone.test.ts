import { normalizeDriverCustomerPhone } from '../driverCustomerPhone'

describe('normalizeDriverCustomerPhone', () => {
  it('keeps numbers that already have a country code', () => {
    expect(normalizeDriverCustomerPhone('+48504013184')).toBe('+48504013184')
    expect(normalizeDriverCustomerPhone('+48 504 013 184')).toBe('+48 504 013 184')
  })

  it('prepends +48 for Polish national mobile numbers', () => {
    expect(normalizeDriverCustomerPhone('504013184')).toBe('+48504013184')
    expect(normalizeDriverCustomerPhone('504 013 184')).toBe('+48504013184')
  })

  it('normalizes 48… and 0… national forms', () => {
    expect(normalizeDriverCustomerPhone('48504013184')).toBe('+48504013184')
    expect(normalizeDriverCustomerPhone('0504013184')).toBe('+48504013184')
  })

  it('rejects empty or unusable values', () => {
    expect(normalizeDriverCustomerPhone('')).toBeNull()
    expect(normalizeDriverCustomerPhone('123')).toBeNull()
    expect(normalizeDriverCustomerPhone(null)).toBeNull()
  })
})
