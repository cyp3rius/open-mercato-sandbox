import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetDriverProfile } from '../data/entities'

export async function assertTeamMemberHasDriverProfile(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    teamMemberId: string
    translate: (key: string, fallback?: string) => string
  },
): Promise<TaxiFleetDriverProfile> {
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
  if (!profile) {
    throw new CrudHttpError(400, {
      error: params.translate(
        'taxi_fleet.errors.notDriverProfile',
        'Selected employee does not have a driver profile. Create one under Driver profiles.',
      ),
      code: 'NOT_DRIVER_PROFILE',
    })
  }
  return profile
}
