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
import { resolveDriverResourceLabelInfo } from '@/modules/taxi_fleet/lib/resolveDriverResourceLabel'
import { formatDateInTimeZone } from '@/modules/taxi_fleet/lib/shiftGraceWindow'
import { loadTaxiFleetOrganizationSettings } from '@/modules/taxi_fleet/lib/taxiFleetOrganizationSettings'

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
    const em = context.container.resolve('em') as EntityManager
    const settings = await loadTaxiFleetOrganizationSettings(em, {
      tenantId: driver.teamMember.tenantId,
      organizationId: driver.teamMember.organizationId,
    })
    const today = formatDateInTimeZone(new Date(), settings.calendar.timezone || 'Europe/Warsaw')
    let assignment = await findOneWithDecryption(
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
    if (!assignment) {
      assignment = await findOneWithDecryption(
        em,
        TaxiFleetDailyAssignment,
        {
          teamMemberId: driver.teamMemberId,
          deletedAt: null,
          shiftStart: { $ne: null },
          shiftEnd: null,
          status: { $ne: 'cancelled' },
        },
        { orderBy: { shiftStart: 'DESC' } },
        { tenantId: driver.teamMember.tenantId, organizationId: driver.teamMember.organizationId },
      )
    }
    const scope = {
      tenantId: driver.teamMember.tenantId,
      organizationId: driver.teamMember.organizationId,
    }
    const resourceInfo = assignment
      ? await resolveDriverResourceLabelInfo(em, assignment.resourceId, scope)
      : null
    const defaultResourceInfo = driver.profile?.defaultResourceId
      ? await resolveDriverResourceLabelInfo(em, driver.profile.defaultResourceId, scope)
      : null
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
            defaultResourceLabel: defaultResourceInfo?.label ?? null,
            defaultResourcePlate: defaultResourceInfo?.plate ?? null,
            externalAppEnabled: driver.profile.externalAppEnabled,
          }
        : null,
      todayAssignment: assignment
        ? {
            id: assignment.id,
            resourceId: assignment.resourceId,
            resourceLabel: resourceInfo?.label ?? null,
            resourcePlate: resourceInfo?.plate ?? null,
            assignmentDate: assignment.assignmentDate,
            status: assignment.status,
            plannedShiftStart: assignment.plannedShiftStart?.toISOString() ?? null,
            plannedShiftEnd: assignment.plannedShiftEnd?.toISOString() ?? null,
            shiftStart: assignment.shiftStart?.toISOString() ?? null,
            shiftEnd: assignment.shiftEnd?.toISOString() ?? null,
            gpsDistanceKm: assignment.gpsDistanceKm ?? null,
          }
        : null,
    })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('taxi_fleet.driver.me failed', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
