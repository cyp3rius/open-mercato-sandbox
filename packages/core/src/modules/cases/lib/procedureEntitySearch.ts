import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import type { EntitySearchComboboxOption } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import type { ProcedureEntityKind } from '../../playbooks/lib/procedureBlocks'
import {
  remoteSearchCustomerEntities,
  remoteSearchSalesQuotes,
} from '../../procurement/lib/procurementEntitySearch'
import {
  remoteSearchInsurancePoliciesForCaseCustomer,
  remoteSearchResourcesForCaseCustomer,
} from './caseRelationsSearch'

function readItems(payload: Record<string, unknown> | null | undefined): unknown[] {
  const items = payload?.items
  return Array.isArray(items) ? items : []
}

export async function remoteSearchSalesOrdersForCaseCustomer(
  customerEntityId: string | undefined,
  query: string,
): Promise<EntitySearchComboboxOption[]> {
  const params = new URLSearchParams({
    pageSize: '20',
    page: '1',
    sortField: 'createdAt',
    sortDir: 'desc',
  })
  const cid = customerEntityId?.trim()
  if (cid) params.set('customerEntityId', cid)
  const q = query.trim()
  if (q.length) params.set('search', q)
  const call = await apiCall<Record<string, unknown>>(`/api/sales/orders?${params.toString()}`)
  if (!call.ok) return []
  const out: EntitySearchComboboxOption[] = []
  for (const item of readItems(call.result ?? undefined)) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const id = typeof row.id === 'string' ? row.id : ''
    if (!id) continue
    const numRaw = row.order_number ?? row.orderNumber
    const num = typeof numRaw === 'string' ? numRaw.trim() : ''
    const label = num.length ? num : id
    const custName =
      typeof row.customerName === 'string'
        ? row.customerName.trim()
        : typeof row.customer_name === 'string'
          ? row.customer_name.trim()
          : ''
    out.push({
      value: id,
      label,
      description: custName.length ? custName : undefined,
    })
  }
  return out
}

export async function remoteSearchSalesQuotesForCaseCustomer(
  customerEntityId: string | undefined,
  query: string,
): Promise<EntitySearchComboboxOption[]> {
  const params = new URLSearchParams({
    pageSize: '20',
    sortField: 'createdAt',
    sortDir: 'desc',
  })
  const cid = customerEntityId?.trim()
  if (cid) params.set('customerEntityId', cid)
  const q = query.trim()
  if (q.length) params.set('search', q)
  const call = await apiCall<Record<string, unknown>>(`/api/sales/quotes?${params.toString()}`)
  if (!call.ok) {
    // Fallback without customer filter if API rejects the param
    return remoteSearchSalesQuotes(query)
  }
  const out: EntitySearchComboboxOption[] = []
  for (const item of readItems(call.result ?? undefined)) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const id = typeof row.id === 'string' ? row.id : ''
    if (!id) continue
    const numRaw = row.quote_number ?? row.quoteNumber
    const num = typeof numRaw === 'string' ? numRaw.trim() : ''
    const label = num.length ? num : id
    const cust = row.customer_snapshot
    let sub: string | null = null
    if (cust && typeof cust === 'object') {
      const snap = cust as Record<string, unknown>
      const name = typeof snap.displayName === 'string' ? snap.displayName.trim() : ''
      if (name.length) sub = name
    }
    out.push({ value: id, label, description: sub })
  }
  return out
}

export async function remoteSearchCustomerDealsForCaseCustomer(
  customerEntityId: string | undefined,
  query: string,
): Promise<EntitySearchComboboxOption[]> {
  const params = new URLSearchParams({
    pageSize: '20',
    page: '1',
  })
  const cid = customerEntityId?.trim()
  if (cid) params.set('companyId', cid)
  const q = query.trim()
  if (q.length) params.set('search', q)
  const call = await apiCall<Record<string, unknown>>(`/api/customers/deals?${params.toString()}`)
  if (!call.ok) return []
  const out: EntitySearchComboboxOption[] = []
  for (const item of readItems(call.result ?? undefined)) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const id = typeof row.id === 'string' ? row.id : ''
    if (!id) continue
    const title = typeof row.title === 'string' ? row.title.trim() : ''
    const status = typeof row.status === 'string' ? row.status.trim() : ''
    out.push({
      value: id,
      label: title.length ? title : id,
      description: status.length ? status : undefined,
    })
  }
  return out
}

export type ProcedureEntityKindAdapter = {
  entityKind: ProcedureEntityKind
  createInNewTabHref: string
  /** Case FK field to sync when selection is confirmed (null = metadata only). */
  syncCaseField: 'customerEntityId' | 'resourceId' | 'insurancePolicyId' | null
  onRemoteSearch: (
    query: string,
    context: { customerEntityId?: string | null },
  ) => Promise<EntitySearchComboboxOption[]>
}

const ADAPTERS: Record<ProcedureEntityKind, ProcedureEntityKindAdapter> = {
  customer: {
    entityKind: 'customer',
    createInNewTabHref: '/backend/customers/people/create',
    syncCaseField: 'customerEntityId',
    onRemoteSearch: async (query) => remoteSearchCustomerEntities(query),
  },
  resource: {
    entityKind: 'resource',
    createInNewTabHref: '/backend/resources/resources/create',
    syncCaseField: 'resourceId',
    onRemoteSearch: async (query, ctx) =>
      remoteSearchResourcesForCaseCustomer(ctx.customerEntityId ?? undefined, query),
  },
  sales_order: {
    entityKind: 'sales_order',
    createInNewTabHref: '/backend/sales/orders/create',
    syncCaseField: null,
    onRemoteSearch: async (query, ctx) =>
      remoteSearchSalesOrdersForCaseCustomer(ctx.customerEntityId ?? undefined, query),
  },
  sales_quote: {
    entityKind: 'sales_quote',
    createInNewTabHref: '/backend/sales/quotes/create',
    syncCaseField: null,
    onRemoteSearch: async (query, ctx) =>
      remoteSearchSalesQuotesForCaseCustomer(ctx.customerEntityId ?? undefined, query),
  },
  sales_deal: {
    entityKind: 'sales_deal',
    createInNewTabHref: '/backend/customers/deals/create',
    syncCaseField: null,
    onRemoteSearch: async (query, ctx) =>
      remoteSearchCustomerDealsForCaseCustomer(ctx.customerEntityId ?? undefined, query),
  },
  insurance_policy: {
    entityKind: 'insurance_policy',
    createInNewTabHref: '/backend/insurance-desk/policies/create',
    syncCaseField: 'insurancePolicyId',
    onRemoteSearch: async (query, ctx) =>
      remoteSearchInsurancePoliciesForCaseCustomer(ctx.customerEntityId ?? undefined, query),
  },
}

export function getProcedureEntityKindAdapter(entityKind: ProcedureEntityKind): ProcedureEntityKindAdapter {
  return ADAPTERS[entityKind]
}
