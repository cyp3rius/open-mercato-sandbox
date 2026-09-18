import { receiptExtractionHasDismissibleIssues } from '../receiptExtractionRules'

describe('receiptExtractionHasDismissibleIssues', () => {
  it('is false while OCR is still running', () => {
    expect(
      receiptExtractionHasDismissibleIssues({
        status: 'pending',
        warningsJson: [{ code: 'low_confidence' }],
        errorMessage: 'x',
      }),
    ).toBe(false)
    expect(
      receiptExtractionHasDismissibleIssues({
        status: 'processing',
        warningsJson: [{ code: 'low_confidence' }],
      }),
    ).toBe(false)
  })

  it('is true for needs_review / failed even without warning rows', () => {
    expect(receiptExtractionHasDismissibleIssues({ status: 'needs_review' })).toBe(true)
    expect(receiptExtractionHasDismissibleIssues({ status: 'failed' })).toBe(true)
  })

  it('is true when warnings or error message remain on extracted/applied', () => {
    expect(
      receiptExtractionHasDismissibleIssues({
        status: 'extracted',
        warningsJson: [{ code: 'amount_mismatch_trip' }],
      }),
    ).toBe(true)
    expect(
      receiptExtractionHasDismissibleIssues({
        status: 'applied',
        errorMessage: 'Something went wrong',
      }),
    ).toBe(true)
  })

  it('is false when the receipt is clean', () => {
    expect(
      receiptExtractionHasDismissibleIssues({
        status: 'applied',
        warningsJson: [],
        errorMessage: null,
      }),
    ).toBe(false)
    expect(
      receiptExtractionHasDismissibleIssues({
        status: 'extracted',
        warningsJson: null,
        errorMessage: '   ',
      }),
    ).toBe(false)
  })
})
