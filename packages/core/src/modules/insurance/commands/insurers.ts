import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { buildChanges, emitCrudSideEffects, requireId } from '@open-mercato/shared/lib/commands/helpers'
import { extractUndoPayload, type UndoPayload } from '@open-mercato/shared/lib/commands/undo'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { CrudEventsConfig } from '@open-mercato/shared/lib/crud/types'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import { InsuranceInsurer } from '../data/entities'
import {
  insuranceInsurerCreateSchema,
  insuranceInsurerUpdateSchema,
  resolveInsurerStatusFromInput,
  resolveInsurerStatusOnUpdate,
  type InsuranceInsurerCreateInput,
  type InsuranceInsurerUpdateInput,
} from '../data/validators'

const insurerCrudEvents: CrudEventsConfig<InsuranceInsurer> = {
  module: 'insurance',
  entity: 'insurer',
  persistent: true,
  buildPayload: (ctx) => ({
    id: ctx.identifiers.id,
    organizationId: ctx.identifiers.organizationId,
    tenantId: ctx.identifiers.tenantId,
  }),
}

type InsurerSnapshot = {
  id: string
  organizationId: string
  tenantId: string
  code: string
  name: string
  description: string | null
  status: string
  isActive: boolean
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

type InsurerUndoPayload = UndoPayload<InsurerSnapshot>

async function loadInsurerSnapshot(em: EntityManager, id: string): Promise<InsurerSnapshot | null> {
  const record = await em.findOne(InsuranceInsurer, { id, deletedAt: null })
  if (!record) return null
  return {
    id: record.id,
    organizationId: record.organizationId,
    tenantId: record.tenantId,
    code: record.code,
    name: record.name,
    description: record.description ?? null,
    status: record.status,
    isActive: !!record.isActive,
    metadata: record.metadata ? { ...record.metadata } : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

const createInsurerCommand: CommandHandler<InsuranceInsurerCreateInput, { insurerId: string }> = {
  id: 'insurance.insurers.create',
  async execute(input, ctx) {
    const parsed = insuranceInsurerCreateSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const existing = await em.findOne(InsuranceInsurer, {
      code: parsed.code,
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      deletedAt: null,
    })
    if (existing) {
      throw new CrudHttpError(400, { error: 'insurance.insurers.errors.duplicateCode' })
    }
    const status = resolveInsurerStatusFromInput(parsed)
    const record = em.create(InsuranceInsurer, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      code: parsed.code,
      name: parsed.name,
      description: parsed.description ?? null,
      status,
      isActive: status !== 'inactive',
      metadata: parsed.metadata ?? null,
    })
    em.persist(record)
    await em.flush()
    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine,
      action: 'created',
      entity: record,
      identifiers: {
        id: record.id,
        organizationId: record.organizationId,
        tenantId: record.tenantId,
      },
      events: insurerCrudEvents,
    })
    return { insurerId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadInsurerSnapshot(em, result.insurerId)
  },
  buildLog: async ({ result, snapshots }) => {
    const after = snapshots.after as InsurerSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('insurance.audit.insurers.create', 'Create insurer'),
      resourceKind: 'insurance.insurer',
      resourceId: result.insurerId,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
      payload: { undo: { after } satisfies InsurerUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<InsurerUndoPayload>(logEntry)
    const after = payload?.after
    if (!after) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(InsuranceInsurer, { id: after.id })
    if (!record) return
    record.deletedAt = new Date()
    record.isActive = false
    record.status = 'inactive'
    await em.flush()
  },
}

const updateInsurerCommand: CommandHandler<InsuranceInsurerUpdateInput, { insurerId: string }> = {
  id: 'insurance.insurers.update',
  async prepare(input, ctx) {
    requireId(input.id, 'Insurer id is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadInsurerSnapshot(em, input.id)
    return { before }
  },
  async execute(input, ctx) {
    const parsed = insuranceInsurerUpdateSchema.parse(input)
    requireId(parsed.id, 'Insurer id is required')
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(InsuranceInsurer, { id: parsed.id, deletedAt: null })
    if (!record) {
      throw new CrudHttpError(404, { error: 'insurance.insurers.errors.notFound' })
    }
    if (parsed.code && parsed.code !== record.code) {
      const dup = await em.findOne(InsuranceInsurer, {
        code: parsed.code,
        organizationId: record.organizationId,
        tenantId: record.tenantId,
        id: { $ne: record.id },
        deletedAt: null,
      })
      if (dup) {
        throw new CrudHttpError(400, { error: 'insurance.insurers.errors.duplicateCode' })
      }
    }
    const changes = buildChanges(record as unknown as Record<string, unknown>, parsed, [
      'code',
      'name',
      'description',
      'metadata',
    ])
    for (const [key, change] of Object.entries(changes)) {
      if (change.to !== undefined) {
        ;(record as unknown as Record<string, unknown>)[key] = change.to
      }
    }
    const statusTouched = parsed.status !== undefined || parsed.isActive !== undefined
    if (statusTouched) {
      const nextStatus = resolveInsurerStatusOnUpdate(record.status, {
        status: parsed.status,
        isActive: parsed.isActive,
      })
      record.status = nextStatus
      record.isActive = nextStatus !== 'inactive'
    }
    record.updatedAt = new Date()
    await em.flush()
    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine,
      action: 'updated',
      entity: record,
      identifiers: {
        id: record.id,
        organizationId: record.organizationId,
        tenantId: record.tenantId,
      },
      events: insurerCrudEvents,
    })
    return { insurerId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadInsurerSnapshot(em, result.insurerId)
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as InsurerSnapshot | undefined
    const after = snapshots.after as InsurerSnapshot | undefined
    if (!before || !after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('insurance.audit.insurers.update', 'Update insurer'),
      resourceKind: 'insurance.insurer',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      snapshotAfter: after,
      payload: { undo: { before, after } satisfies InsurerUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<InsurerUndoPayload>(logEntry)
    const before = payload?.before
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(InsuranceInsurer, { id: before.id })
    if (!record) return
    record.code = before.code
    record.name = before.name
    record.description = before.description
    record.status = before.status
    record.isActive = before.isActive
    record.metadata = before.metadata ? { ...before.metadata } : null
    record.updatedAt = new Date()
    await em.flush()
  },
}

const deleteInsurerCommand: CommandHandler<{ id: string; organizationId?: string; tenantId?: string }, { insurerId: string }> = {
  id: 'insurance.insurers.delete',
  async prepare(input, ctx) {
    const id = requireId(input.id, 'Insurer id is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadInsurerSnapshot(em, id)
    return { before }
  },
  async execute(input, ctx) {
    const id = requireId(input.id, 'Insurer id is required')
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(InsuranceInsurer, { id, deletedAt: null })
    if (!record) {
      throw new CrudHttpError(404, { error: 'insurance.insurers.errors.notFound' })
    }
    record.deletedAt = new Date()
    record.isActive = false
    record.status = 'inactive'
    await em.flush()
    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine,
      action: 'deleted',
      entity: record,
      identifiers: {
        id: record.id,
        organizationId: record.organizationId,
        tenantId: record.tenantId,
      },
      events: insurerCrudEvents,
    })
    return { insurerId: record.id }
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as InsurerSnapshot | undefined
    if (!before) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('insurance.audit.insurers.delete', 'Delete insurer'),
      resourceKind: 'insurance.insurer',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      payload: { undo: { before } satisfies InsurerUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<InsurerUndoPayload>(logEntry)
    const before = payload?.before
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(InsuranceInsurer, { id: before.id })
    if (!record) return
    record.deletedAt = null
    record.status = before.status
    record.isActive = before.isActive
    record.updatedAt = new Date()
    await em.flush()
  },
}

registerCommand(createInsurerCommand)
registerCommand(updateInsurerCommand)
registerCommand(deleteInsurerCommand)
