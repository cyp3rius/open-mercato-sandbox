import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { emitCrudSideEffects, emitCrudUndoSideEffects, buildChanges, requireId } from '@open-mercato/shared/lib/commands/helpers'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { CrudIndexerConfig } from '@open-mercato/shared/lib/crud/types'
import { ResourcesResourceServiceBookEntry } from '../data/entities'
import {
  resourcesResourceServiceBookEntryCreateSchema,
  resourcesResourceServiceBookEntryUpdateSchema,
  type ResourcesResourceServiceBookEntryCreateInput,
  type ResourcesResourceServiceBookEntryUpdateInput,
} from '../data/validators'
import { resourcesResourceServiceBookEntryCrudEvents } from '../lib/crud'
import { ensureOrganizationScope, ensureTenantScope, extractUndoPayload, requireResource } from './shared'
import { E } from '#generated/entities.ids.generated'

const serviceBookCrudIndexer: CrudIndexerConfig<ResourcesResourceServiceBookEntry> = {
  entityType: E.resources.resources_resource_service_book_entry,
}

type ServiceBookSnapshot = {
  id: string
  organizationId: string
  tenantId: string
  resourceId: string
  serviceType: string
  serviceActivity: string
  serviceInAt: Date
  serviceOutAt: Date | null
  description: string | null
}

type ServiceBookUndoPayload = {
  before?: ServiceBookSnapshot | null
  after?: ServiceBookSnapshot | null
}

async function loadServiceBookSnapshot(em: EntityManager, id: string): Promise<ServiceBookSnapshot | null> {
  const row = await em.findOne(ResourcesResourceServiceBookEntry, { id })
  if (!row) return null
  return {
    id: row.id,
    organizationId: row.organizationId,
    tenantId: row.tenantId,
    resourceId: typeof row.resource === 'string' ? row.resource : row.resource.id,
    serviceType: row.serviceType,
    serviceActivity: row.serviceActivity,
    serviceInAt: row.serviceInAt,
    serviceOutAt: row.serviceOutAt ?? null,
    description: row.description ?? null,
  }
}

const createServiceBookCommand: CommandHandler<
  ResourcesResourceServiceBookEntryCreateInput,
  { serviceBookEntryId: string }
> = {
  id: 'resources.resource-service-book.create',
  async execute(rawInput, ctx) {
    const parsed = resourcesResourceServiceBookEntryCreateSchema.parse(rawInput)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const resource = await requireResource(em, parsed.entityId, 'Resource not found')
    ensureTenantScope(ctx, resource.tenantId)
    ensureOrganizationScope(ctx, resource.organizationId)

    const row = em.create(ResourcesResourceServiceBookEntry, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      resource,
      serviceType: parsed.serviceType,
      serviceActivity: parsed.serviceActivity,
      serviceInAt: parsed.serviceInAt,
      serviceOutAt: parsed.serviceOutAt ?? null,
      description: parsed.description ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    em.persist(row)
    await em.flush()

    const de = (ctx.container.resolve('dataEngine') as DataEngine)
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: row,
      identifiers: {
        id: row.id,
        organizationId: row.organizationId,
        tenantId: row.tenantId,
      },
      events: resourcesResourceServiceBookEntryCrudEvents,
      indexer: serviceBookCrudIndexer,
    })

    return { serviceBookEntryId: row.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return await loadServiceBookSnapshot(em, result.serviceBookEntryId)
  },
  buildLog: async ({ result, ctx }) => {
    const { translate } = await resolveTranslations()
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const snapshot = await loadServiceBookSnapshot(em, result.serviceBookEntryId)
    return {
      actionLabel: translate('resources.audit.resourceServiceBook.create', 'Create service book entry'),
      resourceKind: 'resources.resource_service_book_entry',
      resourceId: result.serviceBookEntryId,
      parentResourceKind: 'resources.resource',
      parentResourceId: snapshot?.resourceId ?? null,
      tenantId: snapshot?.tenantId ?? null,
      organizationId: snapshot?.organizationId ?? null,
      snapshotAfter: snapshot ?? null,
      payload: {
        undo: {
          after: snapshot ?? null,
        } satisfies ServiceBookUndoPayload,
      },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const entryId = logEntry?.resourceId ?? null
    if (!entryId) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const existing = await em.findOne(ResourcesResourceServiceBookEntry, { id: entryId })
    if (existing) {
      em.remove(existing)
      await em.flush()
    }
  },
}

const updateServiceBookCommand: CommandHandler<
  ResourcesResourceServiceBookEntryUpdateInput,
  { serviceBookEntryId: string }
> = {
  id: 'resources.resource-service-book.update',
  async prepare(rawInput, ctx) {
    const parsed = resourcesResourceServiceBookEntryUpdateSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager)
    const snapshot = await loadServiceBookSnapshot(em, parsed.id)
    return snapshot ? { before: snapshot } : {}
  },
  async execute(rawInput, ctx) {
    const parsed = resourcesResourceServiceBookEntryUpdateSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await em.findOne(ResourcesResourceServiceBookEntry, { id: parsed.id })
    if (!row) throw new CrudHttpError(404, { error: 'Service book entry not found' })
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)

    if (parsed.entityId !== undefined) {
      const resource = await requireResource(em, parsed.entityId, 'Resource not found')
      ensureTenantScope(ctx, resource.tenantId)
      ensureOrganizationScope(ctx, resource.organizationId)
      row.resource = resource
    }
    if (parsed.serviceType !== undefined) row.serviceType = parsed.serviceType
    if (parsed.serviceActivity !== undefined) row.serviceActivity = parsed.serviceActivity
    if (parsed.serviceInAt !== undefined) row.serviceInAt = parsed.serviceInAt
    if (parsed.serviceOutAt !== undefined) row.serviceOutAt = parsed.serviceOutAt ?? null
    if (parsed.description !== undefined) row.description = parsed.description ?? null

    await em.flush()

    const de = (ctx.container.resolve('dataEngine') as DataEngine)
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: row,
      identifiers: {
        id: row.id,
        organizationId: row.organizationId,
        tenantId: row.tenantId,
      },
      events: resourcesResourceServiceBookEntryCrudEvents,
      indexer: serviceBookCrudIndexer,
    })

    return { serviceBookEntryId: row.id }
  },
  buildLog: async ({ snapshots, ctx }) => {
    const { translate } = await resolveTranslations()
    const before = snapshots.before as ServiceBookSnapshot | undefined
    if (!before) return null
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const afterSnapshot = await loadServiceBookSnapshot(em, before.id)
    const changes =
      afterSnapshot && before
        ? buildChanges(
            before as Record<string, unknown>,
            afterSnapshot as Record<string, unknown>,
            [
              'resourceId',
              'serviceType',
              'serviceActivity',
              'serviceInAt',
              'serviceOutAt',
              'description',
            ],
          )
        : {}
    return {
      actionLabel: translate('resources.audit.resourceServiceBook.update', 'Update service book entry'),
      resourceKind: 'resources.resource_service_book_entry',
      resourceId: before.id,
      parentResourceKind: 'resources.resource',
      parentResourceId: before.resourceId ?? null,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      snapshotAfter: afterSnapshot ?? null,
      changes,
      payload: {
        undo: {
          before,
          after: afterSnapshot ?? null,
        } satisfies ServiceBookUndoPayload,
      },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<ServiceBookUndoPayload>(logEntry)
    const before = payload?.before
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    let row = await em.findOne(ResourcesResourceServiceBookEntry, { id: before.id })
    const resource = await requireResource(em, before.resourceId, 'Resource not found')

    if (!row) {
      row = em.create(ResourcesResourceServiceBookEntry, {
        id: before.id,
        organizationId: before.organizationId,
        tenantId: before.tenantId,
        resource,
        serviceType: before.serviceType,
        serviceActivity: before.serviceActivity,
        serviceInAt: before.serviceInAt,
        serviceOutAt: before.serviceOutAt,
        description: before.description,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      em.persist(row)
    } else {
      row.resource = resource
      row.serviceType = before.serviceType
      row.serviceActivity = before.serviceActivity
      row.serviceInAt = before.serviceInAt
      row.serviceOutAt = before.serviceOutAt
      row.description = before.description
    }

    await em.flush()

    const de = (ctx.container.resolve('dataEngine') as DataEngine)
    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: row,
      identifiers: {
        id: row.id,
        organizationId: row.organizationId,
        tenantId: row.tenantId,
      },
      events: resourcesResourceServiceBookEntryCrudEvents,
      indexer: serviceBookCrudIndexer,
    })
  },
}

const deleteServiceBookCommand: CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, { serviceBookEntryId: string }> = {
  id: 'resources.resource-service-book.delete',
  async prepare(input, ctx) {
    const id = requireId(input, 'Service book entry id required')
    const em = (ctx.container.resolve('em') as EntityManager)
    const snapshot = await loadServiceBookSnapshot(em, id)
    return snapshot ? { before: snapshot } : {}
  },
  async execute(input, ctx) {
    const id = requireId(input, 'Service book entry id required')
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await em.findOne(ResourcesResourceServiceBookEntry, { id })
    if (!row) throw new CrudHttpError(404, { error: 'Service book entry not found' })
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)
    em.remove(row)
    await em.flush()

    const de = (ctx.container.resolve('dataEngine') as DataEngine)
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: row,
      identifiers: {
        id: row.id,
        organizationId: row.organizationId,
        tenantId: row.tenantId,
      },
      events: resourcesResourceServiceBookEntryCrudEvents,
      indexer: serviceBookCrudIndexer,
    })
    return { serviceBookEntryId: row.id }
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as ServiceBookSnapshot | undefined
    if (!before) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('resources.audit.resourceServiceBook.delete', 'Delete service book entry'),
      resourceKind: 'resources.resource_service_book_entry',
      resourceId: before.id,
      parentResourceKind: 'resources.resource',
      parentResourceId: before.resourceId ?? null,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      payload: {
        undo: {
          before,
        } satisfies ServiceBookUndoPayload,
      },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<ServiceBookUndoPayload>(logEntry)
    const before = payload?.before
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const resource = await requireResource(em, before.resourceId, 'Resource not found')
    let row = await em.findOne(ResourcesResourceServiceBookEntry, { id: before.id })
    if (!row) {
      row = em.create(ResourcesResourceServiceBookEntry, {
        id: before.id,
        organizationId: before.organizationId,
        tenantId: before.tenantId,
        resource,
        serviceType: before.serviceType,
        serviceActivity: before.serviceActivity,
        serviceInAt: before.serviceInAt,
        serviceOutAt: before.serviceOutAt,
        description: before.description,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      em.persist(row)
    } else {
      row.resource = resource
      row.serviceType = before.serviceType
      row.serviceActivity = before.serviceActivity
      row.serviceInAt = before.serviceInAt
      row.serviceOutAt = before.serviceOutAt
      row.description = before.description
    }
    await em.flush()

    const de = (ctx.container.resolve('dataEngine') as DataEngine)
    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'created',
      entity: row,
      identifiers: {
        id: row.id,
        organizationId: row.organizationId,
        tenantId: row.tenantId,
      },
      events: resourcesResourceServiceBookEntryCrudEvents,
      indexer: serviceBookCrudIndexer,
    })
  },
}

registerCommand(createServiceBookCommand)
registerCommand(updateServiceBookCommand)
registerCommand(deleteServiceBookCommand)
