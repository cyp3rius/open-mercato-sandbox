import { driverExpenseCanDelete, parseDriverExpenseWarnings } from '../driverExpenses'

describe('driverExpenses helpers', () => {
  it('parses known OCR warning codes', () => {
    expect(
      parseDriverExpenseWarnings([
        { code: 'document_duplicate' },
        { code: 'unknown_code' },
        { code: 'field_conflict', field: 'amount' },
      ]),
    ).toEqual([
      { code: 'document_duplicate', field: null, message: null },
      { code: 'field_conflict', field: 'amount', message: null },
    ])
  })

  it('allows delete only for duplicates or warned / review entries', () => {
    expect(driverExpenseCanDelete({ isDocumentDuplicate: true })).toBe(true)
    expect(driverExpenseCanDelete({ warnings: [{ code: 'field_conflict' }] })).toBe(true)
    expect(driverExpenseCanDelete({ ocrStatus: 'needs_review' })).toBe(true)
    expect(driverExpenseCanDelete({ ocrStatus: 'failed' })).toBe(true)
    expect(driverExpenseCanDelete({ ocrStatus: 'applied', warnings: [] })).toBe(false)
  })
})
