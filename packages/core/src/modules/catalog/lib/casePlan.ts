import type { CatalogProductCaseTemplate } from '../data/types'
import {
  subtractDurationFromDate,
  type ProcedureDuration,
} from '../../playbooks/lib/duration'

function toDuration(
  amount: number | null | undefined,
  unit: string | null | undefined,
): ProcedureDuration | null {
  if (
    typeof amount === 'number'
    && amount > 0
    && unit
    && ['hours', 'days', 'weeks', 'months'].includes(unit)
  ) {
    return { amount, unit: unit as ProcedureDuration['unit'] }
  }
  return null
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
    startsAt: template.startsAt ?? null,
    sourceTemplateId: template.sourceTemplateId ?? null,
  }))
}

export function parseCasePlanStartsAt(raw: string | null | undefined): Date | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/**
 * When the system should create the first case for a plan item.
 * One-shot: startsAt. Recurring: startsAt − lead time (or startsAt if no lead).
 */
export function computeCasePlanCreateAt(
  item: Pick<
    CatalogProductCaseTemplate,
    'startsAt' | 'recurrenceEnabled' | 'recurrenceCreateLeadTime'
  >,
  now: Date = new Date(),
): Date | null {
  const startsAt = parseCasePlanStartsAt(item.startsAt ?? null)
  if (!startsAt) {
    return now
  }
  if (!item.recurrenceEnabled) return startsAt
  const lead = item.recurrenceCreateLeadTime
  const duration = toDuration(lead?.amount, lead?.unit ?? null)
  if (!duration) return startsAt
  return subtractDurationFromDate(startsAt, duration)
}

export function casePlanItemIsDue(
  item: Pick<
    CatalogProductCaseTemplate,
    'startsAt' | 'recurrenceEnabled' | 'recurrenceCreateLeadTime'
  >,
  now: Date = new Date(),
): boolean {
  const createAt = computeCasePlanCreateAt(item, now)
  if (!createAt) return false
  return createAt.getTime() <= now.getTime()
}

export function resolveCasePlanSnapshot(input: {
  lineCasePlan?: CatalogProductCaseTemplate[] | null
  productCaseTemplates?: CatalogProductCaseTemplate[] | null
  defaultStartsAt?: Date | string | null
}): CatalogProductCaseTemplate[] {
  const base =
    Array.isArray(input.lineCasePlan) && input.lineCasePlan.length > 0
      ? cloneCaseTemplatesSnapshot(input.lineCasePlan)
      : cloneCaseTemplatesSnapshot(input.productCaseTemplates)
  const defaultStartsAt =
    input.defaultStartsAt instanceof Date
      ? input.defaultStartsAt.toISOString()
      : typeof input.defaultStartsAt === 'string' && input.defaultStartsAt.trim()
        ? input.defaultStartsAt.trim()
        : null
  if (!defaultStartsAt) return base
  return base.map((item) => ({
    ...item,
    startsAt: item.startsAt ?? defaultStartsAt,
  }))
}
