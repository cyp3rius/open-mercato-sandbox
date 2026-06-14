import {
  generateRuleId,
  getEntityTypeSuggestions,
  getEventTypeSuggestions,
  getLifecycleEventVerbSuggestions,
  mergeEventTypeSuggestions,
} from '../formHelpers'

describe('formHelpers', () => {
  describe('generateRuleId', () => {
    it('should convert rule name to uppercase ID with underscores', () => {
      expect(generateRuleId('Customer Validation Rule')).toBe('CUSTOMER_VALIDATION_RULE')
    })

    it('should remove special characters', () => {
      expect(generateRuleId('Order! #123 @ Rule')).toBe('ORDER_123_RULE')
    })

    it('should trim leading and trailing underscores', () => {
      expect(generateRuleId('  Test Rule  ')).toBe('TEST_RULE')
    })

    it('should limit length to 50 characters', () => {
      const longName = 'A'.repeat(100)
      const result = generateRuleId(longName)
      expect(result.length).toBeLessThanOrEqual(50)
    })

    it('should handle empty string', () => {
      expect(generateRuleId('')).toBe('')
    })
  })

  describe('getEntityTypeSuggestions', () => {
    it('should return array of entity type suggestions', () => {
      const suggestions = getEntityTypeSuggestions()
      expect(Array.isArray(suggestions)).toBe(true)
      expect(suggestions.length).toBeGreaterThan(0)
    })

    it('should include Open Mercato registry entity IDs', () => {
      const suggestions = getEntityTypeSuggestions()
      expect(suggestions).toContain('insurance:insurance_policy')
      expect(suggestions).toContain('cases:service_case')
      expect(suggestions).toContain('playbooks:playbook')
      expect(suggestions.some((id) => id.startsWith('procurement:'))).toBe(true)
    })
  })

  describe('getEventTypeSuggestions', () => {
    it('should return array of event type suggestions', () => {
      const suggestions = getEventTypeSuggestions()
      expect(Array.isArray(suggestions)).toBe(true)
      expect(suggestions.length).toBeGreaterThan(0)
    })

    it('should include common lifecycle events', () => {
      const suggestions = getLifecycleEventVerbSuggestions()
      expect(suggestions).toContain('beforeCreate')
      expect(suggestions).toContain('afterCreate')
      expect(suggestions).toContain('beforeUpdate')
      expect(suggestions).toContain('afterUpdate')
      expect(suggestions).toContain('onStatusChange')
    })

    it('should merge domain event IDs with lifecycle verbs', () => {
      const merged = mergeEventTypeSuggestions(['insurance.policy.updated', 'cases.case.created'])
      expect(merged).toContain('insurance.policy.updated')
      expect(merged).toContain('cases.case.created')
      expect(merged).toContain('beforeCreate')
    })

    it('should accept optional entityType parameter', () => {
      const suggestions = getEventTypeSuggestions('Order')
      expect(Array.isArray(suggestions)).toBe(true)
    })
  })
})
