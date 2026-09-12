import {
  driverExpenseCanDelete,
  expenseHasWarnings,
  isExpenseOcrProcessing,
  isExpenseOcrVerified,
  parseDriverExpenseWarnings,
} from '../driverExpenses'

describe('driverExpenses helpers', () => {
  it('parses known OCR warning codes', () => {
    expect(
      parseDriverExpenseWarnings([
        { code: 'document_duplicate' },
        { code: 'unknown_code' },
        { code: 'field_conflict', field: 'amount' },
      ]),
    ).toEqual([
      { code: 'document_duplicate', field: null, message: null, driverValue: null, ocrValue: null },
      { code: 'field_conflict', field: 'amount', message: null, driverValue: null, ocrValue: null },
    ])
  })

  it('allows delete only for duplicates or warned / review entries', () => {
    expect(driverExpenseCanDelete({ isDocumentDuplicate: true })).toBe(true)
    expect(driverExpenseCanDelete({ warnings: [{ code: 'field_conflict' }] })).toBe(true)
    expect(driverExpenseCanDelete({ ocrStatus: 'needs_review' })).toBe(true)
    expect(driverExpenseCanDelete({ ocrStatus: 'failed' })).toBe(true)
    expect(driverExpenseCanDelete({ ocrStatus: 'applied', warnings: [] })).toBe(false)
  })

  it('derives OCR badge states for settlement and driver lists', () => {
    expect(
      isExpenseOcrVerified({
        amount: '10.00',
        receiptAttachmentId: 'att-1',
        ocrStatus: 'applied',
        warnings: [],
      }),
    ).toBe(true)
    expect(
      isExpenseOcrProcessing({
        amount: '0.00',
        receiptAttachmentId: 'att-1',
        ocrStatus: null,
        warnings: [],
      }),
    ).toBe(true)
    expect(
      expenseHasWarnings({
        amount: '10.00',
        receiptAttachmentId: 'att-1',
        ocrStatus: 'failed',
        warnings: [],
      }),
    ).toBe(true)
  })
})
