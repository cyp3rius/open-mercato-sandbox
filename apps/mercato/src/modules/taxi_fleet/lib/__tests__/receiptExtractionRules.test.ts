import {
  buildReceiptExtractionMerge,
  mergeReceiptDocumentNumber,
  settlementMissingDocumentNumberTripIds,
  shouldAutoApplyHighConfidenceOcr,
} from '../receiptExtractionRules'
import { mergeReceiptTripDistance } from '../receiptTripDistanceApply'

describe('receiptExtractionRules', () => {
  it('fills empty driver document number from OCR', () => {
    const result = mergeReceiptDocumentNumber({
      driverDocumentNumber: '',
      ocrDocumentNumber: 'ABC/123',
    })
    expect(result.documentNumber).toBe('ABC/123')
    expect(result.documentNumberSource).toBe('ocr')
    expect(result.needsReview).toBe(false)
  })

  it('keeps driver value and flags conflict when OCR differs below high-confidence threshold', () => {
    const result = buildReceiptExtractionMerge({
      driverDocumentNumber: 'FV/1',
      ocrDocumentNumber: 'FV/2',
      confidence: 0.7,
    })
    expect(result.documentNumber).toBe('FV/1')
    expect(result.documentNumberSource).toBe('conflict')
    expect(result.needsReview).toBe(true)
    expect(result.warnings.some((w) => w.code === 'field_conflict')).toBe(true)
  })

  it('prefers OCR values and clears conflict warnings at high confidence', () => {
    const result = buildReceiptExtractionMerge({
      driverDocumentNumber: 'FV/1',
      ocrDocumentNumber: 'FV/2',
      driverAmount: 100,
      ocrGrossAmount: 120,
      tripRevenueAmount: 100,
      confidence: 0.85,
    })
    expect(result.documentNumber).toBe('FV/2')
    expect(result.documentNumberSource).toBe('ocr')
    expect(result.needsReview).toBe(false)
    expect(result.warnings.some((w) => w.code === 'field_conflict')).toBe(false)
    expect(result.warnings.some((w) => w.code === 'amount_mismatch_trip')).toBe(false)
  })

  it('does not auto-prefer OCR when preferOcrOnConflict is false even at high confidence', () => {
    const result = buildReceiptExtractionMerge({
      driverDocumentNumber: 'FV/1',
      ocrDocumentNumber: 'FV/2',
      confidence: 0.95,
      preferOcrOnConflict: false,
    })
    expect(result.documentNumber).toBe('FV/1')
    expect(result.documentNumberSource).toBe('conflict')
    expect(result.needsReview).toBe(true)
  })

  it('treats normalized document numbers as equal', () => {
    const result = mergeReceiptDocumentNumber({
      driverDocumentNumber: 'abc-123',
      ocrDocumentNumber: 'ABC 123',
    })
    expect(result.documentNumberSource).toBe('driver')
    expect(result.needsReview).toBe(false)
  })

  it('warns when OCR amount mismatches trip revenue without forcing review alone', () => {
    const result = buildReceiptExtractionMerge({
      ocrDocumentNumber: 'X1',
      ocrGrossAmount: 100,
      tripRevenueAmount: 120,
      confidence: 0.7,
    })
    expect(result.needsReview).toBe(false)
    expect(result.warnings.some((w) => w.code === 'amount_mismatch_trip')).toBe(true)
  })

  it('blocks high-confidence auto-apply for Polcard / non-receipt warnings', () => {
    expect(
      shouldAutoApplyHighConfidenceOcr({
        confidence: 0.95,
        warnings: [{ code: 'polcard_payment_confirmation' }],
      }),
    ).toBe(false)
    expect(
      shouldAutoApplyHighConfidenceOcr({
        confidence: 0.95,
        isNonReceipt: true,
      }),
    ).toBe(false)
    expect(shouldAutoApplyHighConfidenceOcr({ confidence: 0.85 })).toBe(true)
    expect(shouldAutoApplyHighConfidenceOcr({ confidence: 0.849 })).toBe(false)
  })

  it('lists trips missing document numbers for settlement gate', () => {
    const missing = settlementMissingDocumentNumberTripIds({
      requiredTripIds: ['t1', 't2', 't3'],
      incomeEntries: [
        { tripId: 't1', documentNumber: 'A' },
        { tripId: 't2', documentNumber: '  ' },
      ],
    })
    expect(missing).toEqual(['t2', 't3'])
  })
})

describe('mergeReceiptTripDistance high confidence', () => {
  it('suppresses mismatch warning when requested', () => {
    const result = mergeReceiptTripDistance({
      tripDistanceKm: '10.00',
      ocrDistanceKm: 12.5,
      suppressMismatchWarning: true,
    })
    expect(result.applied).toBe(true)
    expect(result.corrected).toBe(true)
    expect(result.distanceKm).toBe('12.50')
    expect(result.warnings).toEqual([])
  })
})
