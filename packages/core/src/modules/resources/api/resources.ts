import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { resolveCrudRecordId, parseScopedCommandInput } from '@open-mercato/shared/lib/api/scoped'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import type { EntityManager } from '@mikro-orm/postgresql'
import {
  ResourcesResource,
  ResourcesResourceFinancingProfile,
  ResourcesResourceTagAssignment,
  ResourcesResourceTag,
  ResourcesResourceType,
} from '../data/entities'
import { resourcesResourceCreateSchema, resourcesResourceUpdateSchema } from '../data/validators'
import { sanitizeSearchTerm, parseBooleanFlag } from './helpers'
import { E } from '#generated/entities.ids.generated'
import { createResourcesCrudOpenApi, createPagedListResponseSchema, defaultOkResponseSchema } from './openapi'
import {
  RESOURCES_RESOURCE_FIELDSET_VEHICLE,
  resolveResourcesResourceFieldsetCode,
} from '../lib/resourceCustomFields'
// Field constants for ResourcesResource entity
const F = {
  id: "id",
  tenant_id: "tenant_id",
  organization_id: "organization_id",
  resource_type_id: "resource_type_id",
  name: "name",
  description: "description",
  capacity: "capacity",
  capacity_unit_value: "capacity_unit_value",
  capacity_unit_name: "capacity_unit_name",
  capacity_unit_color: "capacity_unit_color",
  capacity_unit_icon: "capacity_unit_icon",
  appearance_icon: "appearance_icon",
  appearance_color: "appearance_color",
  is_active: "is_active",
  availability_rule_set_id: "availability_rule_set_id",
  customer_entity_id: "customer_entity_id",
  procurement_process_id: "procurement_process_id",
  status_value: "status_value",
  status_label: "status_label",
  status_color: "status_color",
  status_icon: "status_icon",
  insurance_policy_id: "insurance_policy_id",
  created_at: "created_at",
  updated_at: "updated_at",
  deleted_at: "deleted_at",
} as const

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['resources.view'] },
  POST: { requireAuth: true, requireFeatures: ['resources.manage_resources'] },
  PUT: { requireAuth: true, requireFeatures: ['resources.manage_resources'] },
  DELETE: { requireAuth: true, requireFeatures: ['resources.manage_resources'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()

const listSchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    search: z.string().optional(),
    ids: z.string().optional(),
    resourceTypeId: z.string().uuid().optional(),
    isActive: z.string().optional(),
    tagIds: z.string().optional(),
    customerEntityId: z.string().uuid().optional(),
    /** When `true`, only resources with no linked customer (`customer_entity_id` IS NULL). Ignores `customerEntityId`. */
    customerUnassigned: z.string().optional(),
    sortField: z.string().optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
    /** When set to `resources_resource_vehicle`, only resources whose type maps to the Vehicles custom-field scope are returned. */
    resourcesResourceFieldset: z.string().optional(),
  })
  .passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: ResourcesResource,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: { entityType: E.resources.resources_resource },
  list: {
    schema: listSchema,
    entityId: E.resources.resources_resource,
    fields: [
      F.id,
      F.organization_id,
      F.tenant_id,
      F.name,
      'description',
      F.resource_type_id,
      F.capacity,
      'capacity_unit_value',
      'capacity_unit_name',
      'capacity_unit_color',
      'capacity_unit_icon',
      'appearance_icon',
      'appearance_color',
      F.is_active,
      'availability_rule_set_id',
      F.customer_entity_id,
      F.procurement_process_id,
      F.status_value,
      F.status_label,
      F.status_color,
      F.status_icon,
      F.insurance_policy_id,
      F.created_at,
      F.updated_at,
    ],
    sortFieldMap: {
      name: F.name,
      createdAt: F.created_at,
      updatedAt: F.updated_at,
    },
    buildFilters: async (query, ctx) => {
      const filters: Record<string, unknown> = {}
      if (typeof query.ids === 'string' && query.ids.trim().length > 0) {
        const ids = query.ids
          .split(',')
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
        if (ids.length > 0) {
          filters[F.id] = { $in: ids }
        }
      }
      const term = sanitizeSearchTerm(query.search)
      if (term) {
        const like = `%${escapeLikePattern(term)}%`
        filters[F.name] = { $ilike: like }
      }
      const fieldsetRaw =
        typeof query.resourcesResourceFieldset === 'string' ? query.resourcesResourceFieldset.trim() : ''
      if (fieldsetRaw === RESOURCES_RESOURCE_FIELDSET_VEHICLE) {
        const em = (ctx.container.resolve('em') as EntityManager).fork()
        const scopeTenantId = ctx.organizationScope?.tenantId ?? ctx.auth?.tenantId ?? null
        const organizationIds = ctx.organizationIds ?? ctx.organizationScope?.filterIds ?? null
        const selectedOrganizationId = ctx.selectedOrganizationId ?? ctx.organizationScope?.selectedId ?? null
        const typeWhere: Record<string, unknown> = { deletedAt: null }
        if (scopeTenantId) typeWhere.tenantId = scopeTenantId
        if (Array.isArray(organizationIds) && organizationIds.length > 0) {
          typeWhere.organizationId = { $in: organizationIds }
        } else if (selectedOrganizationId) {
          typeWhere.organizationId = selectedOrganizationId
        }
        const allTypes = await em.find(ResourcesResourceType, typeWhere)
        let vehicleTypeIds = allTypes
          .filter((rt) => resolveResourcesResourceFieldsetCode(rt.name) === RESOURCES_RESOURCE_FIELDSET_VEHICLE)
          .map((rt) => rt.id)
        const requestedTypeId = typeof query.resourceTypeId === 'string' ? query.resourceTypeId.trim() : ''
        if (requestedTypeId.length) {
          vehicleTypeIds = vehicleTypeIds.filter((id) => id === requestedTypeId)
        }
        filters[F.resource_type_id] = {
          $in:
            vehicleTypeIds.length > 0
              ? vehicleTypeIds
              : ['00000000-0000-0000-0000-000000000000'],
        }
      } else if (query.resourceTypeId) {
        filters[F.resource_type_id] = query.resourceTypeId
      }
      const customerUnassigned = parseBooleanFlag(
        typeof query.customerUnassigned === 'string' ? query.customerUnassigned : undefined,
      )
      if (customerUnassigned === true) {
        filters[F.customer_entity_id] = null
      } else if (query.customerEntityId) {
        filters[F.customer_entity_id] = query.customerEntityId
      }
      const isActive = parseBooleanFlag(query.isActive)
      if (isActive !== undefined) {
        filters[F.is_active] = isActive
      }
      if (typeof query.tagIds === 'string' && query.tagIds.trim().length > 0) {
        const tagIds = query.tagIds
          .split(',')
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
        if (tagIds.length > 0) {
          const em = (ctx.container.resolve('em') as EntityManager).fork()
          const assignmentFilters: Record<string, unknown> = {
            tag: { $in: tagIds },
          }
          const scopeTenantId = ctx.organizationScope?.tenantId ?? ctx.auth?.tenantId ?? null
          const organizationIds = ctx.organizationIds ?? ctx.organizationScope?.filterIds ?? null
          const selectedOrganizationId = ctx.selectedOrganizationId ?? ctx.organizationScope?.selectedId ?? null
          if (scopeTenantId) assignmentFilters.tenantId = scopeTenantId
          if (Array.isArray(organizationIds) && organizationIds.length > 0) {
            assignmentFilters.organizationId = { $in: organizationIds }
          } else if (selectedOrganizationId) {
            assignmentFilters.organizationId = selectedOrganizationId
          }
          const assignments = await em.find(ResourcesResourceTagAssignment, assignmentFilters, { fields: ['resource'] })
          const resourceIds = assignments.map((assignment) => assignment.resource.id)
          filters[F.id] = { $in: resourceIds.length > 0 ? resourceIds : [] }
        }
      }
      return filters
    },
    decorateCustomFields: { entityIds: [E.resources.resources_resource] },
  },
  hooks: {
    afterList: async (payload, ctx) => {
      const items: Array<Record<string, unknown>> = Array.isArray(payload?.items)
        ? (payload.items as Array<Record<string, unknown>>)
        : []
      if (items.length === 0) return
      const resourceIds = items
        .map((item) => (typeof item.id === 'string' ? item.id : null))
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
      if (resourceIds.length === 0) return
      const em = (ctx.container.resolve('em') as EntityManager).fork()
      const typeIds = Array.from(
        new Set(
          items
            .map((item) => {
              const raw = item[F.resource_type_id]
              return typeof raw === 'string' && raw.length > 0 ? raw : null
            })
            .filter((id): id is string => id !== null),
        ),
      )
      const typeNameById = new Map<string, string>()
      const typeVehicleFinancingById = new Map<string, boolean>()
      if (typeIds.length > 0) {
        const types = await em.find(ResourcesResourceType, { id: { $in: typeIds }, deletedAt: null })
        types.forEach((row) => {
          if (row.name) typeNameById.set(row.id, row.name)
          typeVehicleFinancingById.set(row.id, row.vehicleFinancingEligible ?? false)
        })
      }
      const scopeTenantId = ctx.organizationScope?.tenantId ?? ctx.auth?.tenantId ?? null
      const organizationIds = ctx.organizationIds ?? ctx.organizationScope?.filterIds ?? null
      const selectedOrganizationId = ctx.selectedOrganizationId ?? ctx.organizationScope?.selectedId ?? null
      const financingFilters: Record<string, unknown> = { resource: { $in: resourceIds } }
      if (scopeTenantId) financingFilters.tenantId = scopeTenantId
      if (Array.isArray(organizationIds) && organizationIds.length > 0) {
        financingFilters.organizationId = { $in: organizationIds }
      } else if (selectedOrganizationId) {
        financingFilters.organizationId = selectedOrganizationId
      }
      const financingRows =
        resourceIds.length > 0 ? await em.find(ResourcesResourceFinancingProfile, financingFilters) : []
      const financingByResourceId = new Map<string, ResourcesResourceFinancingProfile>()
      financingRows.forEach((row) => {
        const rid = typeof row.resource === 'object' && row.resource && 'id' in row.resource ? row.resource.id : null
        if (rid) financingByResourceId.set(rid, row)
      })
      const assignments = await em.find(
        ResourcesResourceTagAssignment,
        { resource: { $in: resourceIds } },
        { populate: ['tag'] },
      )
      const tagById = new Map<string, { id: string; label: string; color?: string | null }>()
      assignments.forEach((assignment) => {
        const tag = assignment.tag as ResourcesResourceTag
        if (!tag || !tag.id) return
        if (!tagById.has(tag.id)) {
          tagById.set(tag.id, { id: tag.id, label: tag.label, color: tag.color ?? null })
        }
      })
      const tagsByResource = new Map<string, Array<{ id: string; label: string; color?: string | null }>>()
      assignments.forEach((assignment) => {
        const tag = assignment.tag as ResourcesResourceTag
        const mapped = tagById.get(tag?.id ?? '')
        if (!mapped) return
        const list = tagsByResource.get(assignment.resource.id) ?? []
        list.push(mapped)
        tagsByResource.set(assignment.resource.id, list)
      })
      items.forEach((item) => {
        const resourceId = typeof item.id === 'string' ? item.id : null
        item.tags = resourceId ? (tagsByResource.get(resourceId) ?? []) : []
        const tid = item[F.resource_type_id]
        if (typeof tid === 'string' && tid.length > 0) {
          const tname = typeNameById.get(tid)
          if (tname) item.resource_type_name = tname
          item.vehicle_type_financing_eligible = typeVehicleFinancingById.get(tid) ?? false
        }
        if (resourceId) {
          const fin = financingByResourceId.get(resourceId)
          if (fin) {
            item.financing_profile = {
              financingKind: fin.financingKind,
              termMonths: fin.termMonths ?? null,
              vehicleValueAmount: fin.vehicleValueAmount ?? null,
              installmentAmount: fin.installmentAmount ?? null,
              currencyCode: fin.currencyCode ?? null,
              validFrom: fin.validFrom ? fin.validFrom.toISOString() : null,
              validTo: fin.validTo ? fin.validTo.toISOString() : null,
              metadata: fin.metadata ?? null,
            }
          } else {
            item.financing_profile = null
          }
        }
      })
    },
    decorateCustomFields: { entityIds: [E.resources.resources_resource] },
  },
  actions: {
    create: {
      commandId: 'resources.resources.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(resourcesResourceCreateSchema, raw ?? {}, ctx, translate)
      },
      response: ({ result }) => ({ id: result?.resourceId ?? null }),
      status: 201,
    },
    update: {
      commandId: 'resources.resources.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(resourcesResourceUpdateSchema, raw ?? {}, ctx, translate)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'resources.resources.delete',
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

const resourceTagListItemSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  label: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
})

const resourceListItemSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  organization_id: z.string().uuid().nullable().optional(),
  tenant_id: z.string().uuid().nullable().optional(),
  name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  resource_type_id: z.string().uuid().nullable().optional(),
  capacity: z.number().nullable().optional(),
  capacity_unit_value: z.string().nullable().optional(),
  capacity_unit_name: z.string().nullable().optional(),
  capacity_unit_color: z.string().nullable().optional(),
  capacity_unit_icon: z.string().nullable().optional(),
  appearance_icon: z.string().nullable().optional(),
  appearance_color: z.string().nullable().optional(),
  is_active: z.boolean().nullable().optional(),
  availability_rule_set_id: z.string().uuid().nullable().optional(),
  customer_entity_id: z.string().uuid().nullable().optional(),
  resource_type_name: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  tags: z.array(resourceTagListItemSchema).optional(),
  insurance_policy_id: z.string().uuid().nullable().optional(),
  financing_profile: z.record(z.string(), z.unknown()).nullable().optional(),
  vehicle_type_financing_eligible: z.boolean().nullable().optional(),
})

export const openApi = createResourcesCrudOpenApi({
  resourceName: 'Resource',
  pluralName: 'Resources',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(resourceListItemSchema),
  create: {
    schema: resourcesResourceCreateSchema,
    description: 'Creates a resource scoped to the selected organization.',
  },
  update: {
    schema: resourcesResourceUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates a resource by id.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Deletes a resource by id.',
  },
})
