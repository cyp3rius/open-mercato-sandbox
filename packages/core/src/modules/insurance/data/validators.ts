import { z } from 'zod'

const uuid = () => z.string().uuid()

const scoped = z.object({
  organizationId: uuid(),
  tenantId: uuid(),
})

export const insuranceInsurerCreateSchema = scoped.extend({
  code: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(4000).optional().nullable(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})

export const insuranceInsurerUpdateSchema = z
  .object({
    id: uuid(),
  })
  .merge(insuranceInsurerCreateSchema.partial())

export const insuranceInsurerContactCreateSchema = scoped.extend({
  insurerId: uuid(),
  fullName: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(320).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  role: z.string().trim().max(150).optional().nullable(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export const insuranceInsurerContactUpdateSchema = z
  .object({
    id: uuid(),
  })
  .merge(insuranceInsurerContactCreateSchema.partial())

export const insurancePolicyCreateSchema = scoped.extend({
  policyNumber: z.string().trim().min(1).max(191),
  insurerId: uuid(),
  insurerContactId: uuid().nullable().optional(),
  caretakerUserId: uuid().nullable().optional(),
  referringPartnerEntityId: uuid(),
  catalogProductId: uuid().nullable().optional(),
  resourceId: uuid().nullable().optional(),
  insuredPersonEntityId: uuid().nullable().optional(),
  insuredCompanyEntityId: uuid().nullable().optional(),
  validFrom: z.coerce.date().nullable().optional(),
  validTo: z.coerce.date().nullable().optional(),
  status: z.string().trim().min(1).max(100),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  /** When set, links the new policy to this lead after creation. */
  sourceLeadId: uuid().optional(),
})

export const insurancePolicyUpdateSchema = z
  .object({
    id: uuid(),
  })
  .merge(insurancePolicyCreateSchema.omit({ sourceLeadId: true }).partial())

export const insuranceLeadCreateSchema = scoped.extend({
  title: z.string().trim().min(1).max(500),
  status: z.string().trim().max(64).optional(),
  source: z.string().trim().max(120).optional().nullable(),
  externalId: z.string().trim().min(1).max(191).optional().nullable(),
  payload: z.record(z.string(), z.unknown()).optional().nullable(),
  referringPartnerEntityId: uuid().optional().nullable(),
})

export const insuranceLeadUpdateSchema = z
  .object({
    id: uuid(),
  })
  .merge(insuranceLeadCreateSchema.partial())
  .extend({
    linkedPolicyId: uuid().optional().nullable(),
  })

export type InsuranceInsurerCreateInput = z.infer<typeof insuranceInsurerCreateSchema>
export type InsuranceInsurerUpdateInput = z.infer<typeof insuranceInsurerUpdateSchema>
export type InsuranceInsurerContactCreateInput = z.infer<typeof insuranceInsurerContactCreateSchema>
export type InsuranceInsurerContactUpdateInput = z.infer<typeof insuranceInsurerContactUpdateSchema>
export type InsurancePolicyCreateInput = z.infer<typeof insurancePolicyCreateSchema>
export type InsurancePolicyUpdateInput = z.infer<typeof insurancePolicyUpdateSchema>
export type InsuranceLeadCreateInput = z.infer<typeof insuranceLeadCreateSchema>
export type InsuranceLeadUpdateInput = z.infer<typeof insuranceLeadUpdateSchema>
