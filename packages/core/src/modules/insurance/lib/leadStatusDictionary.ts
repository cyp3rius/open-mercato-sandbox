import { z } from 'zod'

export const leadStatusDictionaryEntrySchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  icon: z.string().optional(),
  color: z.string().optional(),
})

export const leadStatusDictionarySchema = z.object({
  entries: z.array(leadStatusDictionaryEntrySchema),
})

export type LeadStatusDictionaryEntry = z.infer<typeof leadStatusDictionaryEntrySchema>
export type LeadStatusDictionary = z.infer<typeof leadStatusDictionarySchema>

export const LEAD_STATUS_DICTIONARY_CONFIG_MODULE = 'insurance' as const
export const LEAD_STATUS_DICTIONARY_CONFIG_NAME = 'lead_status_dictionary' as const

export const DEFAULT_LEAD_STATUS_DICTIONARY: LeadStatusDictionary = {
  entries: [],
}

export function parseLeadStatusDictionary(raw: unknown): LeadStatusDictionary {
  const parsed = leadStatusDictionarySchema.safeParse(raw)
  if (parsed.success) return parsed.data
  return DEFAULT_LEAD_STATUS_DICTIONARY
}

export function mergeWithDefaultLeadStatusDictionary(raw: unknown): LeadStatusDictionary {
  return parseLeadStatusDictionary(raw)
}
