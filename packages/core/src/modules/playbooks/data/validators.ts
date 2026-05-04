import { z } from 'zod'
import { procedureBlocksArraySchema } from '../lib/procedureBlocks'

const uuid = z.string().uuid()

export const playbookCreateSchema = z.object({
  tenantId: uuid,
  organizationId: uuid,
  slug: z.string().min(1).max(160),
  title: z.string().min(1).max(500),
  body: z.string().max(100000),
  contextTags: z.array(z.string().min(1).max(80)).optional().default([]),
  procedureDefinition: procedureBlocksArraySchema.optional().default([]),
  audience: z.enum(['internal', 'customer_facing', 'both']).optional().default('internal'),
  version: z.number().int().min(1).optional().default(1),
  publishedAt: z.coerce.date().optional().nullable(),
  isActive: z.boolean().optional().default(true),
})

export const playbookUpdateSchema = z.object({
  id: uuid,
  slug: z.string().min(1).max(160).optional(),
  title: z.string().min(1).max(500).optional(),
  body: z.string().max(100000).optional(),
  contextTags: z.array(z.string().min(1).max(80)).optional(),
  procedureDefinition: procedureBlocksArraySchema.optional(),
  audience: z.enum(['internal', 'customer_facing', 'both']).optional(),
  version: z.number().int().min(1).optional(),
  publishedAt: z.coerce.date().optional().nullable(),
  isActive: z.boolean().optional(),
})

export const playbookDeleteSchema = z.object({
  id: uuid,
})

export type PlaybookCreateInput = z.infer<typeof playbookCreateSchema>
export type PlaybookUpdateInput = z.infer<typeof playbookUpdateSchema>
export type PlaybookDeleteInput = z.infer<typeof playbookDeleteSchema>
