import type { EntityManager } from '@mikro-orm/postgresql'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { StaffTeamMember } from '@open-mercato/core/modules/staff/data/entities'
import { TaxiFleetDriverProfile } from '../data/entities'

export type DriverContext = {
  teamMemberId: string
  teamMember: StaffTeamMember
  profile: TaxiFleetDriverProfile | null
}

export async function resolveDriverContext(
  ctx: CommandRuntimeContext,
  translate: (key: string, fallback?: string) => string,
  options?: { requireExternalApp?: boolean },
): Promise<DriverContext> {
  const auth = ctx.auth
  if (!auth?.sub) {
    throw new CrudHttpError(401, { error: translate('taxi_fleet.errors.unauthorized', 'Unauthorized') })
  }
  const tenantId = ctx.organizationScope?.tenantId ?? auth.tenantId ?? null
  const organizationId = ctx.selectedOrganizationId ?? ctx.organizationScope?.selectedId ?? auth.orgId ?? null
  const em = ctx.container.resolve('em') as EntityManager
  const member = await findOneWithDecryption(
    em,
    StaffTeamMember,
    { userId: auth.sub, deletedAt: null },
    undefined,
    { tenantId, organizationId },
  )
  if (!member) {
    throw new CrudHttpError(404, { error: translate('taxi_fleet.errors.driverNotLinked', 'Driver profile not linked to staff member.') })
  }
  const profile = await findOneWithDecryption(
    em,
    TaxiFleetDriverProfile,
    { teamMemberId: member.id, deletedAt: null },
    undefined,
    { tenantId, organizationId },
  )
  if (options?.requireExternalApp && profile && !profile.externalAppEnabled) {
    throw new CrudHttpError(403, { error: translate('taxi_fleet.errors.externalAppDisabled', 'External app access is disabled.') })
  }
  return { teamMemberId: member.id, teamMember: member, profile: profile ?? null }
}
