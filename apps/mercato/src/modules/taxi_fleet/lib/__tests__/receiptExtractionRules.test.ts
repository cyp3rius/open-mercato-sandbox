import {
  buildReceiptExtractionMerge,
  mergeReceiptDocumentNumber,
  settlementMissingDocumentNumberTripIds,
} from '../receiptExtractionRules'

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

  it('keeps driver value and flags conflict when OCR differs', () => {
    const result = buildReceiptExtractionMerge({
      driverDocumentNumber: 'FV/1',
      ocrDocumentNumber: 'FV/2',
      confidence: 0.9,
    })
    expect(result.documentNumber).toBe('FV/1')
    expect(result.documentNumberSource).toBe('conflict')
    expect(result.needsReview).toBe(true)
    expect(result.warnings.some((w) => w.code === 'field_conflict')).toBe(true)
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
      confidence: 0.9,
    })
    expect(result.needsReview).toBe(false)
    expect(result.warnings.some((w) => w.code === 'amount_mismatch_trip')).toBe(true)
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
