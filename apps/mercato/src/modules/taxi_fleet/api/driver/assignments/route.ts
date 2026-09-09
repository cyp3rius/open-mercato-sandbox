import { NextResponse } from 'next/server'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetDailyAssignment } from '@/modules/taxi_fleet/data/entities'
import { resolveDriverContext } from '@/modules/taxi_fleet/lib/driverContext'
import { resolveDriverResourceLabelInfos } from '@/modules/taxi_fleet/lib/resolveDriverResourceLabel'

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
    const url = new URL(req.url)
    const dateFrom = url.searchParams.get('dateFrom') ?? undefined
    const dateTo = url.searchParams.get('dateTo') ?? undefined
    const filters: Record<string, unknown> = {
      teamMemberId: driver.teamMemberId,
      deletedAt: null,
    }
    if (dateFrom || dateTo) {
      const range: Record<string, string> = {}
      if (dateFrom) range.$gte = dateFrom
      if (dateTo) range.$lte = dateTo
      filters.assignmentDate = range
    }
    const em = context.container.resolve('em') as EntityManager
    const items = await findWithDecryption(
      em,
      TaxiFleetDailyAssignment,
      filters,
      undefined,
      { tenantId: driver.teamMember.tenantId, organizationId: driver.teamMember.organizationId },
    )
    const labels = await resolveDriverResourceLabelInfos(
      em,
      items.map((row) => row.resourceId),
      { tenantId: driver.teamMember.tenantId, organizationId: driver.teamMember.organizationId },
    )
    return NextResponse.json({
      items: items.map((row) => {
        const info = labels.get(row.resourceId)
        return {
          id: row.id,
          resourceId: row.resourceId,
          resourceLabel: info?.label ?? null,
          resourceName: info?.name ?? null,
          resourcePlate: info?.plate ?? null,
          assignmentDate: row.assignmentDate,
          status: row.status,
          plannedShiftStart: row.plannedShiftStart?.toISOString() ?? null,
          plannedShiftEnd: row.plannedShiftEnd?.toISOString() ?? null,
          shiftStart: row.shiftStart?.toISOString() ?? null,
          shiftEnd: row.shiftEnd?.toISOString() ?? null,
          gpsDistanceKm: row.gpsDistanceKm ?? null,
        }
      }),
    })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('taxi_fleet.driver.assignments failed', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
