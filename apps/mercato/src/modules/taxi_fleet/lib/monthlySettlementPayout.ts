import type { EntityManager } from '@mikro-orm/postgresql'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetDriverProfile } from '../data/entities'
import { loadTaxiFleetOrganizationSettings } from './taxiFleetOrganizationSettings'
import { buildDriverPayoutSchedule, type DriverPayoutSchedule } from './settlementPayoutResolve'

export async function loadDriverPayoutScheduleForMember(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    teamMemberId: string
  },
): Promise<DriverPayoutSchedule | null> {
  const profile = await findOneWithDecryption(
    em,
    TaxiFleetDriverProfile,
    {
      teamMemberId: params.teamMemberId,
      deletedAt: null,
    },
    undefined,
    { tenantId: params.tenantId, organizationId: params.organizationId },
  )
  if (!profile) return null

  const settings = await loadTaxiFleetOrganizationSettings(em, {
    tenantId: params.tenantId,
    organizationId: params.organizationId,
  })

  return buildDriverPayoutSchedule({
    payoutMode: profile.payoutMode,
    payoutPercent: profile.payoutPercent,
    payoutTiersJson: profile.payoutTiersJson,
    defaultPayoutPercent: settings.defaultPayoutPercent,
  })
}
