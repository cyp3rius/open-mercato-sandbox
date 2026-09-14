import {
  decodePendingTripCustomerPhone,
  encodePendingTripCustomerPhone,
  isPendingTripCustomerPhone,
  resolveTripCustomerPayloadFields,
  resolveTripCustomerPhoneCandidate,
} from '../pendingTripCustomerPhone'

describe('pendingTripCustomerPhone', () => {
  it('encodes and decodes normalized phone', () => {
    const encoded = encodePendingTripCustomerPhone('+48504013184')
    expect(encoded).toBe('pending-phone:+48504013184')
    expect(decodePendingTripCustomerPhone(encoded)).toBe('+48504013184')
    expect(isPendingTripCustomerPhone(encoded)).toBe(true)
  })

  it('rejects uuid and empty values', () => {
    expect(isPendingTripCustomerPhone('94f1f812-4fc7-4f5a-a30d-314d95a73681')).toBe(false)
    expect(decodePendingTripCustomerPhone('')).toBeNull()
    expect(decodePendingTripCustomerPhone('pending-phone:123')).toBeNull()
  })

  it('resolveTripCustomerPhoneCandidate accepts raw PL national numbers', () => {
    expect(resolveTripCustomerPhoneCandidate('504 013 184')).toBe('+48504013184')
    expect(resolveTripCustomerPhoneCandidate('pending-phone:504013184')).toBe('+48504013184')
  })

  it('resolveTripCustomerPayloadFields maps pending phone to customerPrimaryPhone', () => {
    expect(resolveTripCustomerPayloadFields(encodePendingTripCustomerPhone('+48504013184'))).toEqual({
      customerPrimaryPhone: '+48504013184',
    })
    expect(resolveTripCustomerPayloadFields('55555555-5555-4555-8555-555555555555')).toEqual({
      customerEntityId: '55555555-5555-4555-8555-555555555555',
    })
    expect(resolveTripCustomerPayloadFields('')).toEqual({})
  })
})
