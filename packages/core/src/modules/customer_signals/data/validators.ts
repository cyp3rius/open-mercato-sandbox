import { z } from 'zod'

const uuid = z.string().uuid()

export const customerSignalCreateSchema = z.object({
  tenantId: uuid,
  organizationId: uuid,
  customerEntityId: uuid,
  signalType: z.string().min(1).max(200),
  source: z.enum(['backend', 'portal', 'integration', 'manual']),
  subjectEntityType: z.string().max(100).optional().nullable(),
  subjectEntityId: uuid.optional().nullable(),
  payload: z.record(z.string(), z.unknown()).optional().nullable(),
  occurredAt: z.coerce.date().optional(),
})

export type CustomerSignalCreateInput = z.infer<typeof customerSignalCreateSchema>
