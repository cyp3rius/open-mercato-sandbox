import { NextResponse } from 'next/server'
import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { FilterQuery } from '@mikro-orm/core'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { ProcurementProcessTask } from '../../data/entities'
import { procurementTaskCreateSchema, procurementTaskUpdateSchema } from '../../data/validators'
import {
  buildProcurementCrudOpenApi,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from '../openapi'
import { mergeProcurementCommandScope } from '../mergeScope'

const routeMetadata = {
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

export const metadata = routeMetadata

const rawBodySchema = z.object({}).loose()
type CrudInput = Record<string, unknown>

const crud = makeCrudRoute<CrudInput, CrudInput, Record<string, unknown>>({
  metadata: routeMetadata,
  orm: {
    entity: ProcurementProcessTask,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: {
    module: 'procurement',
    entity: 'process_task',
    persistent: true,
  },
  actions: {
    create: {
      commandId: 'procurement.process_tasks.create',
      schema: rawBodySchema,
      mapInput: ({ parsed, ctx }) => mergeProcurementCommandScope(parsed as Record<string, unknown>, ctx),
      response: ({ result }) => ({ id: String((result as { taskId: string }).taskId) }),
      status: 201,
    },
    update: {
      commandId: 'procurement.process_tasks.update',
      schema: rawBodySchema,
      mapInput: ({ parsed, ctx }) => mergeProcurementCommandScope(parsed as Record<string, unknown>, ctx),
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'procurement.process_tasks.delete',
      schema: rawBodySchema,
      mapInput: ({ raw, ctx }) => ({
        id: ((raw as Record<string, unknown>).query as Record<string, unknown> | undefined)?.id as
          | string
          | undefined,
      }),
      response: () => ({ ok: true }),
    },
  },
})

const listQuerySchema = z
  .object({
    id: z.uuid().optional(),
    processId: z.uuid().optional(),
    supplierId: z.uuid().optional(),
    assignedUserId: z.uuid().optional(),
    taskStatus: z.enum(['open', 'done', 'cancelled']).optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.enum(['title', 'dueAt', 'createdAt', 'updatedAt', 'taskStatus']).optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
  })
  .loose()

type TaskRow = {
  id: string
  processId: string
  supplierId: string | null
  title: string
  body: string | null
  taskStatus: string
  dueAt: string | null
  assignedUserId: string | null
  delegatedFromUserId: string | null
  sourceActionValue: string | null
  createdAt: string | null
  updatedAt: string | null
  organizationId: string
  tenantId: string
}

const toRow = (row: ProcurementProcessTask): TaskRow => {
  const proc = row.process
  const processId = typeof proc === 'string' ? proc : proc.id
  const sup = row.supplier
  const supplierId =
    sup === null || sup === undefined ? null : typeof sup === 'string' ? sup : sup.id
  return {
    id: String(row.id),
    processId,
    supplierId,
    title: row.title,
    body: row.body ?? null,
    taskStatus: row.taskStatus,
    dueAt: row.dueAt ? row.dueAt.toISOString() : null,
    assignedUserId: row.assignedUserId ?? null,
    delegatedFromUserId: row.delegatedFromUserId ?? null,
    sourceActionValue: row.sourceActionValue ?? null,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
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

  const { id, processId, supplierId, assignedUserId, taskStatus, page, pageSize, sortField, sortDir } =
    parsed.data
  const filter: FilterQuery<ProcurementProcessTask> = {
    tenantId: auth.tenantId,
    deletedAt: null,
  }
  if (auth.orgId) {
    filter.organizationId = auth.orgId
  }

  if (id) filter.id = id
  if (processId) filter.process = processId
  if (supplierId) filter.supplier = supplierId
  if (assignedUserId) filter.assignedUserId = assignedUserId
  if (taskStatus) filter.taskStatus = taskStatus

  const fieldMap: Record<string, string> = {
    title: 'title',
    dueAt: 'dueAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    taskStatus: 'taskStatus',
  }
  const orderBy: Record<string, 'ASC' | 'DESC'> = {}
  if (sortField) {
    const mapped = fieldMap[sortField] || 'dueAt'
    orderBy[mapped] = sortDir === 'desc' ? 'DESC' : 'ASC'
  } else {
    orderBy.dueAt = 'ASC'
  }

  const [all, total] = await em.findAndCount(ProcurementProcessTask, filter, {
    orderBy,
    populate: ['process', 'supplier'],
  })
  const start = (page - 1) * pageSize
  const paged = all.slice(start, start + pageSize)
  const items = paged.map(toRow)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return NextResponse.json({ items, total, page, pageSize, totalPages })
}

export const POST = crud.POST
export const PUT = crud.PUT
export const DELETE = crud.DELETE

const taskListSchema = z.object({
  id: z.uuid(),
  processId: z.uuid(),
  supplierId: z.uuid().nullable(),
  title: z.string(),
  body: z.string().nullable(),
  taskStatus: z.string(),
  dueAt: z.string().nullable(),
  assignedUserId: z.uuid().nullable(),
  delegatedFromUserId: z.uuid().nullable(),
  sourceActionValue: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  organizationId: z.uuid(),
  tenantId: z.uuid(),
})

export const openApi = buildProcurementCrudOpenApi({
  resourceName: 'Procurement process task',
  pluralName: 'Procurement process tasks',
  querySchema: listQuerySchema,
  listResponseSchema: createPagedListResponseSchema(taskListSchema),
  create: {
    schema: procurementTaskCreateSchema,
    description: 'Creates a follow-up task on a procurement process.',
  },
  update: {
    schema: procurementTaskUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates a procurement task.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes a procurement task.',
  },
})
