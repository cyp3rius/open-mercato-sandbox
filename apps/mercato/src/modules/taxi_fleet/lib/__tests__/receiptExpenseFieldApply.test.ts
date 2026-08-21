import {
  mergeExpenseOccurredAt,
  mergeExpenseVatRate,
  snapExpenseOccurredAtToDriverShift,
} from '../receiptExpenseFieldApply'

describe('receiptExpenseFieldApply', () => {
  it('keeps driver time and replaces only the OCR date', () => {
    const result = mergeExpenseOccurredAt({
      driverOccurredAt: '2026-08-21T14:30:00.000Z',
      ocrOccurredAt: '2026-08-10T09:00:00.000Z',
    })
    expect(result.dateSource).toBe('ocr')
    expect(result.timeSource).toBe('driver')
    expect(result.occurredAt).not.toBeNull()
    const merged = result.occurredAt!
    const driver = new Date('2026-08-21T14:30:00.000Z')
    const ocr = new Date('2026-08-10T09:00:00.000Z')
    expect(merged.getFullYear()).toBe(ocr.getFullYear())
    expect(merged.getMonth()).toBe(ocr.getMonth())
    expect(merged.getDate()).toBe(ocr.getDate())
    expect(merged.getHours()).toBe(driver.getHours())
    expect(merged.getMinutes()).toBe(driver.getMinutes())
  })

  it('uses OCR datetime when driver value is missing', () => {
    const result = mergeExpenseOccurredAt({
      driverOccurredAt: null,
      ocrOccurredAt: '2026-08-10T09:15:00.000Z',
    })
    expect(result.dateSource).toBe('ocr')
    expect(result.timeSource).toBe('ocr')
    expect(result.occurredAt?.toISOString()).toBe('2026-08-10T09:15:00.000Z')
  })

  it('does not snap when already inside a shift window', () => {
    const occurredAt = new Date('2026-08-11T10:00:00.000Z')
    const result = snapExpenseOccurredAtToDriverShift({
      occurredAt,
      assignments: [
        {
          id: 'a1',
          resourceId: 'r1',
          shiftStart: new Date('2026-08-11T08:00:00.000Z'),
          shiftEnd: new Date('2026-08-11T16:00:00.000Z'),
        },
      ],
      now: new Date('2026-08-12T12:00:00.000Z'),
    })
    expect(result.snappedToShift).toBe(false)
    expect(result.occurredAt.toISOString()).toBe(occurredAt.toISOString())
    expect(result.assignmentId).toBe('a1')
  })

  it('snaps to mid-shift when outside all windows', () => {
    const result = snapExpenseOccurredAtToDriverShift({
      occurredAt: new Date('2026-08-11T02:00:00.000Z'),
      assignments: [
        {
          id: 'a1',
          resourceId: 'r1',
          shiftStart: new Date('2026-08-11T08:00:00.000Z'),
          shiftEnd: new Date('2026-08-11T16:00:00.000Z'),
        },
      ],
      now: new Date('2026-08-12T12:00:00.000Z'),
    })
    expect(result.snappedToShift).toBe(true)
    expect(result.assignmentId).toBe('a1')
    expect(result.occurredAt.toISOString()).toBe('2026-08-11T12:00:00.000Z')
  })

  it('keeps OCR calendar day when no shift exists that day', () => {
    const ocrDate = new Date('2026-07-17T00:00:00.000Z')
    const result = snapExpenseOccurredAtToDriverShift({
      occurredAt: ocrDate,
      keepCalendarDay: true,
      assignments: [
        {
          id: 'a1',
          resourceId: 'r1',
          shiftStart: new Date('2026-08-21T08:00:00.000Z'),
          shiftEnd: new Date('2026-08-21T16:00:00.000Z'),
        },
      ],
      now: new Date('2026-08-21T12:00:00.000Z'),
    })
    expect(result.snappedToShift).toBe(false)
    expect(result.occurredAt.toISOString()).toBe(ocrDate.toISOString())
  })

  it('applies OCR VAT and marks correction when driver differs', () => {
    const result = mergeExpenseVatRate({
      driverVatRatePercent: 23,
      ocrVatRatePercent: 8,
    })
    expect(result.vatRatePercent).toBe(8)
    expect(result.source).toBe('ocr')
    expect(result.corrected).toBe(true)
  })

  it('keeps driver VAT when OCR has none', () => {
    const result = mergeExpenseVatRate({
      driverVatRatePercent: 8,
      ocrVatRatePercent: null,
    })
    expect(result.vatRatePercent).toBe(8)
    expect(result.source).toBe('driver')
    expect(result.corrected).toBe(false)
  })
})
