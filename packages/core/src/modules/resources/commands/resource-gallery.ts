import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { Attachment } from '@open-mercato/core/modules/attachments/data/entities'
import {
  ResourcesResource,
  ResourcesResourceGalleryItem,
  ResourcesResourceType,
} from '../data/entities'
import {
  resourcesResourceGalleryItemCreateSchema,
  resourcesResourceGalleryItemDeleteSchema,
  resourcesResourceGalleryReorderSchema,
  type ResourcesResourceGalleryItemCreateInput,
  type ResourcesResourceGalleryItemDeleteInput,
  type ResourcesResourceGalleryReorderInput,
} from '../data/validators'
import { ensureOrganizationScope, ensureTenantScope } from './shared'
import { RESOURCES_RESOURCE_FIELDSET_VEHICLE, resolveResourcesResourceFieldsetCode } from '../lib/resourceCustomFields'
import { E } from '#generated/entities.ids.generated'

async function loadTypeName(
  em: EntityManager,
  resourceTypeId: string | null | undefined,
  scope: { tenantId: string; organizationId: string },
): Promise<string | null> {
  if (!resourceTypeId) return null
  const row = await findOneWithDecryption(
    em,
    ResourcesResourceType,
    { id: resourceTypeId, deletedAt: null },
    undefined,
    scope,
  )
  return row?.name ?? null
}

async function assertVehicleResource(
  em: EntityManager,
  resource: ResourcesResource,
  scope: { tenantId: string; organizationId: string },
): Promise<void> {
  const hostName = await loadTypeName(em, resource.resourceTypeId ?? null, scope)
  if (resolveResourcesResourceFieldsetCode(hostName) !== RESOURCES_RESOURCE_FIELDSET_VEHICLE) {
    throw new CrudHttpError(400, { error: 'Gallery items are only allowed on vehicle resources.' })
  }
}

async function assertAttachmentBelongsToResource(
  em: EntityManager,
  attachmentId: string,
  resourceId: string,
  scope: { tenantId: string; organizationId: string },
): Promise<void> {
  const attachment = await em.findOne(Attachment, {
    id: attachmentId,
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
  })
  if (!attachment) {
    throw new CrudHttpError(400, { error: 'Attachment not found.' })
  }
  if (attachment.entityId !== E.resources.resources_resource || attachment.recordId !== resourceId) {
    throw new CrudHttpError(400, { error: 'Attachment is not linked to this resource.' })
  }
}

const createGalleryItemCommand: CommandHandler<ResourcesResourceGalleryItemCreateInput, { galleryItemId: string }> = {
  id: 'resources.resource_gallery_items.create',
  async execute(rawInput, ctx) {
    const parsed = resourcesResourceGalleryItemCreateSchema.parse(rawInput)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const scope = { tenantId: parsed.tenantId, organizationId: parsed.organizationId }
    const resource = await findOneWithDecryption(
      em,
      ResourcesResource,
      { id: parsed.resourceId, deletedAt: null },
      undefined,
      scope,
    )
    if (!resource) throw new CrudHttpError(404, { error: 'Resource not found.' })
    await assertVehicleResource(em, resource, scope)
    await assertAttachmentBelongsToResource(em, parsed.attachmentId, parsed.resourceId, scope)

    const duplicate = await em.findOne(ResourcesResourceGalleryItem, {
      resource: parsed.resourceId,
      attachmentId: parsed.attachmentId,
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
    })
    if (duplicate) {
      throw new CrudHttpError(400, { error: 'This attachment is already in the gallery.' })
    }

    let sortOrder = typeof parsed.sortOrder === 'number' ? parsed.sortOrder : null
    if (sortOrder === null) {
      const last = await em.findOne(
        ResourcesResourceGalleryItem,
        { resource: parsed.resourceId, tenantId: parsed.tenantId, organizationId: parsed.organizationId },
        { orderBy: { sortOrder: 'DESC' } },
      )
      sortOrder = (last?.sortOrder ?? -1) + 1
    }

    const now = new Date()
    const row = em.create(ResourcesResourceGalleryItem, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      resource: em.getReference(ResourcesResource, parsed.resourceId),
      attachmentId: parsed.attachmentId,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(row)
    await em.flush()
    return { galleryItemId: row.id }
  },
}

const reorderGalleryCommand: CommandHandler<ResourcesResourceGalleryReorderInput, { resourceId: string }> = {
  id: 'resources.resource_gallery_items.reorder',
  async execute(rawInput, ctx) {
    const parsed = resourcesResourceGalleryReorderSchema.parse(rawInput)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const scope = { tenantId: parsed.tenantId, organizationId: parsed.organizationId }
    const resource = await findOneWithDecryption(
      em,
      ResourcesResource,
      { id: parsed.resourceId, deletedAt: null },
      undefined,
      scope,
    )
    if (!resource) throw new CrudHttpError(404, { error: 'Resource not found.' })
    await assertVehicleResource(em, resource, scope)

    const rows = await em.find(
      ResourcesResourceGalleryItem,
      { resource: parsed.resourceId, tenantId: parsed.tenantId, organizationId: parsed.organizationId },
      { orderBy: { sortOrder: 'ASC', createdAt: 'ASC' } },
    )
    const existingIds = new Set(rows.map((r) => r.id))
    if (existingIds.size !== parsed.orderedItemIds.length) {
      throw new CrudHttpError(400, { error: 'Gallery reorder must include every gallery item id for this resource.' })
    }
    for (const id of parsed.orderedItemIds) {
      if (!existingIds.has(id)) {
        throw new CrudHttpError(400, { error: 'Unknown gallery item id in reorder list.' })
      }
    }

    const now = new Date()
    parsed.orderedItemIds.forEach((id, index) => {
      const row = rows.find((r) => r.id === id)
      if (row) {
        row.sortOrder = index
        row.updatedAt = now
      }
    })
    await em.flush()
    return { resourceId: parsed.resourceId }
  },
}

const deleteGalleryItemCommand: CommandHandler<ResourcesResourceGalleryItemDeleteInput, { galleryItemId: string }> = {
  id: 'resources.resource_gallery_items.delete',
  async execute(rawInput, ctx) {
    const parsed = resourcesResourceGalleryItemDeleteSchema.parse(rawInput)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await em.findOne(ResourcesResourceGalleryItem, { id: parsed.id })
    if (!row) throw new CrudHttpError(404, { error: 'Gallery item not found.' })
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)
    await em.removeAndFlush(row)
    return { galleryItemId: parsed.id }
  },
}

registerCommand(createGalleryItemCommand)
registerCommand(reorderGalleryCommand)
registerCommand(deleteGalleryItemCommand)
