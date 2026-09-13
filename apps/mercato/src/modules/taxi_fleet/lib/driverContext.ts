import type { EntityManager } from '@mikro-orm/postgresql'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { StaffTeamMember } from '@open-mercato/core/modules/staff/data/entities'
import { TaxiFleetDriverProfile } from '../data/entities'
import {
  actorCanImpersonateDriver,
  readDriverImpersonationTeamMemberId,
} from './driverImpersonation'

export type DriverContext = {
  teamMemberId: string
  teamMember: StaffTeamMember
  profile: TaxiFleetDriverProfile | null
  impersonating: boolean
  actorUserId: string
}

export function assertDriverMutationAllowed(
  driver: DriverContext,
  translate: (key: string, fallback?: string) => string,
): void {
  if (!driver.impersonating) return
  throw new CrudHttpError(403, {
    error: translate(
      'taxi_fleet.driverApp.impersonation.readOnlyError',
      'Driver app is in read-only preview mode. Mutations are disabled.',
    ),
  })
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
  const impersonateTeamMemberId = readDriverImpersonationTeamMemberId(ctx.request ?? null)

  if (impersonateTeamMemberId) {
    const canImpersonate = await actorCanImpersonateDriver(ctx)
    if (!canImpersonate) {
      throw new CrudHttpError(403, {
        error: translate(
          'taxi_fleet.driverApp.impersonation.forbidden',
          'You are not allowed to preview the driver app.',
        ),
      })
    }
    const member = await findOneWithDecryption(
      em,
      StaffTeamMember,
      { id: impersonateTeamMemberId, deletedAt: null },
      undefined,
      { tenantId, organizationId },
    )
    if (!member) {
      throw new CrudHttpError(404, {
        error: translate('taxi_fleet.errors.driverNotLinked', 'Driver profile not linked to staff member.'),
      })
    }
    const profile = await findOneWithDecryption(
      em,
      TaxiFleetDriverProfile,
      { teamMemberId: member.id, deletedAt: null },
      undefined,
      { tenantId, organizationId },
    )
    return {
      teamMemberId: member.id,
      teamMember: member,
      profile: profile ?? null,
      impersonating: true,
      actorUserId: auth.sub,
    }
  }

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
  return {
    teamMemberId: member.id,
    teamMember: member,
    profile: profile ?? null,
    impersonating: false,
    actorUserId: auth.sub,
  }
}

export async function resolveDriverContextForMutation(
  ctx: CommandRuntimeContext,
  translate: (key: string, fallback?: string) => string,
  options?: { requireExternalApp?: boolean },
): Promise<DriverContext> {
  const driver = await resolveDriverContext(ctx, translate, options)
  assertDriverMutationAllowed(driver, translate)
  return driver
}
