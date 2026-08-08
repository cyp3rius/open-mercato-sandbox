import {
  formatPercentDisplay,
  formatPercentInputValue,
  parseNumericValue,
  sanitizePercentTypingInput,
} from '@open-mercato/shared/lib/numeric'

describe('numeric formatting', () => {
  describe('parseNumericValue', () => {
    it('parses comma decimals', () => {
      expect(parseNumericValue('12,5')).toBe(12.5)
    })

    it('returns null for empty input', () => {
      expect(parseNumericValue('')).toBeNull()
    })
  })

  describe('formatPercentInputValue', () => {
    it('normalizes stored decimals for edit controls', () => {
      expect(formatPercentInputValue('50.00')).toBe('50')
      expect(formatPercentInputValue('12.50')).toBe('12.5')
    })

    it('clamps to percent range', () => {
      expect(formatPercentInputValue('150')).toBe('100')
      expect(formatPercentInputValue('-5')).toBe('0')
    })
  })

  describe('formatPercentDisplay', () => {
    it('formats stored 0-100 scale as locale percent', () => {
      expect(formatPercentDisplay(50, 'en-US')).toBe('50%')
      expect(formatPercentDisplay('12.5', 'en-US')).toBe('12.5%')
    })
  })

  describe('sanitizePercentTypingInput', () => {
    it('limits fraction digits while typing', () => {
      expect(sanitizePercentTypingInput('12.345')).toBe('12.34')
    })
  })
})
