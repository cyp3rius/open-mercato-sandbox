import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

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

function pickPartnerDisplayName(row: Record<string, unknown>): string {
  const dn = row.display_name ?? row.displayName
  if (typeof dn === 'string' && dn.trim().length) return dn.trim()
  const pe = row.primary_email ?? row.primaryEmail
  if (typeof pe === 'string' && pe.trim().length) return pe.trim()
  return typeof row.id === 'string' ? row.id : ''
}

export async function remoteSearchReferringPartners(
  query: string,
  parts: { personPrefix: string; companyPrefix: string },
): Promise<Array<{ value: string; label: string }>> {
  const qs = partnerListQueryString(query)
  const [peopleCall, companiesCall] = await Promise.all([
    apiCall<{ items?: Array<Record<string, unknown>> }>(`/api/customers/people?${qs}`),
    apiCall<{ items?: Array<Record<string, unknown>> }>(`/api/customers/companies?${qs}`),
  ])
  const out: Array<{ value: string; label: string }> = []
  if (peopleCall.ok && Array.isArray(peopleCall.result?.items)) {
    for (const row of peopleCall.result.items) {
      const id = typeof row.id === 'string' ? row.id : ''
      if (!id.length) continue
      const label = pickPartnerDisplayName(row)
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
      const label = pickPartnerDisplayName(row)
      out.push({
        value: id,
        label: `${parts.companyPrefix}: ${label.length ? label : id}`,
      })
    }
  }
  out.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  return out
}
