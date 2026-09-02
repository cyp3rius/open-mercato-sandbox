import { normalizeDateOnly, formatWeekRange } from '../weekUtils'

describe('normalizeDateOnly', () => {
  it('passes through YYYY-MM-DD', () => {
    expect(normalizeDateOnly('2026-08-17')).toBe('2026-08-17')
  })

  it('fixes PG date timezone shift for Warsaw', () => {
    expect(normalizeDateOnly('2026-08-16T22:00:00.000Z')).toBe('2026-08-17')
    expect(normalizeDateOnly(new Date('2026-08-16T22:00:00.000Z'))).toBe('2026-08-17')
  })

  it('returns empty for invalid values', () => {
    expect(normalizeDateOnly(null)).toBe('')
    expect(normalizeDateOnly('')).toBe('')
    expect(normalizeDateOnly('not-a-date')).toBe('')
  })
})

describe('formatWeekRange', () => {
  it('formats normalized week starts', () => {
    expect(formatWeekRange('2026-08-17')).toBe('2026-08-17 – 2026-08-23')
    expect(formatWeekRange('2026-08-16T22:00:00.000Z')).toBe('2026-08-17 – 2026-08-23')
  })
})
