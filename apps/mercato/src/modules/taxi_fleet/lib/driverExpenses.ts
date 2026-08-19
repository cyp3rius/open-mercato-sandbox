import type { TaxiFleetFinancialEntry } from '../data/entities'
import type { DriverExpenseCreateInput } from '../data/validators'

export type DriverExpenseListItem = {
  id: string
  kind: 'expense'
  costType: string | null
  amount: string
  vatRatePercent: string
  currencyCode: string
  documentNumber: string | null
  occurredAt: string | null
  notes: string | null
  tripId: string | null
  receiptAttachmentId: string | null
  pending?: boolean
}

export function serializeDriverExpense(row: TaxiFleetFinancialEntry): DriverExpenseListItem {
  return {
    id: row.id,
    kind: 'expense',
    costType: row.costType ?? null,
    amount: row.amount,
    vatRatePercent: row.vatRatePercent ?? '23',
    currencyCode: row.currencyCode,
    documentNumber: row.documentNumber ?? null,
    occurredAt: row.occurredAt ? row.occurredAt.toISOString() : null,
    notes: row.notes ?? null,
    tripId: row.tripId ?? null,
    receiptAttachmentId: row.receiptAttachmentId ?? null,
  }
}

export function mapDriverExpenseToCreateInput(
  parsed: DriverExpenseCreateInput,
  scope: { tenantId: string; organizationId: string; teamMemberId: string },
) {
  return {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    teamMemberId: scope.teamMemberId,
    kind: 'expense' as const,
    costType: parsed.costType,
    amount: parsed.amount,
    vatRatePercent: parsed.vatRatePercent ?? 23,
    currencyCode: parsed.currencyCode ?? 'PLN',
    documentNumber: parsed.documentNumber ?? null,
    occurredAt: parsed.occurredAt ?? new Date(),
    receiptAttachmentId: parsed.receiptAttachmentId ?? null,
    notes: parsed.notes ?? null,
    tripId: parsed.tripId ?? null,
  }
}
