import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { TaxiFleetDriverCommunicationRecipient } from '@/modules/taxi_fleet/data/entities'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['taxi_fleet.manage_driver_communications'] },
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

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const context = await buildContext(req)
    const tenantId = context.auth?.tenantId
    const organizationId = context.selectedOrganizationId ?? context.auth?.orgId
    if (!tenantId || !organizationId) throw new CrudHttpError(400, { error: 'Missing scope' })

    const em = context.container.resolve('em') as EntityManager
    const recipients = await em.find(
      TaxiFleetDriverCommunicationRecipient,
      {
        communicationId: id,
        tenantId,
        organizationId,
      },
      { orderBy: { createdAt: 'asc' } },
    )

    return NextResponse.json({
      items: recipients.map((row) => ({
        id: row.id,
        teamMemberId: row.teamMemberId,
        userId: row.userId,
        deliveryStatus: row.deliveryStatus,
        readAt: row.readAt?.toISOString() ?? null,
        lastError: row.lastError ?? null,
        attemptCount: row.attemptCount,
        lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
      })),
    })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const openApi = {
  GET: {
    summary: 'List communication recipients',
    tags: ['Taxi fleet'],
    responses: {
      200: {
        schema: z.object({
          items: z.array(
            z.object({
              id: z.string().uuid(),
              teamMemberId: z.string().uuid(),
              deliveryStatus: z.string(),
            }),
          ),
        }),
      },
    },
  },
}
