import type { EntitySearchComboboxOption } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

type InvoiceRow = {
  id?: string
  documentNumber?: string
  counterpartyName?: string | null
  issueDate?: string
}

function toOption(row: InvoiceRow): EntitySearchComboboxOption | null {
  const id = typeof row.id === 'string' ? row.id : ''
  if (!id) return null
  const label = typeof row.documentNumber === 'string' && row.documentNumber.trim().length > 0 ? row.documentNumber : id
  const details = [row.counterpartyName, row.issueDate].filter(
    (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
  )
  return {
    value: id,
    label,
    description: details.length > 0 ? details.join(' · ') : undefined,
  }
}

export async function remoteSearchAccountingInvoices(query: string): Promise<EntitySearchComboboxOption[]> {
  const params = new URLSearchParams({
    page: '1',
    pageSize: '20',
    sortField: 'issueDate',
    sortDir: 'desc',
  })
  const q = query.trim()
  if (q.length > 0) params.set('search', q)

  const call = await apiCall<{ items?: InvoiceRow[] }>(`/api/accounting/invoices?${params.toString()}`)
  if (!call.ok) return []
  const items = Array.isArray(call.result?.items) ? call.result.items : []
  return items.map((row) => toOption(row)).filter((row): row is EntitySearchComboboxOption => row !== null)
}

export function mergeAccountingSearchOptionIfMissing(
  options: EntitySearchComboboxOption[],
  value: string,
  fallbackLabel?: string | null,
): EntitySearchComboboxOption[] {
  const selected = value.trim()
  if (!selected) return options
  const exists = options.some((entry) => entry.value === selected)
  if (exists) return options
  return [
    ...options,
    {
      value: selected,
      label: typeof fallbackLabel === 'string' && fallbackLabel.trim().length > 0 ? fallbackLabel : selected,
    },
  ]
}
