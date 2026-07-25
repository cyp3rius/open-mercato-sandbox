import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import {
  buildChanges,
  emitCrudSideEffects,
  emitCrudUndoSideEffects,
  requireId,
} from '@open-mercato/shared/lib/commands/helpers'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import { PartnerProgram } from '../data/entities'
import {
  partnerProgramCreateSchema,
  partnerProgramDeleteSchema,
  partnerProgramUpdateSchema,
  type PartnerProgramCreateInput,
  type PartnerProgramUpdateInput,
} from '../data/validators'
import { partnerProgramCrudEvents } from '../lib/crud'
import { ensureOrganizationScope, ensureTenantScope, extractUndoPayload } from './shared'
import { E } from '#generated/entities.ids.generated'

const programIndexer = { entityType: E.partner_programs.partner_program }

type ProgramSnapshot = {
  id: string
  tenantId: string
  organizationId: string
  name: string
  description: string | null
  validFrom: string | null
  validTo: string | null
  isActive: boolean
  incentivePercent: string
  incentiveBase: string
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

type ProgramUndoPayload = { before?: ProgramSnapshot | null; after?: ProgramSnapshot | null }

function toSnapshot(row: PartnerProgram): ProgramSnapshot {
  return {
    id: row.id,
    tenantId: row.tenantId,
    organizationId: row.organizationId,
    name: row.name,
    description: row.description ?? null,
    validFrom: row.validFrom ? row.validFrom.toISOString() : null,
    validTo: row.validTo ? row.validTo.toISOString() : null,
    isActive: row.isActive,
    incentivePercent: row.incentivePercent ?? '0',
    incentiveBase: row.incentiveBase === 'gross' ? 'gross' : 'net',
    metadata: (row.metadata as Record<string, unknown> | null | undefined) ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function loadProgramSnapshot(em: EntityManager, id: string): Promise<ProgramSnapshot | null> {
  const row = await findOneWithDecryption(
    em,
    PartnerProgram,
    { id, deletedAt: null },
    undefined,
    { tenantId: null, organizationId: null },
  )
  return row ? toSnapshot(row) : null
}

const createProgramCommand: CommandHandler<PartnerProgramCreateInput, { programId: string }> = {
  id: 'partner_programs.programs.create',
  async execute(input, ctx) {
    const parsed = partnerProgramCreateSchema.parse(input)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const now = new Date()
    const record = em.create(PartnerProgram, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      name: parsed.name,
      description: parsed.description ?? null,
      validFrom: parsed.validFrom ?? null,
      validTo: parsed.validTo ?? null,
      isActive: parsed.isActive ?? true,
      incentivePercent: String(parsed.incentivePercent ?? 0),
      incentiveBase: parsed.incentiveBase === 'gross' ? 'gross' : 'net',
      metadata: parsed.metadata ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    em.persist(record)
    await em.flush()
    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine,
      action: 'created',
      entity: record,
      identifiers: { id: record.id, organizationId: record.organizationId, tenantId: record.tenantId },
      events: partnerProgramCrudEvents,
      indexer: programIndexer,
    })
    return { programId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadProgramSnapshot(em, result.programId)
  },
  buildLog: async ({ result, snapshots }) => {
    const after = snapshots.after as ProgramSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('partner_programs.audit.programs.create', 'Create partner program'),
      resourceKind: 'partner_programs.program',
      resourceId: result.programId,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
      payload: { undo: { after } satisfies ProgramUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<ProgramUndoPayload>(logEntry)
    const after = payload?.after
    if (!after) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await em.findOne(PartnerProgram, { id: after.id })
    if (!row) return
    row.deletedAt = new Date()
    row.updatedAt = new Date()
    await em.flush()
    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudUndoSideEffects({
      dataEngine,
      action: 'deleted',
      entity: row,
      identifiers: { id: row.id, organizationId: row.organizationId, tenantId: row.tenantId },
      events: partnerProgramCrudEvents,
      indexer: programIndexer,
    })
  },
}

const updateProgramCommand: CommandHandler<PartnerProgramUpdateInput, { programId: string }> = {
  id: 'partner_programs.programs.update',
  async prepare(input, ctx) {
    requireId(input.id, 'Program id is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadProgramSnapshot(em, input.id)
    return { before }
  },
  async execute(input, ctx) {
    const parsed = partnerProgramUpdateSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await findOneWithDecryption(
      em,
      PartnerProgram,
      { id: parsed.id, deletedAt: null },
      undefined,
      { tenantId: ctx.auth?.tenantId ?? null, organizationId: ctx.auth?.orgId ?? null },
    )
    if (!record) throw new CrudHttpError(404, { error: 'Partner program not found.' })
    ensureTenantScope(ctx, record.tenantId)
    ensureOrganizationScope(ctx, record.organizationId)

    const changes = buildChanges(record as unknown as Record<string, unknown>, parsed as Record<string, unknown>, [
      'name',
      'description',
      'validFrom',
      'validTo',
      'isActive',
      'incentivePercent',
      'incentiveBase',
      'metadata',
    ])
    for (const [key, change] of Object.entries(changes)) {
      if (change.to !== undefined) {
        if (key === 'incentivePercent') {
          record.incentivePercent = String(change.to)
        } else if (key === 'incentiveBase') {
          record.incentiveBase = change.to === 'gross' ? 'gross' : 'net'
        } else {
          ;(record as unknown as Record<string, unknown>)[key] = change.to
        }
      }
    }
    record.updatedAt = new Date()
    await em.flush()
    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine,
      action: 'updated',
      entity: record,
      identifiers: { id: record.id, organizationId: record.organizationId, tenantId: record.tenantId },
      events: partnerProgramCrudEvents,
      indexer: programIndexer,
    })
    return { programId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadProgramSnapshot(em, result.programId)
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as ProgramSnapshot | undefined
    const after = snapshots.after as ProgramSnapshot | undefined
    if (!before || !after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('partner_programs.audit.programs.update', 'Update partner program'),
      resourceKind: 'partner_programs.program',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      snapshotAfter: after,
      payload: { undo: { before, after } satisfies ProgramUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<ProgramUndoPayload>(logEntry)
    const before = payload?.before
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await em.findOne(PartnerProgram, { id: before.id })
    if (!row) return
    row.name = before.name
    row.description = before.description
    row.validFrom = before.validFrom ? new Date(before.validFrom) : null
    row.validTo = before.validTo ? new Date(before.validTo) : null
    row.isActive = before.isActive
    row.incentivePercent = before.incentivePercent ?? '0'
    row.incentiveBase = before.incentiveBase === 'gross' ? 'gross' : 'net'
    row.metadata = before.metadata
    row.updatedAt = new Date()
    await em.flush()
    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudUndoSideEffects({
      dataEngine,
      action: 'updated',
      entity: row,
      identifiers: { id: row.id, organizationId: row.organizationId, tenantId: row.tenantId },
      events: partnerProgramCrudEvents,
      indexer: programIndexer,
    })
  },
}

const deleteProgramCommand: CommandHandler<{ id: string }, { programId: string }> = {
  id: 'partner_programs.programs.delete',
  async prepare(input, ctx) {
    const id = requireId(input.id, 'Program id is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadProgramSnapshot(em, id)
    return { before }
  },
  async execute(input, ctx) {
    const parsed = partnerProgramDeleteSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await findOneWithDecryption(
      em,
      PartnerProgram,
      { id: parsed.id, deletedAt: null },
      undefined,
      { tenantId: ctx.auth?.tenantId ?? null, organizationId: ctx.auth?.orgId ?? null },
    )
    if (!record) throw new CrudHttpError(404, { error: 'Partner program not found.' })
    ensureTenantScope(ctx, record.tenantId)
    ensureOrganizationScope(ctx, record.organizationId)
    const now = new Date()
    record.deletedAt = now
    record.updatedAt = now
    await em.flush()
    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine,
      action: 'deleted',
      entity: record,
      identifiers: { id: record.id, organizationId: record.organizationId, tenantId: record.tenantId },
      events: partnerProgramCrudEvents,
      indexer: programIndexer,
    })
    return { programId: record.id }
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as ProgramSnapshot | undefined
    if (!before) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('partner_programs.audit.programs.delete', 'Delete partner program'),
      resourceKind: 'partner_programs.program',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      payload: { undo: { before } satisfies ProgramUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<ProgramUndoPayload>(logEntry)
    const before =
      payload?.before ?? (logEntry?.snapshotBefore as ProgramSnapshot | null | undefined)
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    let row = await em.findOne(PartnerProgram, { id: before.id })
    if (!row) {
      row = em.create(PartnerProgram, {
        id: before.id,
        tenantId: before.tenantId,
        organizationId: before.organizationId,
        name: before.name,
        description: before.description,
        validFrom: before.validFrom ? new Date(before.validFrom) : null,
        validTo: before.validTo ? new Date(before.validTo) : null,
        isActive: before.isActive,
        incentivePercent: before.incentivePercent ?? '0',
        incentiveBase: before.incentiveBase === 'gross' ? 'gross' : 'net',
        metadata: before.metadata,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      em.persist(row)
    } else {
      row.name = before.name
      row.description = before.description
      row.validFrom = before.validFrom ? new Date(before.validFrom) : null
      row.validTo = before.validTo ? new Date(before.validTo) : null
      row.isActive = before.isActive
      row.incentivePercent = before.incentivePercent ?? '0'
      row.incentiveBase = before.incentiveBase === 'gross' ? 'gross' : 'net'
      row.metadata = before.metadata
      row.deletedAt = null
      row.updatedAt = new Date()
    }
    await em.flush()
    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudUndoSideEffects({
      dataEngine,
      action: 'created',
      entity: row,
      identifiers: { id: row.id, organizationId: row.organizationId, tenantId: row.tenantId },
      events: partnerProgramCrudEvents,
      indexer: programIndexer,
    })
  },
}

registerCommand(createProgramCommand)
registerCommand(updateProgramCommand)
registerCommand(deleteProgramCommand)
