import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { ResourcesResource, ResourcesResourceAccessoryLink, ResourcesResourceType } from '../data/entities'
import {
  resourcesResourceAccessoryLinkCreateSchema,
  resourcesResourceAccessoryLinkDeleteSchema,
  resourcesResourceAccessoryLinkUpdateSchema,
  type ResourcesResourceAccessoryLinkCreateInput,
  type ResourcesResourceAccessoryLinkDeleteInput,
  type ResourcesResourceAccessoryLinkUpdateInput,
} from '../data/validators'
import { ensureOrganizationScope, ensureTenantScope } from './shared'
import { RESOURCES_RESOURCE_FIELDSET_VEHICLE, resolveResourcesResourceFieldsetCode } from '../lib/resourceCustomFields'

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

async function assertVehicleHostAndNonVehicleAccessory(
  em: EntityManager,
  host: ResourcesResource,
  accessory: ResourcesResource,
  scope: { tenantId: string; organizationId: string },
): Promise<void> {
  const hostName = await loadTypeName(em, host.resourceTypeId ?? null, scope)
  const accessoryName = await loadTypeName(em, accessory.resourceTypeId ?? null, scope)
  const hostFieldset = resolveResourcesResourceFieldsetCode(hostName)
  const accessoryFieldset = resolveResourcesResourceFieldsetCode(accessoryName)
  if (hostFieldset !== RESOURCES_RESOURCE_FIELDSET_VEHICLE) {
    throw new CrudHttpError(400, { error: 'Accessories can only be linked to vehicle resources.' })
  }
  if (accessoryFieldset === RESOURCES_RESOURCE_FIELDSET_VEHICLE) {
    throw new CrudHttpError(400, { error: 'Cannot link another vehicle as an accessory.' })
  }
  if (host.id === accessory.id) {
    throw new CrudHttpError(400, { error: 'A resource cannot be an accessory of itself.' })
  }
}

const createLinkCommand: CommandHandler<ResourcesResourceAccessoryLinkCreateInput, { linkId: string }> = {
  id: 'resources.resource_accessory_links.create',
  async execute(rawInput, ctx) {
    const parsed = resourcesResourceAccessoryLinkCreateSchema.parse(rawInput)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const scope = { tenantId: parsed.tenantId, organizationId: parsed.organizationId }
    const host = await findOneWithDecryption(
      em,
      ResourcesResource,
      { id: parsed.hostResourceId, deletedAt: null },
      undefined,
      scope,
    )
    const accessory = await findOneWithDecryption(
      em,
      ResourcesResource,
      { id: parsed.accessoryResourceId, deletedAt: null },
      undefined,
      scope,
    )
    if (!host || !accessory) throw new CrudHttpError(404, { error: 'Resource not found.' })
    await assertVehicleHostAndNonVehicleAccessory(em, host, accessory, scope)

    const now = new Date()
    const link = em.create(ResourcesResourceAccessoryLink, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      hostResource: host,
      accessoryResource: accessory,
      isMounted: parsed.isMounted ?? false,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(link)
    try {
      await em.flush()
    } catch (err: unknown) {
      const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code?: string }).code) : ''
      if (code === '23505') {
        throw new CrudHttpError(400, { error: 'This accessory is already linked to the vehicle.' })
      }
      throw err
    }
    return { linkId: link.id }
  },
}

const updateLinkCommand: CommandHandler<ResourcesResourceAccessoryLinkUpdateInput, { linkId: string }> = {
  id: 'resources.resource_accessory_links.update',
  async execute(rawInput, ctx) {
    const parsed = resourcesResourceAccessoryLinkUpdateSchema.parse(rawInput)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const link = await em.findOne(ResourcesResourceAccessoryLink, { id: parsed.id })
    if (!link) throw new CrudHttpError(404, { error: 'Link not found.' })
    ensureTenantScope(ctx, link.tenantId)
    ensureOrganizationScope(ctx, link.organizationId)
    link.isMounted = parsed.isMounted
    link.updatedAt = new Date()
    await em.flush()
    return { linkId: link.id }
  },
}

const deleteLinkCommand: CommandHandler<ResourcesResourceAccessoryLinkDeleteInput, { linkId: string }> = {
  id: 'resources.resource_accessory_links.delete',
  async execute(rawInput, ctx) {
    const parsed = resourcesResourceAccessoryLinkDeleteSchema.parse(rawInput)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const link = await em.findOne(ResourcesResourceAccessoryLink, { id: parsed.id })
    if (!link) throw new CrudHttpError(404, { error: 'Link not found.' })
    ensureTenantScope(ctx, link.tenantId)
    ensureOrganizationScope(ctx, link.organizationId)
    await em.removeAndFlush(link)
    return { linkId: parsed.id }
  },
}

registerCommand(createLinkCommand)
registerCommand(updateLinkCommand)
registerCommand(deleteLinkCommand)
