import {
  buildEventDescription,
  resolveTripFinalPriceLabel,
} from '../tripGoogleCalendarDescription'
import type { TaxiFleetTrip } from '../../../data/entities'

function tripStub(partial: Partial<TaxiFleetTrip> & { id: string }): TaxiFleetTrip {
  return {
    tripType: 'client',
    status: 'scheduled',
    currencyCode: 'PLN',
    revenueAmount: null,
    notes: null,
    metadata: null,
    teamMemberId: null,
    ...partial,
  } as TaxiFleetTrip
}

describe('trip Google Calendar description', () => {
  test('includes driver and final revenue price', () => {
    const description = buildEventDescription(
      tripStub({
        id: '11111111-1111-4111-8111-111111111111',
        revenueAmount: '150.00',
        currencyCode: 'PLN',
      }),
      { driverName: 'Jan Kowalski' },
    )
    expect(description).toContain('Driver: Jan Kowalski')
    expect(description).toContain('Price:')
    expect(description).toMatch(/150[,.]00/)
  })

  test('falls back to quote snapshot total when revenue is empty', () => {
    expect(
      resolveTripFinalPriceLabel({
        revenueAmount: null,
        currencyCode: 'PLN',
        metadata: { quoteSnapshot: { totalPrice: 210 } },
      }),
    ).toMatch(/210[,.]00/)
  })

  test('falls back to request basePrice when quote missing', () => {
    expect(
      resolveTripFinalPriceLabel({
        revenueAmount: null,
        currencyCode: 'PLN',
        metadata: { tripRequest: { basePrice: '89.50' } },
      }),
    ).toMatch(/89[,.]50/)
  })

  test('shows placeholders when driver/price missing', () => {
    const description = buildEventDescription(
      tripStub({ id: '22222222-2222-4222-8222-222222222222' }),
      { driverName: null },
    )
    expect(description).toContain('Driver: —')
    expect(description).toContain('Price: —')
  })
})
