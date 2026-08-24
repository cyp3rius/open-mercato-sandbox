import { settlementMissingDocumentNumberTripIds } from '../receiptExtractionRules'
import { assertWeeklySettlementDocumentNumbersComplete } from '../settlementDocumentNumberGate'

describe('settlementDocumentNumberGate helpers', () => {
  it('flags required trips without document numbers', () => {
    expect(
      settlementMissingDocumentNumberTripIds({
        requiredTripIds: ['a', 'b'],
        incomeEntries: [{ tripId: 'a', documentNumber: 'R1' }],
      }),
    ).toEqual(['b'])
  })

  it('accepts document numbers supplied from trip metadata fallback', () => {
    expect(
      settlementMissingDocumentNumberTripIds({
        requiredTripIds: ['a', 'b'],
        incomeEntries: [
          { tripId: 'a', documentNumber: 'R1' },
          { tripId: 'b', documentNumber: 'FV/9' },
        ],
      }),
    ).toEqual([])
  })

  it('exposes gate function', () => {
    expect(typeof assertWeeklySettlementDocumentNumbersComplete).toBe('function')
  })
})
