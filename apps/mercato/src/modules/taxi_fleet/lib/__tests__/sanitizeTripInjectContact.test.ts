import { resolveTripInjectNip, sanitizeTripInjectNip, sanitizeTripInjectPhone } from '../sanitizeTripInjectContact'

describe('sanitizeTripInjectPhone', () => {
  it('adds +48 for Polish national mobiles', () => {
    expect(sanitizeTripInjectPhone('601222222')).toBe('+48601222222')
    expect(sanitizeTripInjectPhone('601 222 222')).toBe('+48601222222')
  })

  it('keeps already-valid international numbers', () => {
    expect(sanitizeTripInjectPhone('+48601222222')).toBe('+48601222222')
  })

  it('returns null for empty or unusable values', () => {
    expect(sanitizeTripInjectPhone('')).toBeNull()
    expect(sanitizeTripInjectPhone('123')).toBeNull()
  })
})

describe('resolveTripInjectNip', () => {
  it('treats blank as empty (optional)', () => {
    expect(resolveTripInjectNip('')).toEqual({ status: 'empty', nip: null })
    expect(resolveTripInjectNip('   ')).toEqual({ status: 'empty', nip: null })
    expect(resolveTripInjectNip(null)).toEqual({ status: 'empty', nip: null })
  })

  it('accepts a valid checksum NIP', () => {
    expect(resolveTripInjectNip('1000000006')).toEqual({ status: 'valid', nip: '1000000006' })
    expect(resolveTripInjectNip('100-000-00-06')).toEqual({ status: 'valid', nip: '1000000006' })
  })

  it('marks provided but invalid values as invalid', () => {
    expect(resolveTripInjectNip('1234567890')).toEqual({ status: 'invalid', nip: null })
    expect(resolveTripInjectNip('123')).toEqual({ status: 'invalid', nip: null })
  })
})

describe('sanitizeTripInjectNip', () => {
  it('returns digits only for valid NIP', () => {
    expect(sanitizeTripInjectNip('100-000-00-06')).toBe('1000000006')
  })

  it('returns null for empty or invalid', () => {
    expect(sanitizeTripInjectNip('')).toBeNull()
    expect(sanitizeTripInjectNip('1234567890')).toBeNull()
  })
})
