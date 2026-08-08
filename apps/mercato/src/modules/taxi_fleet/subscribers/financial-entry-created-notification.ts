import type { EntityManager } from '@mikro-orm/postgresql'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetDriverProfile } from '../data/entities'
import {
  buildDriverProfileLink,
  notifyTaxiFleetBroadcast,
} from '../lib/taxiFleetNotificationDelivery'

export const metadata = {
  event: 'taxi_fleet.financial_entry.created',
  persistent: true,
  id: 'taxi_fleet:financial-entry-created-notification',
}

type FinancialEntryCreatedPayload = {
  id: string
  tenantId: string
  organizationId: string
  teamMemberId: string
  kind: 'income' | 'expense'
  incomeDocumentType?: string | null
  costType?: string | null
  amount?: string
  currencyCode?: string
  documentNumber?: string | null
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export default async function handle(payload: FinancialEntryCreatedPayload, ctx: ResolverContext) {
  if (!payload.id || !payload.tenantId || !payload.organizationId || !payload.teamMemberId) return

  const em = ctx.resolve<EntityManager>('em')
  const profile = await findOneWithDecryption(
    em,
    TaxiFleetDriverProfile,
    {
      teamMemberId: payload.teamMemberId,
      tenantId: payload.tenantId,
      organizationId: payload.organizationId,
      deletedAt: null,
    },
    undefined,
    { tenantId: payload.tenantId, organizationId: payload.organizationId },
  )
  const driverProfileId = profile?.id ?? payload.teamMemberId
  const notificationType =
    payload.kind === 'income'
      ? 'taxi_fleet.financial_entry.income_created'
      : 'taxi_fleet.financial_entry.expense_created'

  const variables = {
    documentNumber: payload.documentNumber?.trim() || '—',
    amount: payload.amount ?? '',
    currencyCode: payload.currencyCode ?? 'PLN',
    documentType: payload.incomeDocumentType ?? payload.costType ?? '',
  }

  await notifyTaxiFleetBroadcast(ctx, {
    notificationType,
    tenantId: payload.tenantId,
    organizationId: payload.organizationId,
    titleVariables: variables,
    bodyVariables: {
      ...variables,
      driverProfileId,
    },
    sourceEntityType: 'taxi_fleet:financial_entry',
    sourceEntityId: payload.id,
    linkHref: buildDriverProfileLink(driverProfileId),
    logLabel: 'taxi_fleet:financial-entry-created-notification',
  })
}
