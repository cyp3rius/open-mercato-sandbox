import { tripFormValuesFromDuplicateSource } from '../tripDuplicatePrefill'

describe('tripFormValuesFromDuplicateSource', () => {
  it('keeps route, customer, driver and vehicle but clears excluded fields', () => {
    const source = {
      teamMemberId: 'driver-1',
      resourceId: 'vehicle-1',
      customerEntityId: 'customer-1',
      orderingPersonId: 'ordering-1',
      tripType: 'client',
      platform: 'bolt',
      startedAtLocal: '2026-03-10T10:00',
      endedAtLocal: '2026-03-10T11:00',
      revenueAmount: '150.00',
      notes: 'VIP',
      status: 'completed',
      fromLon: '21.0',
      fromLat: '52.2',
      toLon: '21.1',
      toLat: '52.3',
      routeWaypointMeta: '',
      quoteSnapshotJson: '{"totalPrice":150}',
      routeDurationSeconds: '3600',
      routeSyncedFingerprint: 'fp',
      endedAtManual: '1',
      receiptDocumentNumber: 'PAR/1',
      receiptAttachmentId: 'att-1',
      serviceType: 'airport',
      fromAddress: 'A',
      toAddress: 'B',
      waypointAddresses: '',
      distanceKm: '15',
      durationText: '45 min',
      passengers: '2',
      handLuggage: '1',
      holdLuggage: '1',
      childSeats: '0',
      boosterSeats: '0',
      isAirportPickup: true,
      flightNumber: 'LO123',
      meetAndGreet: true,
      englishSpeakingDriver: false,
      paymentType: 'cash',
      contactName: 'Ada',
      contactPhone: '500100200',
      contactEmail: '',
      contactType: 'private',
      companyName: '',
      companyTaxId: '',
      vehicleCategory: 'standard',
      basePrice: '120',
      referringPartnerEntityId: '',
    }

    const next = tripFormValuesFromDuplicateSource(source as never, { defaultStatus: 'scheduled' })
    expect(next.customerEntityId).toBe('customer-1')
    expect(next.orderingPersonId).toBe('ordering-1')
    expect(next.fromAddress).toBe('A')
    expect(next.toAddress).toBe('B')
    expect(next.distanceKm).toBe('15')
    expect(next.flightNumber).toBe('LO123')
    expect(next.notes).toBe('VIP')
    expect(next.platform).toBe('bolt')
    expect(next.teamMemberId).toBe('driver-1')
    expect(next.resourceId).toBe('vehicle-1')

    expect(next.status).toBe('scheduled')
    expect(next.revenueAmount).toBe('')
    expect(next.basePrice).toBe('')
    expect(next.quoteSnapshotJson).toBe('')
    expect(next.receiptDocumentNumber).toBe('')
    expect(next.receiptAttachmentId).toBe('')
    expect(next.endedAtManual).toBe('0')
    expect(next.startedAtLocal).not.toBe('2026-03-10T10:00')
    expect(next.endedAtLocal).not.toBe('2026-03-10T11:00')
  })
})
