import type { EntityManager } from '@mikro-orm/postgresql'
import {
  CATALOG_SUBSCRIPTION_SERVICE_LINE_CODE,
  type CatalogProductCaseTemplate,
} from '../data/types'
import { CatalogProductServiceLineExtension } from '../data/entities'

export const CATALOG_CUSTOMER_OFFERING_STATUSES = [
  'pending',
  'active',
  'ended',
  'cancelled',
] as const

export type CatalogCustomerOfferingStatus = (typeof CATALOG_CUSTOMER_OFFERING_STATUSES)[number]

export function isSubscriptionServiceLineCode(code: string | null | undefined): boolean {
  return typeof code === 'string' && code.trim().toLowerCase() === CATALOG_SUBSCRIPTION_SERVICE_LINE_CODE
}

export async function resolveProductServiceLineCode(
  em: EntityManager,
  productId: string,
): Promise<string | null> {
  const extension = await em.findOne(
    CatalogProductServiceLineExtension,
    { product: productId },
    { populate: ['serviceLine'] },
  )
  const line = extension?.serviceLine
  if (!line || line.deletedAt) return null
  return typeof line.code === 'string' ? line.code : null
}

export async function isSubscriptionProduct(
  em: EntityManager,
  productId: string,
): Promise<boolean> {
  const code = await resolveProductServiceLineCode(em, productId)
  return isSubscriptionServiceLineCode(code)
}

export function shouldActivateOfferingNow(input: {
  isSubscription: boolean
  startsAt: Date | null | undefined
  now?: Date
}): boolean {
  const now = input.now ?? new Date()
  if (!input.isSubscription) return true
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
