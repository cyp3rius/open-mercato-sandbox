import {
  DRIVER_COMMERCIAL_TRIP_TYPES,
  resolveDriverCommercialFieldVisibility,
  tripTypeRequiresCustomer,
} from '../driverTripCommercialFields'

describe('driverTripCommercialFields', () => {
  it('exposes driver picker types without event or platform', () => {
    expect(DRIVER_COMMERCIAL_TRIP_TYPES).toEqual([
      'client',
      'street_hail',
      'internal',
      'private',
      'empty',
      'other',
    ])
  })

  it('hides platform/customer/payment for private, internal, empty', () => {
    for (const tripType of ['private', 'internal', 'empty'] as const) {
      expect(resolveDriverCommercialFieldVisibility(tripType)).toEqual({
        showPlatform: false,
        showCustomer: false,
        customerRequired: false,
        showPayment: false,
      })
    }
  })

  it('requires customer for client and other', () => {
    expect(tripTypeRequiresCustomer('client')).toBe(true)
    expect(tripTypeRequiresCustomer('other')).toBe(true)
    expect(tripTypeRequiresCustomer('street_hail')).toBe(false)
  })

  it('hides platform and keeps optional customer for street hail', () => {
    expect(resolveDriverCommercialFieldVisibility('street_hail')).toEqual({
      showPlatform: false,
      showCustomer: true,
      customerRequired: false,
      showPayment: true,
    })
  })
})
