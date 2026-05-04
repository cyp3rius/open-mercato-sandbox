import { z } from 'zod'

const uuid = z.string().uuid()
const optionalUuid = z.string().uuid().optional().nullable()

export const partnerProgramCreateSchema = z.object({
  tenantId: uuid,
  organizationId: uuid,
  name: z.string().min(1).max(500),
  description: z.string().max(20000).optional().nullable(),
  validFrom: z.coerce.date().optional().nullable(),
  validTo: z.coerce.date().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})

export const partnerProgramUpdateSchema = z.object({
  id: uuid,
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(20000).optional().nullable(),
  validFrom: z.coerce.date().optional().nullable(),
  validTo: z.coerce.date().optional().nullable(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})

export const partnerProgramDeleteSchema = z.object({
  id: uuid,
})

export const partnerProgramMembershipCreateSchema = z.object({
  tenantId: uuid,
  organizationId: uuid,
  programId: uuid,
  customerEntityId: uuid,
  role: z.string().max(200).optional().nullable(),
  joinedAt: z.coerce.date().optional(),
})

export const partnerProgramMembershipDeleteSchema = z.object({
  id: uuid,
})

export type PartnerProgramCreateInput = z.infer<typeof partnerProgramCreateSchema>
export type PartnerProgramUpdateInput = z.infer<typeof partnerProgramUpdateSchema>
export type PartnerProgramMembershipCreateInput = z.infer<typeof partnerProgramMembershipCreateSchema>
