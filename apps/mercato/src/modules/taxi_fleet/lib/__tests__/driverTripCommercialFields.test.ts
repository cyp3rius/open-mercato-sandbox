import {
  DRIVER_COMMERCIAL_TRIP_TYPES,
  resolveDriverCommercialFieldVisibility,
  resolveDriverTripFinishStatus,
  tripTypeRequiresCustomer,
  tripTypeRequiresReceipt,
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

  it('hides payment for private, internal, empty; receipt only for non-internal', () => {
    expect(resolveDriverCommercialFieldVisibility('internal')).toEqual({
      showPlatform: false,
      showCustomer: false,
      customerRequired: false,
      showPayment: false,
      showReceipt: false,
    })
    for (const tripType of ['private', 'empty'] as const) {
      expect(resolveDriverCommercialFieldVisibility(tripType)).toEqual({
        showPlatform: false,
        showCustomer: false,
        customerRequired: false,
        showPayment: false,
        showReceipt: true,
      })
    }
  })

  it('requires customer for client and other', () => {
    expect(tripTypeRequiresCustomer('client')).toBe(true)
    expect(tripTypeRequiresCustomer('other')).toBe(true)
    expect(tripTypeRequiresCustomer('street_hail')).toBe(false)
  })

  it('does not require receipt for internal trips', () => {
    expect(tripTypeRequiresReceipt('internal')).toBe(false)
    expect(tripTypeRequiresReceipt('client')).toBe(true)
    expect(tripTypeRequiresReceipt('private')).toBe(true)
  })

  it('maps internal finish to pending_authorization', () => {
    expect(resolveDriverTripFinishStatus('internal', 'completed')).toBe('pending_authorization')
    expect(resolveDriverTripFinishStatus('client', 'completed')).toBe('completed')
    expect(resolveDriverTripFinishStatus('internal', 'scheduled')).toBe('scheduled')
  })

  it('never shows platform picker for driver commercial types', () => {
    for (const tripType of DRIVER_COMMERCIAL_TRIP_TYPES) {
      expect(resolveDriverCommercialFieldVisibility(tripType).showPlatform).toBe(false)
    }
  })

  it('hides platform and keeps optional customer for street hail', () => {
    expect(resolveDriverCommercialFieldVisibility('street_hail')).toEqual({
      showPlatform: false,
      showCustomer: true,
      customerRequired: false,
      showPayment: true,
      showReceipt: true,
    })
  })

  it('hides platform for client and other (CRM-only)', () => {
    expect(resolveDriverCommercialFieldVisibility('client')).toEqual({
      showPlatform: false,
      showCustomer: true,
      customerRequired: true,
      showPayment: true,
      showReceipt: true,
    })
    expect(resolveDriverCommercialFieldVisibility('other')).toEqual({
      showPlatform: false,
      showCustomer: true,
      customerRequired: true,
      showPayment: true,
      showReceipt: true,
    })
  })
})
