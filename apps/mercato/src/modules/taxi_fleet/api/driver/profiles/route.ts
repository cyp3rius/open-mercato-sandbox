import { NextResponse } from 'next/server'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { StaffTeamMember } from '@open-mercato/core/modules/staff/data/entities'
import { TaxiFleetDriverProfile } from '@/modules/taxi_fleet/data/entities'
import { resolveDriverContext } from '@/modules/taxi_fleet/lib/driverContext'
import { resolveDriverDefaultResourceIds } from '@/modules/taxi_fleet/lib/driverDefaultResources'
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

/**
 * Fleet directory for the driver PWA offline cache: every external-app driver
 * in the org with default vehicles. Used when /me is missing offline (settings /
 * shift vehicle picker fallback). Download replaces the local snapshot.
 */
export async function GET(req: Request) {
  try {
    const context = await buildContext(req)
    const { translate } = await resolveTranslations()
    const driver = await resolveDriverContext(context, translate, { requireExternalApp: true })
    const em = context.container.resolve('em') as EntityManager
    const scope = {
      tenantId: driver.teamMember.tenantId,
      organizationId: driver.teamMember.organizationId,
    }

    const profiles = await findWithDecryption(
      em,
      TaxiFleetDriverProfile,
      { deletedAt: null, externalAppEnabled: true },
      { orderBy: { updatedAt: 'DESC' }, limit: 200 },
      scope,
    )

    const memberIds = profiles.map((row) => row.teamMemberId)
    const members = memberIds.length
      ? await findWithDecryption(
          em,
          StaffTeamMember,
          { id: { $in: memberIds }, deletedAt: null },
          undefined,
          scope,
        )
      : []
    const memberById = new Map(members.map((row) => [row.id, row]))

    const allResourceIds = [
      ...new Set(profiles.flatMap((row) => resolveDriverDefaultResourceIds(row))),
    ]
    const resourceInfos = await resolveDriverResourceLabelInfos(em, allResourceIds, scope)

    const items = profiles
      .map((profile) => {
        const member = memberById.get(profile.teamMemberId)
        if (!member) return null
        const defaultIds = resolveDriverDefaultResourceIds(profile)
        const defaultResourceIds = defaultIds.map((id) => {
          const info = resourceInfos.get(id)
          return {
            id,
            label: info?.label ?? id,
            name: info?.name ?? null,
            plate: info?.plate ?? null,
            available: true,
          }
        })
        return {
          id: profile.id,
          teamMemberId: profile.teamMemberId,
          userId: member.userId ?? null,
          displayName: member.displayName,
          externalAppEnabled: true as const,
          defaultResourceId: defaultResourceIds[0]?.id ?? null,
          defaultResourceIds,
        }
      })
      .filter((row): row is NonNullable<typeof row> => row != null)

    return NextResponse.json({ items, total: items.length })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('taxi_fleet.driver.profiles failed', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const openApi = {
  GET: {
    summary: 'List fleet driver profiles for offline driver PWA cache',
    tags: ['Taxi fleet driver'],
  },
}

export default GET
