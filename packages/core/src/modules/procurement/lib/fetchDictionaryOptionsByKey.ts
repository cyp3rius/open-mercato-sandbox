import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import type { DictionaryOption } from '@open-mercato/core/modules/dictionaries/components/DictionaryEntrySelect'

const dictionaryIdByKeyCache = new Map<string, string>()

export async function fetchDictionaryOptionsByKey(dictionaryKey: string): Promise<DictionaryOption[]> {
  const key = dictionaryKey.trim()
  if (!key.length) return []

  let dictId = dictionaryIdByKeyCache.get(key)
  if (!dictId) {
    const listCall = await apiCall<{ items?: Array<{ id?: string; key?: string }> }>('/api/dictionaries')
    const items = Array.isArray(listCall.result?.items) ? listCall.result.items : []
    const match = items.find((d) => typeof d.key === 'string' && d.key === key)
    const id = typeof match?.id === 'string' ? match.id : ''
    if (!id) return []
    dictId = id
    dictionaryIdByKeyCache.set(key, dictId)
  }

  const entriesCall = await apiCall<{ items?: unknown[] }>(`/api/dictionaries/${dictId}/entries`)
  if (!entriesCall.ok) return []
  const raw = Array.isArray(entriesCall.result?.items) ? entriesCall.result.items : []
  const out: DictionaryOption[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const value = typeof row.value === 'string' ? row.value.trim() : ''
    if (!value.length) continue
    const label =
      typeof row.label === 'string' && row.label.trim().length ? row.label.trim() : value
    const colorRaw = typeof row.color === 'string' ? row.color.trim() : ''
    const color = /^#([0-9a-fA-F]{6})$/.test(colorRaw) ? colorRaw : null
    const icon = typeof row.icon === 'string' && row.icon.trim().length ? row.icon.trim() : null
    out.push({ value, label, color, icon })
  }
  return out
}

export function clearProcurementDictionaryIdCache(): void {
  dictionaryIdByKeyCache.clear()
}
