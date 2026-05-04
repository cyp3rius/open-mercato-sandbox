import { slugify } from '@open-mercato/shared/lib/slugify'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

/**
 * Returns a slug unique within the org (excluding current record when editing).
 * Uses GET /api/playbooks?slug=… (exact match).
 */
export async function resolveUniquePlaybookSlug(
  titleSource: string,
  options: { currentRecordId?: string },
): Promise<string> {
  const base = slugify(titleSource)
  if (!base.length) return ''
  let candidate = base
  let suffix = 2
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const call = await apiCall<{ items?: Array<{ id?: string; slug?: string }> }>(
      `/api/playbooks?slug=${encodeURIComponent(candidate)}&pageSize=5`,
    )
    const items = Array.isArray(call.result?.items) ? call.result.items : []
    const currentId = options.currentRecordId
    const conflict = items.some((row) => {
      const rid = typeof row?.id === 'string' ? row.id : ''
      if (currentId && rid === currentId) return false
      const s = typeof row?.slug === 'string' ? row.slug.trim().toLowerCase() : ''
      return s === candidate.trim().toLowerCase()
    })
    if (!conflict) return candidate
    candidate = `${base}-${suffix}`
    suffix += 1
  }
  return `${base}-${Date.now()}`
}
