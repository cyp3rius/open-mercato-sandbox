import {
  clearCustomerNipConflictWarnings,
  decideTripCustomerOcrLink,
  upsertCustomerNipConflictWarning,
} from '../receiptTripCustomerOcr'

describe('decideTripCustomerOcrLink', () => {
  it('conflicts when trip has a person and OCR has a buyer NIP', () => {
    expect(
      decideTripCustomerOcrLink({
        ocrBuyerNip: '6762566967',
        resolvedCompanyId: 'company-from-ocr',
        tripCustomerPersonId: 'person-1',
        tripCustomerCompanyId: null,
        linkedCompanyNip: null,
        preferOcrOnConflict: false,
      }),
    ).toEqual({
      action: 'conflict',
      ocrBuyerNip: '6762566967',
      driverValue: null,
    })
  })

  it('conflicts when linked company NIP differs from OCR', () => {
    expect(
      decideTripCustomerOcrLink({
        ocrBuyerNip: '6762566967',
        resolvedCompanyId: 'company-b',
        tripCustomerPersonId: null,
        tripCustomerCompanyId: 'company-a',
        linkedCompanyNip: '5252344028',
        preferOcrOnConflict: false,
      }),
    ).toEqual({
      action: 'conflict',
      ocrBuyerNip: '6762566967',
      driverValue: '5252344028',
    })
  })

  it('conflicts when person is linked even if MF lookup failed (no resolved company)', () => {
    expect(
      decideTripCustomerOcrLink({
        ocrBuyerNip: '6762566967',
        resolvedCompanyId: null,
        tripCustomerPersonId: 'person-1',
        tripCustomerCompanyId: null,
        linkedCompanyNip: null,
        preferOcrOnConflict: false,
      }).action,
    ).toBe('conflict')
  })

  it('auto-applies resolved company when trip has no customer', () => {
    expect(
      decideTripCustomerOcrLink({
        ocrBuyerNip: '6762566967',
        resolvedCompanyId: 'company-x',
        tripCustomerPersonId: null,
        tripCustomerCompanyId: null,
        linkedCompanyNip: null,
        preferOcrOnConflict: false,
      }),
    ).toEqual({
      action: 'apply',
      companyEntityId: 'company-x',
      clearPerson: false,
    })
  })

  it('is noop when linked company NIP already matches OCR', () => {
    expect(
      decideTripCustomerOcrLink({
        ocrBuyerNip: '676-256-69-67',
        resolvedCompanyId: null,
        tripCustomerPersonId: null,
        tripCustomerCompanyId: 'company-a',
        linkedCompanyNip: '6762566967',
        preferOcrOnConflict: false,
      }),
    ).toEqual({ action: 'noop' })
  })

  it('applies and clears person when high-confidence prefer OCR is on', () => {
    expect(
      decideTripCustomerOcrLink({
        ocrBuyerNip: '6762566967',
        resolvedCompanyId: 'company-from-ocr',
        tripCustomerPersonId: 'person-1',
        tripCustomerCompanyId: null,
        linkedCompanyNip: null,
        preferOcrOnConflict: true,
      }),
    ).toEqual({
      action: 'apply',
      companyEntityId: 'company-from-ocr',
      clearPerson: true,
    })
  })
})

describe('customer nip conflict warning helpers', () => {
  it('replaces nip_not_found with customer_nip_conflict', () => {
    const next = upsertCustomerNipConflictWarning(
      [
        { code: 'nip_not_found', field: 'buyerNip', ocrValue: '6762566967' },
        { code: 'low_confidence' },
      ],
      { ocrBuyerNip: '6762566967', driverValue: null },
    )
    expect(next.some((w) => w.code === 'nip_not_found')).toBe(false)
    expect(next.find((w) => w.code === 'customer_nip_conflict')).toMatchObject({
      field: 'buyerNip',
      ocrValue: '6762566967',
    })
    expect(next.some((w) => w.code === 'low_confidence')).toBe(true)
  })

  it('clears customer NIP related warnings after apply', () => {
    expect(
      clearCustomerNipConflictWarnings([
        { code: 'customer_nip_conflict', field: 'buyerNip', ocrValue: '1' },
        { code: 'nip_not_found', field: 'buyerNip', ocrValue: '1' },
        { code: 'field_conflict', field: 'amount' },
      ]),
    ).toEqual([{ code: 'field_conflict', field: 'amount' }])
  })
})
