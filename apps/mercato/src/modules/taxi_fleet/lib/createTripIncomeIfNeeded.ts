import type { EntityManager } from '@mikro-orm/postgresql'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { TaxiFleetFinancialEntry } from '../data/entities'

export type TripIncomeCreateScope = {
  tenantId: string
  organizationId: string
  teamMemberId: string
  tripId: string
  revenueAmount?: number | string | null
  currencyCode?: string | null
  startedAt?: Date | string | null
  customerEntityId?: string | null
  customerPersonId?: string | null
  customerCompanyId?: string | null
}

/**
 * Creates trip income via command bus (emits `taxi_fleet.financial_entry.created`
 * → “Nowa faktura/paragon” mail). Returns null when prerequisites are missing.
 * Idempotent: returns an existing income entry for the trip without re-emitting.
 */
export async function createTripIncomeIfNeeded(params: {
  commandBus: CommandBus
  ctx: CommandRuntimeContext
  scoped: TripIncomeCreateScope
  receiptDocumentNumber?: string | null
  receiptAttachmentId?: string | null
}): Promise<string | null> {
  const revenueAmount =
    typeof params.scoped.revenueAmount === 'number'
      ? params.scoped.revenueAmount
      : Number(params.scoped.revenueAmount ?? 0)
  const hasCustomerLink = Boolean(
    params.scoped.customerEntityId ||
      params.scoped.customerPersonId ||
      params.scoped.customerCompanyId,
  )
  if (
    !params.scoped.tripId ||
    !params.scoped.teamMemberId ||
    !Number.isFinite(revenueAmount) ||
    revenueAmount <= 0 ||
    !hasCustomerLink ||
    (!params.receiptDocumentNumber && !params.receiptAttachmentId)
  ) {
    return null
  }

  const em = params.ctx.container.resolve('em') as EntityManager
  const existing = await em.findOne(TaxiFleetFinancialEntry, {
    tripId: params.scoped.tripId,
    tenantId: params.scoped.tenantId,
    organizationId: params.scoped.organizationId,
    kind: 'income',
    deletedAt: null,
  })
  if (existing) return existing.id

  const occurredAt =
    params.scoped.startedAt instanceof Date
      ? params.scoped.startedAt
      : typeof params.scoped.startedAt === 'string' && params.scoped.startedAt.trim()
        ? new Date(params.scoped.startedAt)
        : new Date()

  const created = await params.commandBus.execute('taxi_fleet.financial_entries.create', {
    input: {
      tenantId: params.scoped.tenantId,
      organizationId: params.scoped.organizationId,
      teamMemberId: params.scoped.teamMemberId,
      kind: 'income',
      incomeDocumentType: 'receipt',
      tripId: params.scoped.tripId,
      customerEntityId: params.scoped.customerEntityId ?? undefined,
      customerPersonId: params.scoped.customerPersonId ?? undefined,
      customerCompanyId: params.scoped.customerCompanyId ?? undefined,
      amount: revenueAmount,
      currencyCode: params.scoped.currencyCode ?? 'PLN',
      documentNumber: params.receiptDocumentNumber ?? null,
      occurredAt: Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt,
      receiptAttachmentId: params.receiptAttachmentId ?? null,
    },
    ctx: params.ctx,
  })
  return created?.result && typeof created.result === 'object' && 'entryId' in created.result
    ? String((created.result as { entryId: string }).entryId)
    : null
}
