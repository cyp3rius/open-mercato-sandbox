import type { BusinessRuleFormValues } from '../formConfig'
import type { CreateBusinessRuleInput } from '../../data/validators'
import { collectRegisteredEntityTypeIds } from '../../lib/registryEntityIds'

/**
 * Convert form values to API payload
 */
export function buildRulePayload(
  formValues: BusinessRuleFormValues,
  tenantId: string,
  organizationId: string,
  createdBy?: string
): CreateBusinessRuleInput {
  return {
    ruleId: formValues.ruleId,
    ruleName: formValues.ruleName,
    description: formValues.description || null,
    ruleType: formValues.ruleType,
    ruleCategory: formValues.ruleCategory || null,
    entityType: formValues.entityType,
    eventType: formValues.eventType || null,
    conditionExpression: formValues.conditionExpression,
    successActions: formValues.successActions || null,
    failureActions: formValues.failureActions || null,
    enabled: formValues.enabled,
    priority: formValues.priority,
    version: formValues.version,
    effectiveFrom: formValues.effectiveFrom || null,
    effectiveTo: formValues.effectiveTo || null,
    tenantId,
    organizationId,
    createdBy: createdBy || null,
  }
}

/**
 * Convert API rule to form values
 */
export function parseRuleToFormValues(rule: any): BusinessRuleFormValues {
  // Normalize condition expression to GroupCondition format if needed
  let conditionExpression = rule.conditionExpression
  if (conditionExpression && !conditionExpression.operator?.match(/^(AND|OR)$/)) {
    // It's a single condition, wrap it in a group
    conditionExpression = {
      operator: 'AND',
      rules: [conditionExpression]
    }
  }

  return {
    ruleId: rule.ruleId,
    ruleName: rule.ruleName,
    description: rule.description,
    ruleType: rule.ruleType,
    ruleCategory: rule.ruleCategory,
    entityType: rule.entityType,
    eventType: rule.eventType,
    conditionExpression,
    successActions: rule.successActions,
    failureActions: rule.failureActions,
    enabled: rule.enabled,
    priority: rule.priority,
    version: rule.version,
    effectiveFrom: rule.effectiveFrom ? new Date(rule.effectiveFrom) : null,
    effectiveTo: rule.effectiveTo ? new Date(rule.effectiveTo) : null,
  }
}

/**
 * Generate a rule ID from rule name
 */
export function generateRuleId(ruleName: string): string {
  return ruleName
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/(?:^_+|_+$)/g, '')
    .substring(0, 50)
}

/**
 * Entity type suggestions: all registered Open Mercato entity IDs (`module:entity`).
 */
export function getEntityTypeSuggestions(): string[] {
  return collectRegisteredEntityTypeIds()
}

/**
 * Generic lifecycle-style hooks (non-domain); kept for rules that use pseudo-events.
 */
export function getLifecycleEventVerbSuggestions(): string[] {
  return [
    'beforeCreate',
    'afterCreate',
    'beforeUpdate',
    'afterUpdate',
    'beforeDelete',
    'afterDelete',
    'beforeSave',
    'afterSave',
    'onStatusChange',
    'onAssign',
  ]
}

/**
 * Default combobox suggestions before `/api/events` loads (client).
 */
export function getDefaultEventTypeSuggestions(): string[] {
  return getLifecycleEventVerbSuggestions()
}

/**
 * Merge lifecycle verbs with declared domain event IDs (dedupe, sorted).
 */
export function mergeEventTypeSuggestions(domainEventIds: string[]): string[] {
  const merged = new Set<string>([...getLifecycleEventVerbSuggestions(), ...domainEventIds])
  return Array.from(merged).sort((left, right) => left.localeCompare(right))
}

/**
 * @deprecated Prefer `getLifecycleEventVerbSuggestions` or merged API-driven suggestions.
 */
export function getEventTypeSuggestions(_entityType?: string): string[] {
  return getLifecycleEventVerbSuggestions()
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleDateString()
}
