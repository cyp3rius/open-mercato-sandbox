import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { resolveTaxiFleetPlatformSyncRunEntity } from '@/modules/taxi_fleet/lib/resolveTaxiFleetOrmEntity'
import { platformSyncRunsListSchema } from '@/modules/taxi_fleet/data/validators'
import { serializePlatformSyncRun } from '@/modules/taxi_fleet/lib/platformSync/executePlatformSyncRun'

export const metadata = {
  GET: {
    requireAuth: true,
    requireAnyFeatures: ['taxi_fleet.view', 'taxi_fleet.manage_platform_sync'],
  },
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
    const url = new URL(req.url)
    const query = platformSyncRunsListSchema.parse({
      page: url.searchParams.get('page') ?? undefined,
      pageSize: url.searchParams.get('pageSize') ?? undefined,
      platform: url.searchParams.get('platform') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
    })

    const tenantId = context.auth?.tenantId
    const organizationId = context.selectedOrganizationId ?? context.auth?.orgId
    if (!tenantId || !organizationId) throw new CrudHttpError(401, { error: 'Unauthorized' })

    const filters: Record<string, unknown> = {
      tenantId,
      organizationId,
      deletedAt: null,
    }
    if (query.platform) filters.platform = query.platform
    if (query.status) filters.status = query.status

    const em = context.container.resolve('em') as EntityManager
    const offset = (query.page - 1) * query.pageSize
    const PlatformSyncRun = resolveTaxiFleetPlatformSyncRunEntity()
    const [rows, total] = await Promise.all([
      findWithDecryption(
        em,
        PlatformSyncRun,
        filters,
        {
          orderBy: { startedAt: 'DESC' },
          limit: query.pageSize,
          offset,
        },
        { tenantId, organizationId },
      ),
      em.count(PlatformSyncRun, filters),
    ])

    const totalPages = Math.max(1, Math.ceil(total / query.pageSize))
    return NextResponse.json({
      items: rows.map(serializePlatformSyncRun),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages,
    })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.flatten() }, { status: 400 })
    }
    console.error('taxi_fleet.platform_sync.runs failed', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

const runItemSchema = z.object({
  id: z.string().uuid(),
  platform: z.string(),
  trigger: z.string(),
  status: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  fetchedCount: z.number(),
  upsertedCount: z.number(),
  createdCount: z.number().optional(),
  duplicateCount: z.number().optional(),
  skippedCount: z.number(),
  unmappedDriverSkippedCount: z.number().optional(),
  errorCount: z.number(),
})

export const openApi = {
  GET: {
    summary: 'List platform sync runs',
    tags: ['Taxi fleet platform sync'],
    responses: {
      200: {
        schema: z.object({
          items: z.array(runItemSchema),
          page: z.number(),
          pageSize: z.number(),
          total: z.number(),
          totalPages: z.number(),
        }),
      },
    },
  },
}
