import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { buildChanges, requireId } from '@open-mercato/shared/lib/commands/helpers'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import {
  CatalogProductServiceLineExtension,
  CatalogServiceLine,
} from '../data/entities'
import {
  serviceLineCreateSchema,
  serviceLineUpdateSchema,
  type ServiceLineCreateInput,
  type ServiceLineUpdateInput,
} from '../data/validators'
import { ensureOrganizationScope, ensureTenantScope, extractUndoPayload } from './shared'

type ServiceLineSnapshot = {
  id: string
  organizationId: string
  tenantId: string
  code: string
  title: string
  description: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type ServiceLineUndoPayload = {
  before?: ServiceLineSnapshot | null
  after?: ServiceLineSnapshot | null
}

const SERVICE_LINE_CHANGE_KEYS = [
  'code',
  'title',
  'description',
  'sortOrder',
  'isActive',
] as const satisfies readonly string[]

async function loadServiceLineSnapshot(em: EntityManager, id: string): Promise<ServiceLineSnapshot | null> {
  const record = await em.findOne(CatalogServiceLine, { id, deletedAt: null })
  if (!record) return null
  return {
    id: record.id,
    organizationId: record.organizationId,
    tenantId: record.tenantId,
    code: record.code,
    title: record.title,
    description: record.description ?? null,
    sortOrder: record.sortOrder ?? 0,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

const createServiceLineCommand: CommandHandler<ServiceLineCreateInput, { serviceLineId: string }> = {
  id: 'catalog.serviceLines.create',
  async execute(input, ctx) {
    const parsed = serviceLineCreateSchema.parse(input)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const existing = await em.findOne(CatalogServiceLine, {
      code: parsed.code,
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      deletedAt: null,
    })
    if (existing) {
      throw new CrudHttpError(400, { error: 'Service line code already exists for this organization.' })
    }
    const now = new Date()
    const record = em.create(CatalogServiceLine, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      code: parsed.code,
      title: parsed.title,
      description: parsed.description ?? null,
      sortOrder: parsed.sortOrder ?? 0,
      isActive: parsed.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(record)
    await em.flush()
    return { serviceLineId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadServiceLineSnapshot(em, result.serviceLineId)
  },
  buildLog: async ({ snapshots }) => {
    const after = snapshots.after as ServiceLineSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('catalog.audit.serviceLines.create', 'Create catalog service line'),
      resourceKind: 'catalog.serviceLine',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
      payload: {
        undo: { after } satisfies ServiceLineUndoPayload,
      },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<ServiceLineUndoPayload>(logEntry)
    const after = payload?.after
    if (!after) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(CatalogServiceLine, { id: after.id })
    if (!record) return
    ensureTenantScope(ctx, record.tenantId)
    ensureOrganizationScope(ctx, record.organizationId)
    em.remove(record)
    await em.flush()
  },
}

const updateServiceLineCommand: CommandHandler<ServiceLineUpdateInput, { serviceLineId: string }> = {
  id: 'catalog.serviceLines.update',
  async prepare(input, ctx) {
    const id = requireId(input, 'Service line id is required')
    const em = ctx.container.resolve('em') as EntityManager
    const snapshot = await loadServiceLineSnapshot(em, id)
    if (snapshot) {
      ensureTenantScope(ctx, snapshot.tenantId)
      ensureOrganizationScope(ctx, snapshot.organizationId)
    }
    return snapshot ? { before: snapshot } : {}
  },
  async execute(input, ctx) {
    const parsed = serviceLineUpdateSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(CatalogServiceLine, { id: parsed.id, deletedAt: null })
    if (!record) throw new CrudHttpError(404, { error: 'Catalog service line not found' })
    ensureTenantScope(ctx, record.tenantId)
    ensureOrganizationScope(ctx, record.organizationId)

    if (parsed.code && parsed.code !== record.code) {
      const conflict = await em.findOne(CatalogServiceLine, {
        code: parsed.code,
        organizationId: record.organizationId,
        tenantId: record.tenantId,
        deletedAt: null,
      })
      if (conflict) {
        throw new CrudHttpError(400, { error: 'Service line code already exists.' })
      }
      record.code = parsed.code
    }

    if (parsed.title !== undefined) record.title = parsed.title
    if (parsed.description !== undefined) record.description = parsed.description ?? null
    if (parsed.sortOrder !== undefined) record.sortOrder = parsed.sortOrder
    if (parsed.isActive !== undefined) record.isActive = parsed.isActive

    await em.flush()
    return { serviceLineId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadServiceLineSnapshot(em, result.serviceLineId)
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as ServiceLineSnapshot | undefined
    const after = snapshots.after as ServiceLineSnapshot | undefined
    if (!before || !after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('catalog.audit.serviceLines.update', 'Update catalog service line'),
      resourceKind: 'catalog.serviceLine',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      snapshotAfter: after,
      changes: buildChanges(before as Record<string, unknown>, after as Record<string, unknown>, SERVICE_LINE_CHANGE_KEYS),
      payload: {
        undo: { before, after } satisfies ServiceLineUndoPayload,
      },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<ServiceLineUndoPayload>(logEntry)
    const before = payload?.before
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(CatalogServiceLine, { id: before.id })
    if (!record) return
    ensureTenantScope(ctx, before.tenantId)
    ensureOrganizationScope(ctx, before.organizationId)
    record.code = before.code
    record.title = before.title
    record.description = before.description
    record.sortOrder = before.sortOrder
    record.isActive = before.isActive
    record.updatedAt = new Date(before.updatedAt)
    await em.flush()
  },
}

const deleteServiceLineCommand: CommandHandler<{ id?: string }, { serviceLineId: string }> = {
  id: 'catalog.serviceLines.delete',
  async prepare(input, ctx) {
    const id = requireId(input, 'Service line id is required')
    const em = ctx.container.resolve('em') as EntityManager
    const snapshot = await loadServiceLineSnapshot(em, id)
    if (snapshot) {
      ensureTenantScope(ctx, snapshot.tenantId)
      ensureOrganizationScope(ctx, snapshot.organizationId)
    }
    return snapshot ? { before: snapshot } : {}
  },
  async execute(input, ctx) {
    const id = requireId(input, 'Service line id is required')
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(CatalogServiceLine, { id, deletedAt: null })
    if (!record) throw new CrudHttpError(404, { error: 'Catalog service line not found' })
    ensureTenantScope(ctx, record.tenantId)
    ensureOrganizationScope(ctx, record.organizationId)

    const usage = await em.count(CatalogProductServiceLineExtension, {
      serviceLine: record.id,
    })
    if (usage > 0) {
      throw new CrudHttpError(400, {
        error: 'Cannot delete service line while products reference it. Clear the service line on those products first.',
      })
    }

    record.deletedAt = new Date()
    record.isActive = false
    await em.flush()
    return { serviceLineId: record.id }
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as ServiceLineSnapshot | undefined
    if (!before) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('catalog.audit.serviceLines.delete', 'Delete catalog service line'),
      resourceKind: 'catalog.serviceLine',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      payload: {
        undo: { before } satisfies ServiceLineUndoPayload,
      },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<ServiceLineUndoPayload>(logEntry)
    const before = payload?.before
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    let record = await em.findOne(CatalogServiceLine, { id: before.id })
    if (!record) {
      record = em.create(CatalogServiceLine, {
        id: before.id,
        organizationId: before.organizationId,
        tenantId: before.tenantId,
        code: before.code,
        title: before.title,
        description: before.description,
        sortOrder: before.sortOrder,
        isActive: before.isActive,
        createdAt: new Date(before.createdAt),
        updatedAt: new Date(before.updatedAt),
      })
      em.persist(record)
    } else {
      ensureTenantScope(ctx, before.tenantId)
      ensureOrganizationScope(ctx, before.organizationId)
      record.deletedAt = null
      record.isActive = before.isActive
      record.code = before.code
      record.title = before.title
      record.description = before.description
      record.sortOrder = before.sortOrder
    }
    await em.flush()
  },
}

registerCommand(createServiceLineCommand)
registerCommand(updateServiceLineCommand)
registerCommand(deleteServiceLineCommand)
