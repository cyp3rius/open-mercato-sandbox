import { mergeEntitySearchOption } from '@open-mercato/core/modules/procurement/lib/procurementEntitySearch'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import type { EntitySearchComboboxOption } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'

type TeamMemberRow = {
  id?: string
  displayName?: string
  display_name?: string
}

function readTeamMemberLabel(row: TeamMemberRow): string {
  if (typeof row.displayName === 'string' && row.displayName.trim().length) return row.displayName.trim()
  if (typeof row.display_name === 'string' && row.display_name.trim().length) return row.display_name.trim()
  return typeof row.id === 'string' ? row.id : ''
}

function readTeamMemberItems(payload: Record<string, unknown> | null | undefined): TeamMemberRow[] {
  if (!payload || typeof payload !== 'object') return []
  const items = payload.items
  return Array.isArray(items) ? (items as TeamMemberRow[]) : []
}

export async function remoteSearchStaffTeamMembers(
  query: string,
  options?: { excludeMemberIds?: Set<string> },
): Promise<EntitySearchComboboxOption[]> {
  const params = new URLSearchParams({
    page: '1',
    pageSize: '50',
    sortField: 'displayName',
    sortDir: 'asc',
  })
  const q = query.trim()
  if (q.length) params.set('search', q)

  const call = await apiCall<Record<string, unknown>>(`/api/staff/team-members?${params.toString()}`)
  if (!call.ok) return []

  const exclude = options?.excludeMemberIds ?? new Set<string>()
  const out: EntitySearchComboboxOption[] = []

  for (const row of readTeamMemberItems(call.result ?? undefined)) {
    const id = typeof row.id === 'string' ? row.id : ''
    if (!id.length || exclude.has(id)) continue
    const label = readTeamMemberLabel(row)
    if (!label.length) continue
    out.push({ value: id, label })
  }

  out.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  return out
}

export async function resolveStaffTeamMemberDisplayLabel(memberId: string): Promise<string | null> {
  const trimmed = memberId.trim()
  if (!trimmed.length) return null

  const params = new URLSearchParams({
    ids: trimmed,
    page: '1',
    pageSize: '1',
  })
  const call = await apiCall<Record<string, unknown>>(`/api/staff/team-members?${params.toString()}`)
  if (!call.ok) return null

  const row = readTeamMemberItems(call.result ?? undefined)[0]
  if (!row) return null
  const label = readTeamMemberLabel(row)
  return label.length ? label : null
}

export { mergeEntitySearchOption }
