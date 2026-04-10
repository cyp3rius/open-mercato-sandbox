import { z } from 'zod'

export const policyStatusDictionaryEntrySchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  icon: z.string().optional(),
  color: z.string().optional(),
})

export const policyStatusDictionarySchema = z.object({
  entries: z.array(policyStatusDictionaryEntrySchema),
})

export type PolicyStatusDictionaryEntry = z.infer<typeof policyStatusDictionaryEntrySchema>
export type PolicyStatusDictionary = z.infer<typeof policyStatusDictionarySchema>

export const POLICY_STATUS_DICTIONARY_CONFIG_MODULE = 'insurance' as const
export const POLICY_STATUS_DICTIONARY_CONFIG_NAME = 'policy_status_dictionary' as const

export const DEFAULT_POLICY_STATUS_DICTIONARY: PolicyStatusDictionary = {
  entries: [],
}

export function parsePolicyStatusDictionary(raw: unknown): PolicyStatusDictionary {
  const parsed = policyStatusDictionarySchema.safeParse(raw)
  if (parsed.success) return parsed.data
  return DEFAULT_POLICY_STATUS_DICTIONARY
}

export function mergeWithDefaultPolicyStatusDictionary(raw: unknown): PolicyStatusDictionary {
  return parsePolicyStatusDictionary(raw)
}
