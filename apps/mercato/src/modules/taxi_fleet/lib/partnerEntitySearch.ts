import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

type PagedItems = { items?: Record<string, unknown>[] }

function pickDisplayName(row: Record<string, unknown>): string {
  const dn = row.display_name ?? row.displayName
  if (typeof dn === 'string' && dn.trim().length) return dn.trim()
  const pe = row.primary_email ?? row.primaryEmail
  if (typeof pe === 'string' && pe.trim().length) return pe.trim()
  return typeof row.id === 'string' ? row.id : ''
}

function partnerListQueryString(search?: string): string {
  const params = new URLSearchParams({
    page: '1',
    pageSize: '50',
    crmRecordTypes: 'partner,referrer',
  })
  const q = typeof search === 'string' ? search.trim() : ''
  if (q.length) params.set('search', q)
  return params.toString()
}

export async function searchPartnerEntityOptions(
  query: string | undefined,
  parts: {
    personPrefix: string
    companyPrefix: string
  },
): Promise<Array<{ value: string; label: string }>> {
  const qs = partnerListQueryString(query)
  const [peopleCall, companiesCall] = await Promise.all([
    apiCall<PagedItems>(`/api/customers/people?${qs}`),
    apiCall<PagedItems>(`/api/customers/companies?${qs}`),
  ])
  const out: Array<{ value: string; label: string }> = []
  if (peopleCall.ok && Array.isArray(peopleCall.result?.items)) {
    for (const row of peopleCall.result.items) {
      const id = typeof row.id === 'string' ? row.id : ''
      if (!id.length) continue
      const label = pickDisplayName(row)
      out.push({
        value: id,
        label: `${parts.personPrefix}: ${label.length ? label : id}`,
      })
    }
  }
  if (companiesCall.ok && Array.isArray(companiesCall.result?.items)) {
    for (const row of companiesCall.result.items) {
      const id = typeof row.id === 'string' ? row.id : ''
      if (!id.length) continue
      const label = pickDisplayName(row)
      out.push({
        value: id,
        label: `${parts.companyPrefix}: ${label.length ? label : id}`,
      })
    }
  }
  out.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  return out
}

export async function mergePartnerEntityOptionIfMissing(
  options: Array<{ value: string; label: string }>,
  entityId: string | null | undefined,
  parts: { personPrefix: string; companyPrefix: string },
): Promise<Array<{ value: string; label: string }>> {
  const id = typeof entityId === 'string' ? entityId.trim() : ''
  if (!id.length) return options
  if (options.some((option) => option.value === id)) return options

  const peopleCall = await apiCall<PagedItems>(
    `/api/customers/people?id=${encodeURIComponent(id)}&page=1&pageSize=1`,
  )
  const personRow = peopleCall.ok && Array.isArray(peopleCall.result?.items) ? peopleCall.result.items[0] : undefined
  if (personRow && typeof personRow.id === 'string' && personRow.id.length) {
    const label = pickDisplayName(personRow)
    return [
      {
        value: personRow.id,
        label: `${parts.personPrefix}: ${label.length ? label : personRow.id}`,
      },
      ...options,
    ]
  }

  const companiesCall = await apiCall<PagedItems>(
    `/api/customers/companies?id=${encodeURIComponent(id)}&page=1&pageSize=1`,
  )
  const companyRow = companiesCall.ok && Array.isArray(companiesCall.result?.items) ? companiesCall.result.items[0] : undefined
  if (companyRow && typeof companyRow.id === 'string' && companyRow.id.length) {
    const label = pickDisplayName(companyRow)
    return [
      {
        value: companyRow.id,
        label: `${parts.companyPrefix}: ${label.length ? label : companyRow.id}`,
      },
      ...options,
    ]
  }

  return options
}
