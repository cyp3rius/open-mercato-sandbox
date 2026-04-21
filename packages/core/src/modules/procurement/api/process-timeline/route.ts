import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandRuntimeContext, CommandBus } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { parseScopedCommandInput } from '@open-mercato/shared/lib/api/scoped'
import { readJsonSafe } from '@open-mercato/shared/lib/http/readJsonSafe'
import {
  runCrudMutationGuardAfterSuccess,
  validateCrudMutationGuard,
} from '@open-mercato/shared/lib/crud/mutation-guard'
import { resolveAuthActorId } from '../../../customers/lib/interactionRequestContext'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { FilterQuery } from '@mikro-orm/core'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { User } from '@open-mercato/core/modules/auth/data/entities'
import { ProcurementProcessTimelineEvent } from '../../data/entities'
import {
  procurementTimelineAppendSchema,
  procurementTimelineDeleteSchema,
  procurementTimelineUpdateSchema,
  type ProcurementTimelineAppendInput,
  type ProcurementTimelineDeleteInput,
  type ProcurementTimelineUpdateInput,
} from '../../data/validators'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['procurement.processes.view'] },
  POST: {
    requireAuth: true,
    requireAnyFeatures: ['procurement.processes.manage', 'procurement.processes.handle'],
  },
  PUT: {
    requireAuth: true,
    requireAnyFeatures: ['procurement.processes.manage', 'procurement.processes.handle'],
  },
  DELETE: {
    requireAuth: true,
    requireAnyFeatures: ['procurement.processes.manage', 'procurement.processes.handle'],
  },
}

const listQuerySchema = z
  .object({
    processId: z.uuid(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortDir: z.enum(['asc', 'desc']).optional(),
  })
  .loose()

type TimelineRow = {
  id: string
  processId: string
  eventType: string
  message: string
  actorUserId: string | null
  /** Resolved display: name, email, or null if unknown */
  actorLabel: string | null
  metadata: Record<string, unknown> | null
  createdAt: string | null
  organizationId: string
  tenantId: string
}

function formatUserActorLabel(user: User): string {
  const name = typeof user.name === 'string' && user.name.trim().length ? user.name.trim() : ''
  if (name) return name
  const email = typeof user.email === 'string' && user.email.trim().length ? user.email.trim() : ''
  if (email) return email
  return String(user.id)
}

const toRow = (
  row: ProcurementProcessTimelineEvent,
  actorLabel: string | null,
): TimelineRow => {
  const proc = row.process
  const processId = typeof proc === 'string' ? proc : proc.id
  return {
    id: String(row.id),
    processId,
    eventType: row.eventType,
    message: row.message,
    actorUserId: row.actorUserId ?? null,
    actorLabel,
    metadata: row.metadata ? { ...row.metadata } : null,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    organizationId: String(row.organizationId),
    tenantId: String(row.tenantId),
  }
}

export async function GET(req: Request) {
  const auth = await getAuthFromRequest(req)
  if (!auth || !auth.tenantId || (!auth.orgId && !auth.isSuperAdmin)) {
    return NextResponse.json({ items: [], total: 0, page: 1, pageSize: 50, totalPages: 1 }, { status: 401 })
  }

  const url = new URL(req.url)
  const parsed = listQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()))
  if (!parsed.success) {
    return NextResponse.json({ items: [], total: 0, page: 1, pageSize: 50, totalPages: 1 }, { status: 400 })
  }

  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager

  const { processId, page, pageSize, sortDir } = parsed.data
  const filter: FilterQuery<ProcurementProcessTimelineEvent> = {
    tenantId: auth.tenantId,
    process: processId,
  }
  if (auth.orgId) {
    filter.organizationId = auth.orgId
  }

  const orderBy = { createdAt: sortDir === 'asc' ? ('ASC' as const) : ('DESC' as const) }
  const [all, total] = await em.findAndCount(ProcurementProcessTimelineEvent, filter, {
    orderBy,
    populate: ['process'],
  })
  const start = (page - 1) * pageSize
  const paged = all.slice(start, start + pageSize)
  const actorIds = [...new Set(paged.map((r) => r.actorUserId).filter((id): id is string => Boolean(id)))]
  const users =
    actorIds.length > 0
      ? await em.find(User, { id: { $in: actorIds as unknown as string[] }, deletedAt: null })
      : []
  const actorLabelById = new Map<string, string>()
  for (const u of users) {
    actorLabelById.set(u.id, formatUserActorLabel(u))
  }
  const items = paged.map((row) =>
    toRow(row, row.actorUserId ? actorLabelById.get(row.actorUserId) ?? null : null),
  )
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return NextResponse.json({ items, total, page, pageSize, totalPages })
}

export async function POST(req: Request) {
  try {
    const container = await createRequestContainer()
    const auth = await getAuthFromRequest(req)
    const { translate } = await resolveTranslations()
    if (!auth || !auth.tenantId) {
      throw new CrudHttpError(401, { error: translate('errors.unauthorized', 'Unauthorized') })
    }
    const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
    const ctx: CommandRuntimeContext = {
      container,
      auth,
      organizationScope: scope,
      selectedOrganizationId: scope?.selectedId ?? auth.orgId ?? null,
      organizationIds: scope?.filterIds ?? (auth.orgId ? [auth.orgId] : null),
      request: req,
    }
    const body = await readJsonSafe<Record<string, unknown>>(req, {})
    const input = parseScopedCommandInput(procurementTimelineAppendSchema, body, ctx, translate)
    const guardUserId = resolveAuthActorId(auth)
    const guardResult = await validateCrudMutationGuard(container, {
      tenantId: auth.tenantId,
      organizationId: ctx.selectedOrganizationId,
      userId: guardUserId,
      resourceKind: 'procurement.process',
      resourceId: input.processId,
      operation: 'custom',
      requestMethod: req.method,
      requestHeaders: req.headers,
      mutationPayload: { ...input } as Record<string, unknown>,
    })
    if (guardResult && !guardResult.ok) {
      return NextResponse.json(guardResult.body, { status: guardResult.status })
    }
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute<ProcurementTimelineAppendInput, { timelineEventId: string }>(
      'procurement.timeline.append',
      { input, ctx },
    )
    if (guardResult?.ok && guardResult.shouldRunAfterSuccess) {
      await runCrudMutationGuardAfterSuccess(container, {
        tenantId: auth.tenantId,
        organizationId: ctx.selectedOrganizationId,
        userId: guardUserId,
        resourceKind: 'procurement.process',
        resourceId: input.processId,
        operation: 'custom',
        requestMethod: req.method,
        requestHeaders: req.headers,
        metadata: guardResult.metadata ?? null,
      })
    }
    return NextResponse.json({ id: result?.timelineEventId ?? null, ok: true }, { status: 201 })
  } catch (err) {
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('errors.unexpected', 'Unexpected error') }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const container = await createRequestContainer()
    const auth = await getAuthFromRequest(req)
    const { translate } = await resolveTranslations()
    if (!auth || !auth.tenantId) {
      throw new CrudHttpError(401, { error: translate('errors.unauthorized', 'Unauthorized') })
    }
    const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
    const ctx: CommandRuntimeContext = {
      container,
      auth,
      organizationScope: scope,
      selectedOrganizationId: scope?.selectedId ?? auth.orgId ?? null,
      organizationIds: scope?.filterIds ?? (auth.orgId ? [auth.orgId] : null),
      request: req,
    }
    const body = await readJsonSafe<Record<string, unknown>>(req, {})
    const input = parseScopedCommandInput(procurementTimelineUpdateSchema, body, ctx, translate)
    const guardUserId = resolveAuthActorId(auth)
    const guardResult = await validateCrudMutationGuard(container, {
      tenantId: auth.tenantId,
      organizationId: ctx.selectedOrganizationId,
      userId: guardUserId,
      resourceKind: 'procurement.process',
      resourceId: input.processId,
      operation: 'custom',
      requestMethod: req.method,
      requestHeaders: req.headers,
      mutationPayload: { ...input } as Record<string, unknown>,
    })
    if (guardResult && !guardResult.ok) {
      return NextResponse.json(guardResult.body, { status: guardResult.status })
    }
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    await commandBus.execute<ProcurementTimelineUpdateInput, { ok: true }>('procurement.timeline.update', {
      input,
      ctx,
    })
    if (guardResult?.ok && guardResult.shouldRunAfterSuccess) {
      await runCrudMutationGuardAfterSuccess(container, {
        tenantId: auth.tenantId,
        organizationId: ctx.selectedOrganizationId,
        userId: guardUserId,
        resourceKind: 'procurement.process',
        resourceId: input.processId,
        operation: 'custom',
        requestMethod: req.method,
        requestHeaders: req.headers,
        metadata: guardResult.metadata ?? null,
      })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('errors.unexpected', 'Unexpected error') }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const container = await createRequestContainer()
    const auth = await getAuthFromRequest(req)
    const { translate } = await resolveTranslations()
    if (!auth || !auth.tenantId) {
      throw new CrudHttpError(401, { error: translate('errors.unauthorized', 'Unauthorized') })
    }
    const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
    const ctx: CommandRuntimeContext = {
      container,
      auth,
      organizationScope: scope,
      selectedOrganizationId: scope?.selectedId ?? auth.orgId ?? null,
      organizationIds: scope?.filterIds ?? (auth.orgId ? [auth.orgId] : null),
      request: req,
    }
    const url = new URL(req.url)
    const raw = Object.fromEntries(url.searchParams.entries())
    const input = parseScopedCommandInput(procurementTimelineDeleteSchema, raw, ctx, translate)
    const guardUserId = resolveAuthActorId(auth)
    const guardResult = await validateCrudMutationGuard(container, {
      tenantId: auth.tenantId,
      organizationId: ctx.selectedOrganizationId,
      userId: guardUserId,
      resourceKind: 'procurement.process',
      resourceId: input.processId,
      operation: 'custom',
      requestMethod: req.method,
      requestHeaders: req.headers,
      mutationPayload: { ...input } as Record<string, unknown>,
    })
    if (guardResult && !guardResult.ok) {
      return NextResponse.json(guardResult.body, { status: guardResult.status })
    }
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    await commandBus.execute<ProcurementTimelineDeleteInput, { ok: true }>('procurement.timeline.delete', {
      input,
      ctx,
    })
    if (guardResult?.ok && guardResult.shouldRunAfterSuccess) {
      await runCrudMutationGuardAfterSuccess(container, {
        tenantId: auth.tenantId,
        organizationId: ctx.selectedOrganizationId,
        userId: guardUserId,
        resourceKind: 'procurement.process',
        resourceId: input.processId,
        operation: 'custom',
        requestMethod: req.method,
        requestHeaders: req.headers,
        metadata: guardResult.metadata ?? null,
      })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('errors.unexpected', 'Unexpected error') }, { status: 500 })
  }
}

const appendBodySchema = z.object({
  tenantId: z.uuid(),
  organizationId: z.uuid(),
  processId: z.uuid(),
  eventType: z.string().min(1).max(120),
  message: z.string().min(1).max(8000),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

const updateBodySchema = z.object({
  tenantId: z.uuid(),
  organizationId: z.uuid(),
  processId: z.uuid(),
  id: z.uuid(),
  message: z.string().min(1).max(8000),
})

const deleteQuerySchema = z.object({
  tenantId: z.uuid().optional(),
  organizationId: z.uuid().optional(),
  processId: z.uuid(),
  id: z.uuid(),
})

export const openApi: OpenApiRouteDoc = {
  methods: {
    GET: {
      summary: 'List procurement timeline events',
      description: 'Returns timeline entries for a single procurement process (newest first by default).',
      tags: ['Procurement'],
      security: ['bearerAuth'],
      query: listQuerySchema,
      responses: [
        {
          status: 200,
          description: 'Paginated timeline',
          schema: z.object({
            items: z.array(
              z.object({
                id: z.uuid(),
                processId: z.uuid(),
                eventType: z.string(),
                message: z.string(),
                actorUserId: z.uuid().nullable(),
                actorLabel: z.string().nullable(),
                metadata: z.record(z.string(), z.unknown()).nullable(),
                createdAt: z.string().nullable(),
                organizationId: z.uuid(),
                tenantId: z.uuid(),
              }),
            ),
            total: z.number(),
            page: z.number(),
            pageSize: z.number(),
            totalPages: z.number(),
          }),
        },
      ],
    },
    POST: {
      summary: 'Append procurement timeline event',
      description: 'Records a custom timeline message on a process.',
      tags: ['Procurement'],
      security: ['bearerAuth'],
      requestBody: {
        schema: appendBodySchema,
      },
      responses: [
        {
          status: 201,
          description: 'Created',
          schema: z.object({
            ok: z.literal(true),
            id: z.uuid().nullable(),
          }),
        },
      ],
    },
    PUT: {
      summary: 'Update procurement timeline note',
      description:
        'Updates the message of a timeline row with eventType "note". System events (e.g. process.created) cannot be edited.',
      tags: ['Procurement'],
      security: ['bearerAuth'],
      requestBody: {
        schema: updateBodySchema,
      },
      responses: [
        {
          status: 200,
          description: 'Updated',
          schema: z.object({ ok: z.literal(true) }),
        },
      ],
    },
    DELETE: {
      summary: 'Delete procurement timeline note',
      description:
        'Deletes a timeline row with eventType "note". Query uses processId and timeline event id; tenant and organization are taken from auth scope when omitted.',
      tags: ['Procurement'],
      security: ['bearerAuth'],
      query: deleteQuerySchema,
      responses: [
        {
          status: 200,
          description: 'Deleted',
          schema: z.object({ ok: z.literal(true) }),
        },
      ],
    },
  },
}
