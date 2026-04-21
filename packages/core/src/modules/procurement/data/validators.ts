import { z } from 'zod'

const scopedCreate = {
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid(),
}

const scopedUpdate = {
  id: z.string().uuid(),
}

export const procurementProcessCreateSchema = z.object({
  ...scopedCreate,
  title: z.string().min(1).max(500),
  description: z.string().max(200000).optional().nullable(),
  customerEntityId: z.string().uuid().optional().nullable(),
  salesQuoteId: z.string().uuid().optional().nullable(),
  statusValue: z.string().max(200).optional().nullable(),
  typeValue: z.string().max(200).optional().nullable(),
  handlerUserId: z.string().uuid().optional().nullable(),
})

export const procurementProcessUpdateSchema = z.object({
  ...scopedUpdate,
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(200000).optional().nullable(),
  customerEntityId: z.string().uuid().optional().nullable(),
  salesQuoteId: z.string().uuid().optional().nullable(),
  salesInvoiceId: z.string().uuid().optional().nullable(),
  resourceId: z.string().uuid().optional().nullable(),
  selectedSupplierId: z.string().uuid().optional().nullable(),
  refinancingEnabled: z.boolean().optional(),
  refinancingNotes: z.string().max(200000).optional().nullable(),
  statusValue: z.string().max(200).optional().nullable(),
  typeValue: z.string().max(200).optional().nullable(),
  handlerUserId: z.string().uuid().optional().nullable(),
  startedAt: z.coerce.date().optional().nullable(),
  closedAt: z.coerce.date().optional().nullable(),
})

export const procurementProcessDeleteSchema = z.object({
  ...scopedUpdate,
})

export const procurementProcessCompleteSchema = z.object({
  ...scopedCreate,
  id: z.string().uuid(),
  resourceId: z.string().uuid().optional().nullable(),
  salesInvoiceId: z.string().uuid().optional().nullable(),
})

export const procurementSupplierCreateSchema = z.object({
  ...scopedCreate,
  processId: z.string().uuid(),
  vendorLabel: z.string().min(1).max(500),
  vendorCustomerEntityId: z.string().uuid().optional().nullable(),
  contactName: z.string().max(200).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  phone: z.string().max(80).optional().nullable(),
  website: z.string().max(500).optional().nullable(),
  notes: z.string().max(200000).optional().nullable(),
  offerSummary: z.string().max(200000).optional().nullable(),
  sortOrder: z.coerce.number().int().optional(),
  lineItemIds: z.array(z.string().uuid()).optional(),
})

export const procurementSupplierUpdateSchema = z.object({
  ...scopedUpdate,
  vendorLabel: z.string().min(1).max(500).optional(),
  vendorCustomerEntityId: z.string().uuid().optional().nullable(),
  contactName: z.string().max(200).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  phone: z.string().max(80).optional().nullable(),
  website: z.string().max(500).optional().nullable(),
  notes: z.string().max(200000).optional().nullable(),
  offerSummary: z.string().max(200000).optional().nullable(),
  sortOrder: z.coerce.number().int().optional(),
  lineItemIds: z.array(z.string().uuid()).optional(),
})

export const procurementSupplierDeleteSchema = z.object({
  ...scopedUpdate,
})

export const procurementLineItemCreateSchema = z.object({
  ...scopedCreate,
  processId: z.string().uuid(),
  title: z.string().min(1).max(500),
  specification: z.string().max(200000).optional().nullable(),
  quantity: z.coerce.number().positive().optional().nullable(),
  unitLabel: z.string().max(80).optional().nullable(),
  resourceId: z.string().uuid().optional().nullable(),
  sortOrder: z.coerce.number().int().optional(),
})

export const procurementLineItemUpdateSchema = z.object({
  ...scopedUpdate,
  title: z.string().min(1).max(500).optional(),
  specification: z.string().max(200000).optional().nullable(),
  quantity: z.coerce.number().positive().optional().nullable(),
  unitLabel: z.string().max(80).optional().nullable(),
  resourceId: z.string().uuid().optional().nullable(),
  sortOrder: z.coerce.number().int().optional(),
})

export const procurementLineItemDeleteSchema = z.object({
  ...scopedUpdate,
})

export const procurementTaskCreateSchema = z.object({
  ...scopedCreate,
  processId: z.string().uuid(),
  supplierId: z.string().uuid().optional().nullable(),
  title: z.string().min(1).max(500),
  body: z.string().max(200000).optional().nullable(),
  dueAt: z.coerce.date().optional().nullable(),
  assignedUserId: z.string().uuid().optional().nullable(),
  delegatedFromUserId: z.string().uuid().optional().nullable(),
  sourceActionValue: z.string().max(200).optional().nullable(),
})

export const procurementTaskUpdateSchema = z.object({
  ...scopedUpdate,
  supplierId: z.string().uuid().optional().nullable(),
  title: z.string().min(1).max(500).optional(),
  body: z.string().max(200000).optional().nullable(),
  taskStatus: z.enum(['open', 'done', 'cancelled']).optional(),
  dueAt: z.coerce.date().optional().nullable(),
  assignedUserId: z.string().uuid().optional().nullable(),
  delegatedFromUserId: z.string().uuid().optional().nullable(),
  /** When true, do not push changes to linked customer interaction / example todo (e.g. reverse sync). */
  skipWorkItemSync: z.boolean().optional(),
})

export const procurementTaskDeleteSchema = z.object({
  ...scopedUpdate,
  skipWorkItemSync: z.boolean().optional(),
})

export const procurementTimelineAppendSchema = z.object({
  ...scopedCreate,
  processId: z.string().uuid(),
  eventType: z.string().min(1).max(120),
  message: z.string().min(1).max(8000),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})

export const procurementTimelineUpdateSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid(),
  processId: z.string().uuid(),
  message: z.string().min(1).max(8000),
})

export const procurementTimelineDeleteSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid(),
  processId: z.string().uuid(),
})

export type ProcurementProcessCreateInput = z.infer<typeof procurementProcessCreateSchema>
export type ProcurementProcessUpdateInput = z.infer<typeof procurementProcessUpdateSchema>
export type ProcurementProcessCompleteInput = z.infer<typeof procurementProcessCompleteSchema>
export type ProcurementSupplierCreateInput = z.infer<typeof procurementSupplierCreateSchema>
export type ProcurementSupplierUpdateInput = z.infer<typeof procurementSupplierUpdateSchema>
export type ProcurementLineItemCreateInput = z.infer<typeof procurementLineItemCreateSchema>
export type ProcurementLineItemUpdateInput = z.infer<typeof procurementLineItemUpdateSchema>
export type ProcurementTaskCreateInput = z.infer<typeof procurementTaskCreateSchema>
export type ProcurementTaskUpdateInput = z.infer<typeof procurementTaskUpdateSchema>
export type ProcurementTimelineAppendInput = z.infer<typeof procurementTimelineAppendSchema>
export type ProcurementTimelineUpdateInput = z.infer<typeof procurementTimelineUpdateSchema>
export type ProcurementTimelineDeleteInput = z.infer<typeof procurementTimelineDeleteSchema>

export const procurementStatusTransitionRuleCreateSchema = z.object({
  fromStatusValue: z.string().min(1).max(200),
  toStatusValue: z.string().min(1).max(200),
  sortOrder: z.coerce.number().int().min(0).max(999_999).optional(),
  automationWorkflowId: z.union([z.string().max(200), z.null()]).optional(),
})

export const procurementStatusTransitionRuleUpdateSchema = z.object({
  fromStatusValue: z.string().min(1).max(200).optional(),
  toStatusValue: z.string().min(1).max(200).optional(),
  sortOrder: z.coerce.number().int().min(0).max(999_999).optional(),
  automationWorkflowId: z.union([z.string().max(200), z.null()]).optional(),
})

export const procurementStatusTransitionRulesReorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
})

export const procurementOrganizationSettingsPutSchema = z.object({
  defaultProcessStatusValue: z.union([z.string().min(1).max(200), z.null()]),
  terminalProcessStatusValue: z.union([z.string().min(1).max(200), z.null()]),
})

export type ProcurementStatusTransitionRuleCreateInput = z.infer<
  typeof procurementStatusTransitionRuleCreateSchema
>
export type ProcurementStatusTransitionRuleUpdateInput = z.infer<
  typeof procurementStatusTransitionRuleUpdateSchema
>
export type ProcurementStatusTransitionRulesReorderInput = z.infer<
  typeof procurementStatusTransitionRulesReorderSchema
>
export type ProcurementOrganizationSettingsPutInput = z.infer<
  typeof procurementOrganizationSettingsPutSchema
>
