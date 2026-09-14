import type { EntityManager } from '@mikro-orm/postgresql'
import { CustomFieldValue } from '@open-mercato/core/modules/entities/data/entities'
import { E } from '@/.mercato/generated/entities.ids.generated'
import {
  BpOpenFleetClient,
  filterAndSumBpTransactionsByCard,
  type BpNormalizedTransaction,
} from './client'
import { loadTaxiFleetOrganizationSettings } from '../taxiFleetOrganizationSettings'
import { getMonthEnd, normalizeDateOnly } from '../weekUtils'

export const BP_FUEL_CARD_CUSTOM_FIELD_KEY = 'bp_fuel_card_number'

export async function loadResourceBpFuelCardNumber(
  em: EntityManager,
  params: { tenantId: string; organizationId: string; resourceId: string },
): Promise<string | null> {
  const row = await em.findOne(CustomFieldValue, {
    entityId: E.resources.resources_resource,
    recordId: params.resourceId,
    fieldKey: BP_FUEL_CARD_CUSTOM_FIELD_KEY,
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    deletedAt: null,
  })
  const value = row?.valueText?.trim()
  return value && value.length ? value : null
}

export async function syncBpFuelCostForVehicleMonth(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    resourceId: string
    monthStart: string
  },
): Promise<{
  bpFuelCost: number
  transactionCount: number
  cardNumber: string
  transactions: BpNormalizedTransaction[]
  syncedAt: string
}> {
  const monthStart = normalizeDateOnly(params.monthStart)
  const monthEnd = getMonthEnd(monthStart)
  const cardNumber = await loadResourceBpFuelCardNumber(em, {
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    resourceId: params.resourceId,
  })
  if (!cardNumber) {
    throw new Error('MISSING_BP_FUEL_CARD')
  }

  const settings = await loadTaxiFleetOrganizationSettings(em, {
    tenantId: params.tenantId,
    organizationId: params.organizationId,
  })
  const client = new BpOpenFleetClient(settings.bpOpenFleet)
  const all = await client.listTransactions({
    startDateTime: `${monthStart}T00:00:00Z`,
    endDateTime: `${monthEnd}T23:59:59Z`,
  })
  const { matched, grossTotal } = filterAndSumBpTransactionsByCard(all, cardNumber)
  return {
    bpFuelCost: grossTotal,
    transactionCount: matched.length,
    cardNumber,
    transactions: matched,
    syncedAt: new Date().toISOString(),
  }
}
