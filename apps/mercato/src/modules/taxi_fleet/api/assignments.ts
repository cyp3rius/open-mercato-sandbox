import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { resolveCrudRecordId, parseScopedCommandInput } from '@open-mercato/shared/lib/api/scoped'
import { TaxiFleetDailyAssignment } from '../data/entities'
import { assignmentCreateSchema, assignmentUpdateSchema } from '../data/validators'
import {
  createTaxiFleetCrudOpenApi,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from './openapi'

import { applyFleetDriverListScope } from '../lib/backendFleetActor'
import { transformAssignmentListItem } from '../lib/listItemFields'

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['taxi_fleet.view'] },
  POST: { requireAuth: true, requireFeatures: ['taxi_fleet.manage_assignments'] },
  PUT: { requireAuth: true, requireFeatures: ['taxi_fleet.manage_assignments'] },
  DELETE: { requireAuth: true, requireFeatures: ['taxi_fleet.manage_assignments'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()

const listSchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(500).default(50),
    ids: z.string().optional(),
    teamMemberId: z.string().uuid().optional(),
    resourceId: z.string().uuid().optional(),
    assignmentDate: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    status: z.string().optional(),
    sortField: z.string().optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
  })
  .passthrough()

const parseIds = (value?: string) => {
  if (!value) return []
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: TaxiFleetDailyAssignment,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  list: {
    schema: listSchema,
    fields: [
      'id',
      'organization_id',
      'tenant_id',
      'team_member_id',
      'resource_id',
      'assignment_date',
      'shift_start',
      'shift_end',
      'status',
      'notes',
      'created_at',
      'updated_at',
    ],
    sortFieldMap: {
      assignmentDate: 'assignment_date',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    buildFilters: async (query, ctx) => {
      const filters: Record<string, unknown> = {}
      const ids = parseIds(query.ids)
      if (ids.length) filters.id = { $in: ids }
      if (query.resourceId) filters.resource_id = query.resourceId
      if (query.assignmentDate) filters.assignment_date = query.assignmentDate
      if (query.status) filters.status = query.status
      if (query.dateFrom || query.dateTo) {
        const range: Record<string, string> = {}
        if (query.dateFrom) range.$gte = query.dateFrom
        if (query.dateTo) range.$lte = query.dateTo
        filters.assignment_date = range
      }
      return applyFleetDriverListScope(ctx, filters, query.teamMemberId)
    },
    transformItem: (item) => transformAssignmentListItem(item as Record<string, unknown>),
  },
  actions: {
    create: {
      commandId: 'taxi_fleet.assignments.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(assignmentCreateSchema, raw ?? {}, ctx, translate)
      },
      response: ({ result }) => ({ id: (result as { assignmentId: string }).assignmentId }),
      status: 201,
    },
    update: {
      commandId: 'taxi_fleet.assignments.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(assignmentUpdateSchema, raw ?? {}, ctx, translate)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'taxi_fleet.assignments.delete',
      schema: rawBodySchema,
      mapInput: async ({ parsed, ctx }) => {
        const { translate } = await resolveTranslations()
        const id = resolveCrudRecordId(parsed, ctx, translate)
        return { id }
      },
      response: () => ({ ok: true }),
    },
  },
})

export const GET = crud.GET
export const POST = crud.POST
export const PUT = crud.PUT
export const DELETE = crud.DELETE

const rowSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  tenantId: z.string().uuid(),
  teamMemberId: z.string().uuid(),
  resourceId: z.string().uuid(),
  assignmentDate: z.string(),
  status: z.string(),
})

export const openApi = createTaxiFleetCrudOpenApi({
  resourceName: 'Daily assignment',
  pluralName: 'Daily assignments',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(rowSchema),
  create: { schema: assignmentCreateSchema, description: 'Creates a daily driver↔vehicle assignment.' },
  update: { schema: assignmentUpdateSchema, responseSchema: defaultOkResponseSchema },
  del: { schema: z.object({ id: z.string().uuid() }), responseSchema: defaultOkResponseSchema },
})
