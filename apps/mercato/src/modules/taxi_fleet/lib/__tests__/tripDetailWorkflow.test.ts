import {
  isCompletedTripReceiptSupplementUpdate,
  isTripDetailFieldEditable,
  tripDetailLockMode,
} from '../tripDetailWorkflow'

describe('tripDetailLockMode', () => {
  it('locks completed trips by default', () => {
    expect(tripDetailLockMode('completed')).toBe('full')
    expect(isTripDetailFieldEditable('completed', 'revenueAmount')).toBe(false)
  })

  it('unlocks completed trips when allowEditCompleted is set', () => {
    expect(tripDetailLockMode('completed', { allowEditCompleted: true })).toBe('none')
    expect(
      isTripDetailFieldEditable('completed', 'revenueAmount', { allowEditCompleted: true }),
    ).toBe(true)
  })

  it('keeps cancelled trips locked even with allowEditCompleted', () => {
    expect(tripDetailLockMode('cancelled', { allowEditCompleted: true })).toBe('full')
  })
})

describe('isCompletedTripReceiptSupplementUpdate', () => {
  it('allows metadata-only receipt attach on completed trips without a receipt', () => {
    expect(
      isCompletedTripReceiptSupplementUpdate('completed', false, {
        id: 'trip-1',
        metadata: { receiptAttachmentId: 'att-1', receiptDocumentNumber: 'FV/1' },
      }),
    ).toBe(true)
  })

  it('rejects when a receipt is already attached', () => {
    expect(
      isCompletedTripReceiptSupplementUpdate('completed', true, {
        id: 'trip-1',
        metadata: { receiptAttachmentId: 'att-1' },
      }),
    ).toBe(false)
  })

  it('rejects when other trip fields are also updated', () => {
    expect(
      isCompletedTripReceiptSupplementUpdate('completed', false, {
        id: 'trip-1',
        revenueAmount: 100,
        metadata: { receiptAttachmentId: 'att-1' },
      }),
    ).toBe(false)
  })

  it('rejects cancelled trips', () => {
    expect(
      isCompletedTripReceiptSupplementUpdate('cancelled', false, {
        id: 'trip-1',
        metadata: { receiptAttachmentId: 'att-1' },
      }),
    ).toBe(false)
  })
})
