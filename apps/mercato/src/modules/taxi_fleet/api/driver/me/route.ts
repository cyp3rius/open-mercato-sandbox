import { NextResponse } from 'next/server'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetDailyAssignment } from '@/modules/taxi_fleet/data/entities'
import { resolveDriverContext } from '@/modules/taxi_fleet/lib/driverContext'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['taxi_fleet.driver'] },
}

async function buildContext(req: Request): Promise<CommandRuntimeContext> {
  const container = await createRequestContainer()
  const auth = await getAuthFromRequest(req)
  if (!auth) throw new CrudHttpError(401, { error: 'Unauthorized' })
  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  return {
    container,
    auth,
    organizationScope: scope,
    selectedOrganizationId: scope?.selectedId ?? auth.orgId ?? null,
    organizationIds: scope?.filterIds ?? (auth.orgId ? [auth.orgId] : null),
    request: req,
  }
}

export async function GET(req: Request) {
  try {
    const context = await buildContext(req)
    const { translate } = await resolveTranslations()
    const driver = await resolveDriverContext(context, translate, { requireExternalApp: true })
    const today = new Date().toISOString().slice(0, 10)
    const em = context.container.resolve('em') as EntityManager
    const assignment = await findOneWithDecryption(
      em,
      TaxiFleetDailyAssignment,
      {
        teamMemberId: driver.teamMemberId,
        assignmentDate: today,
        deletedAt: null,
        status: { $ne: 'cancelled' },
      },
      undefined,
      { tenantId: driver.teamMember.tenantId, organizationId: driver.teamMember.organizationId },
    )
    return NextResponse.json({
      member: {
        id: driver.teamMember.id,
        displayName: driver.teamMember.displayName,
        userId: driver.teamMember.userId ?? null,
      },
      profile: driver.profile
        ? {
            id: driver.profile.id,
            payoutPercent: driver.profile.payoutPercent,
            defaultResourceId: driver.profile.defaultResourceId ?? null,
            externalAppEnabled: driver.profile.externalAppEnabled,
          }
        : null,
      todayAssignment: assignment
        ? {
            id: assignment.id,
            resourceId: assignment.resourceId,
            assignmentDate: assignment.assignmentDate,
            status: assignment.status,
            shiftStart: assignment.shiftStart?.toISOString() ?? null,
            shiftEnd: assignment.shiftEnd?.toISOString() ?? null,
          }
        : null,
    })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('taxi_fleet.driver.me failed', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
