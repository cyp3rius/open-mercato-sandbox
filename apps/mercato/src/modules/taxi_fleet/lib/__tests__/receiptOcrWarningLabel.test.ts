import { formatReceiptOcrWarningLabel } from '../receiptOcrWarningLabel'

function t(key: string, fallback?: string, params?: Record<string, string | number>): string {
  let out = fallback ?? key
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      out = out.replaceAll(`{${name}}`, String(value))
    }
  }
  return out
}

describe('formatReceiptOcrWarningLabel', () => {
  it('shows field, OCR and driver values for field_conflict', () => {
    expect(
      formatReceiptOcrWarningLabel(t, {
        code: 'field_conflict',
        field: 'documentNumber',
        ocrValue: '945-218-91-52',
        driverValue: 'W001776',
      }),
    ).toBe('Conflict: documentNumber — OCR: 945-218-91-52, driver: W001776')
  })

  it('does not return bare field_conflict code', () => {
    const label = formatReceiptOcrWarningLabel(t, {
      code: 'field_conflict',
      field: 'amount',
      ocrValue: '150.00',
      driverValue: '140.00',
    })
    expect(label).not.toBe('field_conflict')
    expect(label).toContain('150.00')
    expect(label).toContain('140.00')
  })
})
