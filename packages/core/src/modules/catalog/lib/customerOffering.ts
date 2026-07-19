import type { CatalogOfferingKind, CatalogProductCaseTemplate } from '../data/types'

export const CATALOG_CUSTOMER_OFFERING_STATUSES = [
  'pending',
  'active',
  'ended',
  'cancelled',
] as const

export type CatalogCustomerOfferingStatus = (typeof CATALOG_CUSTOMER_OFFERING_STATUSES)[number]

export function shouldActivateOfferingNow(input: {
  offeringKind: CatalogOfferingKind
  startsAt: Date | null | undefined
  now?: Date
}): boolean {
  const now = input.now ?? new Date()
  if (input.offeringKind !== 'subscription') return true
  if (!input.startsAt) return false
  return input.startsAt.getTime() <= now.getTime()
}

export function isRecurrenceOccurrenceWithinSubscription(input: {
  nextOccurrenceAt: Date
  endsAt: Date | null | undefined
}): boolean {
  if (!input.endsAt) return true
  return input.nextOccurrenceAt.getTime() <= input.endsAt.getTime()
}

export function resolveRecurrenceSeriesEndsAt(
  metadata: Record<string, unknown> | null | undefined,
): Date | null {
  if (!metadata || typeof metadata !== 'object') return null
  const raw = metadata.recurrenceSeriesEndsAt
  if (typeof raw !== 'string' || !raw.trim()) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function resolveCustomerOfferingIdFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  if (!metadata || typeof metadata !== 'object') return null
  const raw = metadata.customerOfferingId
  return typeof raw === 'string' && raw.trim().length ? raw.trim() : null
}

export function cloneCaseTemplatesSnapshot(
  templates: CatalogProductCaseTemplate[] | null | undefined,
): CatalogProductCaseTemplate[] {
  if (!Array.isArray(templates)) return []
  return templates.map((template) => ({
    id: template.id,
    title: template.title,
    playbookId: template.playbookId ?? null,
    recurrenceEnabled: Boolean(template.recurrenceEnabled),
    recurrenceIntervalAmount: template.recurrenceIntervalAmount ?? null,
    recurrenceIntervalUnit: template.recurrenceIntervalUnit ?? null,
    recurrenceCreateLeadTime: template.recurrenceCreateLeadTime ?? null,
  }))
}
