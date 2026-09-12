import type { EntityManager } from '@mikro-orm/postgresql'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { TaxiFleetTrip } from '../data/entities'
import { resolveTripCustomerLink } from './customerLink.server'
import { assertTeamMemberHasDriverProfile } from './driverProfileGuard'

type FinancialCustomerInput = {
  customerPersonId?: string | null
  customerCompanyId?: string | null
  customerEntityId?: string | null
  tripId?: string | null
}

export async function resolveFinancialEntryCustomer(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    teamMemberId: string
    kind: 'income' | 'expense'
    tripId?: string | null
    customerPersonId?: string | null
    customerCompanyId?: string | null
    customerEntityId?: string | null
  },
): Promise<{ customerPersonId: string | null; customerCompanyId: string | null; tripId: string | null }> {
  const { translate } = await resolveTranslations()
  let tripId = params.tripId ?? null
  let customerPersonId = params.customerPersonId ?? null
  let customerCompanyId = params.customerCompanyId ?? null

  if (tripId) {
    const trip = await findOneWithDecryption(
      em,
      TaxiFleetTrip,
      { id: tripId, deletedAt: null },
      undefined,
      { tenantId: params.tenantId, organizationId: params.organizationId },
    )
    if (!trip) throw new CrudHttpError(404, { error: translate('taxi_fleet.trips.notFound', 'Trip not found.') })
    if (trip.teamMemberId !== params.teamMemberId) {
      throw new CrudHttpError(400, { error: translate('taxi_fleet.financial.errors.tripDriverMismatch', 'Trip belongs to another driver.') })
    }
    if (!customerPersonId && !customerCompanyId) {
      customerPersonId = trip.customerPersonId ?? null
      customerCompanyId = trip.customerCompanyId ?? null
    }
  }

  if (params.kind === 'income') {
    const customer = await resolveTripCustomerLink(
      em,
      {
        customerPersonId,
        customerCompanyId,
        customerEntityId: params.customerEntityId,
      },
      { tenantId: params.tenantId, organizationId: params.organizationId },
      { required: true },
    )
    return {
      customerPersonId: customer.customerPersonId,
      customerCompanyId: customer.customerCompanyId,
      tripId,
    }
  }

  return { customerPersonId, customerCompanyId, tripId }
}

export async function assertFinancialEntryDriver(
  em: EntityManager,
  params: { tenantId: string; organizationId: string; teamMemberId: string },
) {
  const { translate } = await resolveTranslations()
  await assertTeamMemberHasDriverProfile(em, {
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    teamMemberId: params.teamMemberId,
    translate,
  })
}
