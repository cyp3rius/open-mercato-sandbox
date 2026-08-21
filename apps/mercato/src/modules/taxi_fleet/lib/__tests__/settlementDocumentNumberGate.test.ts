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

  it('exposes gate function', () => {
    expect(typeof assertWeeklySettlementDocumentNumbersComplete).toBe('function')
  })
})
