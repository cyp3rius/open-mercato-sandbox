import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { resolveCrudRecordId, parseScopedCommandInput } from '@open-mercato/shared/lib/api/scoped'
import { parseBooleanToken } from '@open-mercato/shared/lib/boolean'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import { sanitizeSearchTerm } from '@open-mercato/shared/lib/query/sanitizeSearchTerm'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { StaffTeamMember } from '@open-mercato/core/modules/staff/data/entities'
import { TaxiFleetDailyAssignment, TaxiFleetDriverProfile } from '../data/entities'
import { driverProfileCreateSchema, driverProfileUpdateSchema } from '../data/validators'
import {
  createTaxiFleetCrudOpenApi,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from './openapi'
import { resolveDriverDefaultResourceIds } from '../lib/driverDefaultResources'

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['taxi_fleet.view'] },
  POST: { requireAuth: true, requireFeatures: ['taxi_fleet.manage_settlements'] },
  PUT: { requireAuth: true, requireFeatures: ['taxi_fleet.manage_settlements'] },
  DELETE: { requireAuth: true, requireFeatures: ['taxi_fleet.manage_settlements'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()

const listSchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    ids: z.string().optional(),
    teamMemberId: z.string().uuid().optional(),
    name: z.string().optional(),
    resourceId: z.string().uuid().optional(),
    onShift: z.string().optional(),
    externalAppEnabled: z.string().optional(),
    sortField: z.string().optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
  })
  .passthrough()

type DriverProfileListCtx = {
  container: { resolve: (name: string) => unknown }
  auth: { sub?: string | null; tenantId?: string | null; orgId?: string | null } | null
  selectedOrganizationId?: string | null
  organizationIds?: string[] | null
}

function resolveScope(ctx: DriverProfileListCtx): { tenantId: string; organizationId: string } | null {
  const tenantId = ctx.auth?.tenantId ?? null
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!tenantId || !organizationId) return null
  return { tenantId, organizationId }
}

const EMPTY_UUID = '00000000-0000-4000-8000-000000000000'

function narrowMemberIds(current: string[] | null, next: string[]): string[] {
  if (current == null) return next
  const allowed = new Set(next)
  return current.filter((id) => allowed.has(id))
}

async function loadOpenShiftTeamMemberIds(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string },
): Promise<string[]> {
  const rows = await findWithDecryption(
    em,
    TaxiFleetDailyAssignment,
    {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
      shiftStart: { $ne: null },
      shiftEnd: null,
      status: { $ne: 'cancelled' },
    },
    { fields: ['teamMemberId'] },
    scope,
  )
  return [...new Set(rows.map((row) => row.teamMemberId).filter(Boolean))]
}

async function loadTeamMemberIdsByName(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string },
  name: string,
): Promise<string[]> {
  const term = sanitizeSearchTerm(name)
  if (!term) return []
  const like = `%${escapeLikePattern(term)}%`
  const rows = await findWithDecryption(
    em,
    StaffTeamMember,
    {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
      displayName: { $ilike: like },
    },
    { fields: ['id'] },
    scope,
  )
  return rows.map((row) => row.id).filter(Boolean)
}

function readTeamMemberId(item: Record<string, unknown>): string | null {
  const value = item.teamMemberId ?? item.team_member_id
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: TaxiFleetDriverProfile,
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
      'payout_mode',
      'payout_percent',
      'payout_tiers_json',
      'default_resource_id',
      'default_resource_ids',
      'external_app_enabled',
      'bolt_driver_id',
      'uber_driver_id',
      'free_driver_id',
      'created_at',
      'updated_at',
    ],
    sortFieldMap: { createdAt: 'created_at', updatedAt: 'updated_at' },
    buildFilters: async (query, ctx) => {
      const filters: Record<string, unknown> = {}
      if (query.ids) {
        const ids = query.ids.split(',').map((item) => item.trim()).filter(Boolean)
        if (ids.length) filters.id = { $in: ids }
      }

      const externalAppEnabled = parseBooleanToken(query.externalAppEnabled)
      if (externalAppEnabled !== null) {
        filters.externalAppEnabled = externalAppEnabled
      }

      if (query.resourceId) {
        filters.$or = [
          { defaultResourceIds: { $contains: [query.resourceId] } },
          { defaultResourceId: query.resourceId },
        ]
      }

      const scope = resolveScope(ctx)
      const em = ctx.container.resolve('em') as EntityManager
      let memberIds: string[] | null = query.teamMemberId ? [query.teamMemberId] : null

      const name = typeof query.name === 'string' ? query.name.trim() : ''
      if (name && scope) {
        const matched = await loadTeamMemberIdsByName(em, scope, name)
        memberIds = narrowMemberIds(memberIds, matched)
      }

      const onShift = parseBooleanToken(query.onShift)
      if (onShift !== null && scope) {
        const openIds = await loadOpenShiftTeamMemberIds(em, scope)
        if (onShift) {
          memberIds = narrowMemberIds(memberIds, openIds)
        } else if (openIds.length) {
          if (memberIds == null) {
            filters.teamMemberId = { $nin: openIds }
          } else {
            const openSet = new Set(openIds)
            memberIds = memberIds.filter((id) => !openSet.has(id))
          }
        }
      }

      if (memberIds != null) {
        filters.teamMemberId = { $in: memberIds.length ? memberIds : [EMPTY_UUID] }
      }

      return filters
    },
  },
  hooks: {
    afterList: async (payload, ctx) => {
      const items = Array.isArray(payload.items) ? (payload.items as Record<string, unknown>[]) : []
      if (!items.length) return

      const scope = resolveScope(ctx)
      const openSet = new Set<string>()
      if (scope) {
        const em = ctx.container.resolve('em') as EntityManager
        const openIds = await loadOpenShiftTeamMemberIds(em, scope)
        for (const id of openIds) openSet.add(id)
      }

      for (const item of items) {
        const teamMemberId = readTeamMemberId(item)
        const defaultResourceIds = resolveDriverDefaultResourceIds({
          defaultResourceIds: (item.defaultResourceIds ?? item.default_resource_ids) as string[] | null,
          defaultResourceId: (item.defaultResourceId ?? item.default_resource_id) as string | null,
        })
        item.defaultResourceIds = defaultResourceIds
        item.defaultResourceId = defaultResourceIds[0] ?? null
        item.onShift = teamMemberId ? openSet.has(teamMemberId) : false
      }
    },
  },
  actions: {
    create: {
      commandId: 'taxi_fleet.driver_profiles.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(driverProfileCreateSchema, raw ?? {}, ctx, translate)
      },
      response: ({ result }) => ({ id: (result as { profileId: string }).profileId }),
      status: 201,
    },
    update: {
      commandId: 'taxi_fleet.driver_profiles.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(driverProfileUpdateSchema, raw ?? {}, ctx, translate)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'taxi_fleet.driver_profiles.delete',
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
  teamMemberId: z.string().uuid(),
  payoutMode: z.enum(['fixed', 'tiered']).optional(),
  payoutPercent: z.string(),
  payoutTiersJson: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
  externalAppEnabled: z.boolean(),
  defaultResourceId: z.string().uuid().nullable().optional(),
  defaultResourceIds: z.array(z.string().uuid()).optional(),
  onShift: z.boolean().optional(),
  boltDriverId: z.string().nullable().optional(),
  uberDriverId: z.string().nullable().optional(),
  freeDriverId: z.string().nullable().optional(),
})

export const openApi = createTaxiFleetCrudOpenApi({
  resourceName: 'Driver profile',
  pluralName: 'Driver profiles',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(rowSchema),
  create: { schema: driverProfileCreateSchema },
  update: { schema: driverProfileUpdateSchema, responseSchema: defaultOkResponseSchema },
  del: { schema: z.object({ id: z.string().uuid() }), responseSchema: defaultOkResponseSchema },
})
