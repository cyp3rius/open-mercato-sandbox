import type { EntityManager } from '@mikro-orm/postgresql'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetDriverProfile } from '../../data/entities'
import type { TaxiFleetTripPlatform } from '../tripPlatforms'
import { platformDriverProfileField } from './types'

export async function resolveTeamMemberForPlatformDriver(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    platform: TaxiFleetTripPlatform
    platformDriverId: string
  },
): Promise<string | null> {
  const field = platformDriverProfileField(params.platform)
  const profile = await findOneWithDecryption(
    em,
    TaxiFleetDriverProfile,
    {
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      deletedAt: null,
      [field]: params.platformDriverId,
    },
    undefined,
    { tenantId: params.tenantId, organizationId: params.organizationId },
  )
  return profile?.teamMemberId ?? null
}
