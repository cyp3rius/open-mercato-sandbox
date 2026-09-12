import {
  financialEntriesAreDocumentDuplicates,
  normalizeDocumentDuplicateNumber,
} from '../documentDuplicates'

describe('documentDuplicates', () => {
  it('normalizes document numbers', () => {
    expect(normalizeDocumentDuplicateNumber('FV/2/07/2026')).toBe('FV2072026')
    expect(normalizeDocumentDuplicateNumber(' fv-2.07.2026 ')).toBe('FV2072026')
  })

  it('matches by number + nip even when dates differ', () => {
    expect(
      financialEntriesAreDocumentDuplicates(
        {
          documentNumber: 'FV/2/07/2026',
          occurredAt: '2026-08-21T12:00:00.000Z',
          documentNip: '5641754907',
        },
        {
          documentNumber: 'FV 2 07 2026',
          occurredAt: '2026-07-17T00:00:00.000Z',
          documentNip: '564-175-49-07',
        },
      ),
    ).toBe(true)
  })

  it('requires same date when nip is missing', () => {
    expect(
      financialEntriesAreDocumentDuplicates(
        {
          documentNumber: 'FV/2/07/2026',
          occurredAt: '2026-08-21T12:00:00.000Z',
          documentNip: null,
        },
        {
          documentNumber: 'FV/2/07/2026',
          occurredAt: '2026-07-17T00:00:00.000Z',
          documentNip: null,
        },
      ),
    ).toBe(false)
  })

  it('matches by number when only one side has nip', () => {
    expect(
      financialEntriesAreDocumentDuplicates(
        {
          documentNumber: 'FV/2/07/2026',
          occurredAt: '2026-08-21T12:00:00.000Z',
          documentNip: '5641754907',
        },
        {
          documentNumber: 'FV/2/07/2026',
          occurredAt: '2026-07-17T00:00:00.000Z',
          documentNip: null,
        },
      ),
    ).toBe(true)
  })
})
