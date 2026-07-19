import { z } from 'zod'
import { procedureDurationSchema } from '../../playbooks/lib/duration'

const uuid = z.string().uuid()

export const caseCreateSchema = z.object({
  tenantId: uuid,
  organizationId: uuid,
  title: z.string().min(1).max(500),
  statusValue: z.string().min(1).max(100).optional().default('open'),
  statusLabel: z.string().max(200).optional().nullable(),
  statusColor: z.string().max(50).optional().nullable(),
  customerEntityId: uuid,
  resourceId: uuid.optional().nullable(),
  procurementProcessId: uuid.optional().nullable(),
  insurancePolicyId: uuid.optional().nullable(),
  ownerUserId: uuid,
  /** Optional procedure template (playbook); saved without starting — user starts on the case detail view. */
  playbookId: z.string().uuid().nullish(),
  openedAt: z.coerce.date().optional(),
  priority: z.string().max(50).optional().default('normal'),
  dueAt: z.coerce.date().optional().nullable(),
  recurrenceEnabled: z.boolean().optional().default(false),
  recurrenceSeriesId: uuid.optional().nullable(),
  recurrenceIntervalAmount: z.number().int().positive().optional().nullable(),
  recurrenceIntervalUnit: z.enum(['hours', 'days', 'weeks', 'months']).optional().nullable(),
  recurrenceCreateLeadTime: procedureDurationSchema.optional().nullable(),
  recurrenceOccurrenceKey: z.string().max(200).optional().nullable(),
  recurrenceNextOccurrenceAt: z.coerce.date().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})

export const caseUpdateSchema = z.object({
  id: uuid,
  title: z.string().min(1).max(500).optional(),
  statusValue: z.string().min(1).max(100).optional(),
  statusLabel: z.string().max(200).optional().nullable(),
  statusColor: z.string().max(50).optional().nullable(),
  customerEntityId: uuid.optional(),
  resourceId: uuid.optional().nullable(),
  procurementProcessId: uuid.optional().nullable(),
  insurancePolicyId: uuid.optional().nullable(),
  ownerUserId: uuid.optional().nullable(),
  openedAt: z.coerce.date().optional().nullable(),
  closedAt: z.coerce.date().optional().nullable(),
  priority: z.string().max(50).optional(),
  dueAt: z.coerce.date().optional().nullable(),
  recurrenceEnabled: z.boolean().optional(),
  recurrenceSeriesId: uuid.optional().nullable(),
  recurrenceIntervalAmount: z.number().int().positive().optional().nullable(),
  recurrenceIntervalUnit: z.enum(['hours', 'days', 'weeks', 'months']).optional().nullable(),
  recurrenceCreateLeadTime: procedureDurationSchema.optional().nullable(),
  recurrenceOccurrenceKey: z.string().max(200).optional().nullable(),
  recurrenceNextOccurrenceAt: z.coerce.date().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  /** When closing the case (especially interrupt while procedure runs): optional note appended to timeline */
  closingNote: z.string().max(10000).optional().nullable(),
})

export const caseDeleteSchema = z.object({
  id: uuid,
})

export const caseTimelineAppendSchema = z.object({
  tenantId: uuid,
  organizationId: uuid,
  caseId: uuid,
  eventType: z.enum(['note', 'email', 'phone', 'status_change', 'system']),
  body: z.string().min(1).max(50000),
  occurredAt: z.coerce.date().optional(),
  actorUserId: uuid.optional().nullable(),
  sourceRef: z.record(z.string(), z.unknown()).optional().nullable(),
})

export type CaseCreateInput = z.infer<typeof caseCreateSchema>
export type CaseUpdateInput = z.infer<typeof caseUpdateSchema>
export type CaseTimelineAppendInput = z.infer<typeof caseTimelineAppendSchema>
