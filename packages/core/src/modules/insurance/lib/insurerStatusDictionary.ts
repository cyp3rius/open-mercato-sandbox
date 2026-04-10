import { z } from 'zod'

export const insurerStatusDictionaryEntrySchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  icon: z.string().optional(),
  color: z.string().optional(),
})

export const insurerStatusDictionarySchema = z.object({
  entries: z.array(insurerStatusDictionaryEntrySchema),
})

export type InsurerStatusDictionaryEntry = z.infer<typeof insurerStatusDictionaryEntrySchema>
export type InsurerStatusDictionary = z.infer<typeof insurerStatusDictionarySchema>

export const INSURER_STATUS_DICTIONARY_CONFIG_MODULE = 'insurance' as const
export const INSURER_STATUS_DICTIONARY_CONFIG_NAME = 'insurer_status_dictionary' as const

export const DEFAULT_INSURER_STATUS_DICTIONARY: InsurerStatusDictionary = {
  entries: [
    { value: 'active', label: 'Active', icon: 'CheckCircle', color: '#16a34a' },
    { value: 'inactive', label: 'Inactive', icon: 'MinusCircle', color: '#737373' },
  ],
}

export function parseInsurerStatusDictionary(raw: unknown): InsurerStatusDictionary {
  const parsed = insurerStatusDictionarySchema.safeParse(raw)
  if (parsed.success) return parsed.data
  return { entries: [] }
}

export function mergeWithDefaultInsurerStatusDictionary(raw: unknown): InsurerStatusDictionary {
  const parsed = parseInsurerStatusDictionary(raw)
  if (parsed.entries.length) return parsed
  return DEFAULT_INSURER_STATUS_DICTIONARY
}
