import type { EntityManager } from '@mikro-orm/postgresql'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetFinancialEntry } from '../data/entities'

export type DriverLedgerEntry = {
  id: string
  kind: 'income' | 'expense'
  incomeDocumentType?: 'receipt' | 'invoice' | null
  costType?: string | null
  label: string
  amount: string
  currencyCode: string
  occurredAt: string
  tripId?: string | null
  customerPersonId?: string | null
  customerCompanyId?: string | null
  documentNumber?: string | null
  notes?: string | null
}

function buildEntryLabel(row: TaxiFleetFinancialEntry): string {
  if (row.kind === 'income') {
    const parts = [row.incomeDocumentType, row.documentNumber].filter(Boolean)
    return parts.length ? parts.join(' · ') : 'income'
  }
  return row.costType ?? 'expense'
}

export async function loadDriverLedgerEntries(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    teamMemberId: string
    dateFrom?: string | null
    dateTo?: string | null
    limit?: number
  },
): Promise<DriverLedgerEntry[]> {
  const filters: Record<string, unknown> = {
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    teamMemberId: params.teamMemberId,
    deletedAt: null,
  }
  if (params.dateFrom || params.dateTo) {
    const range: Record<string, Date> = {}
    if (params.dateFrom) range.$gte = new Date(`${params.dateFrom}T00:00:00`)
    if (params.dateTo) range.$lte = new Date(`${params.dateTo}T23:59:59`)
    filters.occurredAt = range
  }

  const rows = await findWithDecryption(
    em,
    TaxiFleetFinancialEntry,
    filters,
    { orderBy: { occurredAt: 'DESC' }, limit: params.limit ?? 500 },
    { tenantId: params.tenantId, organizationId: params.organizationId },
  )

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    incomeDocumentType: row.incomeDocumentType ?? null,
    costType: row.costType ?? null,
    label: buildEntryLabel(row),
    amount: row.amount,
    currencyCode: row.currencyCode,
    occurredAt: row.occurredAt.toISOString(),
    tripId: row.tripId ?? null,
    customerPersonId: row.customerPersonId ?? null,
    customerCompanyId: row.customerCompanyId ?? null,
    documentNumber: row.documentNumber ?? null,
    notes: row.notes ?? null,
  }))
}
