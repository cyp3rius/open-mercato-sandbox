import {
  isTripReceiptProcessing,
  isTripReceiptVerified,
  tripHasReceiptAttachment,
  tripReceiptHasWarnings,
} from '../driverTripReceiptStatus'

describe('driverTripReceiptStatus', () => {
  it('detects receipt attachment from metadata or list extras', () => {
    expect(tripHasReceiptAttachment({ metadata: { receiptAttachmentId: 'att-1' } })).toBe(true)
    expect(tripHasReceiptAttachment({ receiptAttachmentId: 'att-2', metadata: null })).toBe(true)
    expect(tripHasReceiptAttachment({ metadata: null })).toBe(false)
  })

  it('marks missing receipt as not verified', () => {
    expect(isTripReceiptVerified({ receiptAttachmentId: null, ocrStatus: null, warnings: [] })).toBe(
      false,
    )
  })

  it('marks pending OCR as processing', () => {
    expect(
      isTripReceiptProcessing({
        receiptAttachmentId: 'att-1',
        ocrStatus: 'pending',
        warnings: [],
      }),
    ).toBe(true)
  })

  it('marks applied OCR without warnings as verified', () => {
    expect(
      isTripReceiptVerified({
        receiptAttachmentId: 'att-1',
        ocrStatus: 'applied',
        warnings: [],
      }),
    ).toBe(true)
  })

  it('does not verify when warnings exist', () => {
    expect(
      isTripReceiptVerified({
        receiptAttachmentId: 'att-1',
        ocrStatus: 'applied',
        warnings: [{ code: 'field_conflict' }],
      }),
    ).toBe(false)
    expect(
      tripReceiptHasWarnings({
        receiptAttachmentId: 'att-1',
        ocrStatus: 'applied',
        warnings: [{ code: 'field_conflict' }],
      }),
    ).toBe(true)
  })
})
