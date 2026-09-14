import {
  parseTripRequestRevenueAmount,
  tripRequestDetailsFromMetadata,
  type TripRequestDetails,
} from '../tripRequestForm'

describe('tripRequestDetailsFromMetadata — basePrice', () => {
  it('does not fall back basePrice to revenueAmount', () => {
    const details = tripRequestDetailsFromMetadata(
      {
        tripRequest: {
          serviceType: 'airport',
          fromAddress: 'A',
          toAddress: 'B',
          passengers: 2,
        },
      },
      { revenueAmount: '147', distanceKm: '15' },
    )
    expect(details.basePrice).toBe('')
  })

  it('keeps explicit basePrice from tripRequest metadata', () => {
    const details = tripRequestDetailsFromMetadata({
      tripRequest: {
        serviceType: 'local',
        fromAddress: 'A',
        toAddress: 'B',
        passengers: 1,
        basePrice: '105',
      },
    })
    expect(details.basePrice).toBe('105')
  })
})

describe('parseTripRequestRevenueAmount', () => {
  const details: TripRequestDetails = {
    serviceType: 'airport',
    fromAddress: '',
    toAddress: '',
    waypointAddresses: '',
    distanceKm: '15',
    durationText: '',
    passengers: '2',
    handLuggage: '0',
    holdLuggage: '0',
    childSeats: '0',
    boosterSeats: '0',
    isAirportPickup: false,
    flightNumber: '',
    meetAndGreet: false,
    englishSpeakingDriver: false,
    paymentType: 'cash',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    contactType: 'private',
    companyName: '',
    companyTaxId: '',
    vehicleCategory: 'standard',
    basePrice: '105',
    referringPartnerEntityId: '',
  }

  it('parses revenueAmount when present', () => {
    expect(parseTripRequestRevenueAmount(details, '147')).toBe(147)
  })

  it('does not fall back to basePrice when revenue is empty', () => {
    expect(parseTripRequestRevenueAmount(details, '')).toBeUndefined()
    expect(parseTripRequestRevenueAmount(details, '   ')).toBeUndefined()
  })
})
