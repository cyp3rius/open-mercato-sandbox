import { z } from 'zod'

const uuid = z.string().uuid()

const incentivePercentSchema = z.coerce
  .number()
  .min(0, 'Incentive percent must be at least 0.')
  .max(100, 'Incentive percent must be at most 100.')

const incentiveBaseSchema = z.enum(['net', 'gross']).default('net')

export const partnerProgramCreateSchema = z.object({
  tenantId: uuid,
  organizationId: uuid,
  name: z.string().min(1).max(500),
  description: z.string().max(20000).optional().nullable(),
  validFrom: z.coerce.date().optional().nullable(),
  validTo: z.coerce.date().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  incentivePercent: incentivePercentSchema.optional().default(0),
  incentiveBase: incentiveBaseSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})

export const partnerProgramUpdateSchema = z.object({
  id: uuid,
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(20000).optional().nullable(),
  validFrom: z.coerce.date().optional().nullable(),
  validTo: z.coerce.date().optional().nullable(),
  isActive: z.boolean().optional(),
  incentivePercent: incentivePercentSchema.optional(),
  incentiveBase: z.enum(['net', 'gross']).optional(),
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

export const partnerIncentiveAccrueForOrderSchema = z.object({
  orderId: uuid,
  tenantId: uuid.optional(),
  organizationId: uuid.optional(),
})

export const partnerIncentivePayoutSchema = z.object({
  tenantId: uuid,
  organizationId: uuid,
  customerEntityId: uuid,
  currencyCode: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, 'Currency must be a 3-letter ISO code.'),
  note: z.string().max(2000).optional().nullable(),
})

export type PartnerProgramCreateInput = z.infer<typeof partnerProgramCreateSchema>
export type PartnerProgramUpdateInput = z.infer<typeof partnerProgramUpdateSchema>
export type PartnerProgramMembershipCreateInput = z.infer<typeof partnerProgramMembershipCreateSchema>
export type PartnerIncentiveAccrueForOrderInput = z.infer<typeof partnerIncentiveAccrueForOrderSchema>
export type PartnerIncentivePayoutInput = z.infer<typeof partnerIncentivePayoutSchema>
