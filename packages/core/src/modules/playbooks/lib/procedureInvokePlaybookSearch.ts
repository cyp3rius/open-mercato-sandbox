import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import type { EntitySearchComboboxOption } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'

type MatchRow = {
  id?: string
  slug?: string
  title?: string
  version?: number
  isActive?: boolean
}

function readItems(payload: Record<string, unknown> | null | undefined): unknown[] {
  const items = payload?.items
  return Array.isArray(items) ? items : []
}

/** Heads from GET /api/playbooks/match — option.value is normalized slug (latest active version per slug). */
export async function remoteSearchPlaybookHeadsForProcedureInvoke(
  query: string,
  excludeSlugs: string[],
): Promise<EntitySearchComboboxOption[]> {
  const call = await apiCall<{ items?: MatchRow[] }>('/api/playbooks/match')
  if (!call.ok) return []
  const excluded = new Set(excludeSlugs.map((s) => s.trim().toLowerCase()).filter(Boolean))
  const term = query.trim().toLowerCase()
  const rows = readItems(call.result ?? undefined)
    .filter((item): item is MatchRow => Boolean(item && typeof item === 'object'))
    .filter((r) => r.isActive !== false)
  const filtered = !term.length
    ? rows
    : rows.filter((r) => {
        const title = (typeof r.title === 'string' ? r.title : '').toLowerCase()
        const slug = (typeof r.slug === 'string' ? r.slug : '').toLowerCase()
        const ver =
          typeof r.version === 'number' && Number.isFinite(r.version) ? Math.trunc(r.version) : null
        if (title.includes(term) || slug.includes(term)) return true
        if (ver !== null && String(ver).includes(term)) return true
        return false
      })
  const out: EntitySearchComboboxOption[] = []
  for (const r of filtered) {
    const slugRaw = typeof r.slug === 'string' ? r.slug.trim() : ''
    if (!slugRaw.length) continue
    const slugNorm = slugRaw.toLowerCase()
    if (excluded.has(slugNorm)) continue
    const title = typeof r.title === 'string' ? r.title.trim() : ''
    const ver =
      typeof r.version === 'number' && Number.isFinite(r.version) ? Math.trunc(r.version) : null
    const primary = title.length ? title : slugNorm
    const label =
      ver !== null ? `${primary} (${slugNorm}) · v${ver}` : `${primary} (${slugNorm})`
    out.push({ value: slugNorm, label })
    if (out.length >= 20) break
  }
  return out
}
