import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { emitCrudSideEffects, emitCrudUndoSideEffects, requireId } from '@open-mercato/shared/lib/commands/helpers'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import { PartnerProgram, PartnerProgramMembership } from '../data/entities'
import {
  partnerProgramMembershipCreateSchema,
  partnerProgramMembershipDeleteSchema,
  type PartnerProgramMembershipCreateInput,
} from '../data/validators'
import { assertCustomerEntityIsPartnerForMembership } from '../lib/membershipPartnerValidation'
import { partnerProgramMembershipCrudEvents } from '../lib/crud'
import { ensureOrganizationScope, ensureTenantScope, extractUndoPayload } from './shared'
import { E } from '#generated/entities.ids.generated'

const membershipIndexer = { entityType: E.partner_programs.partner_program_membership }

type MembershipSnapshot = {
  id: string
  tenantId: string
  organizationId: string
  programId: string
  customerEntityId: string
  role: string | null
  joinedAt: string
  leftAt: string | null
  createdAt: string
  updatedAt: string
}

type MembershipUndoPayload = { before?: MembershipSnapshot | null; after?: MembershipSnapshot | null }

function toMembershipSnapshot(row: PartnerProgramMembership, programId: string): MembershipSnapshot {
  return {
    id: row.id,
    tenantId: row.tenantId,
    organizationId: row.organizationId,
    programId,
    customerEntityId: row.customerEntityId,
    role: row.role ?? null,
    joinedAt: row.joinedAt.toISOString(),
    leftAt: row.leftAt ? row.leftAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function resolveProgramOrThrow(
  em: EntityManager,
  programId: string,
  tenantId: string | null,
  organizationId: string | null,
): Promise<PartnerProgram> {
  const program = await findOneWithDecryption(
    em,
    PartnerProgram,
    { id: programId, deletedAt: null },
    undefined,
    { tenantId, organizationId },
  )
  if (!program) throw new CrudHttpError(404, { error: 'Partner program not found.' })
  return program
}

const createMembershipCommand: CommandHandler<PartnerProgramMembershipCreateInput, { membershipId: string }> = {
  id: 'partner_programs.memberships.create',
  async execute(input, ctx) {
    const parsed = partnerProgramMembershipCreateSchema.parse(input)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const program = await resolveProgramOrThrow(
      em,
      parsed.programId,
      ctx.auth?.tenantId ?? null,
      ctx.auth?.orgId ?? null,
    )
    if (program.tenantId !== parsed.tenantId || program.organizationId !== parsed.organizationId) {
      throw new CrudHttpError(400, { error: 'Program tenant or organization does not match.' })
    }
    await assertCustomerEntityIsPartnerForMembership(em, {
      customerEntityId: parsed.customerEntityId,
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
    })
    const duplicate = await em.findOne(PartnerProgramMembership, {
      program,
      customerEntityId: parsed.customerEntityId,
      deletedAt: null,
    })
    if (duplicate) {
      throw new CrudHttpError(409, { error: 'This partner is already a member of the program.' })
    }
    const now = new Date()
    const joinedAt = parsed.joinedAt ?? now
    const record = em.create(PartnerProgramMembership, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      program,
      customerEntityId: parsed.customerEntityId,
      role: parsed.role ?? null,
      joinedAt,
      leftAt: null,
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
      events: partnerProgramMembershipCrudEvents,
      indexer: membershipIndexer,
    })
    return { membershipId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await em.findOne(
      PartnerProgramMembership,
      { id: result.membershipId },
      { populate: ['program'] },
    )
    if (!row) return null
    const proc = row.program
    const programId = typeof proc === 'string' ? proc : proc.id
    return toMembershipSnapshot(row, programId)
  },
  buildLog: async ({ result, snapshots }) => {
    const after = snapshots.after as MembershipSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('partner_programs.audit.memberships.create', 'Add partner program member'),
      resourceKind: 'partner_programs.membership',
      resourceId: result.membershipId,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
      payload: { undo: { after } satisfies MembershipUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<MembershipUndoPayload>(logEntry)
    const after = payload?.after
    if (!after) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await em.findOne(PartnerProgramMembership, { id: after.id })
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
      events: partnerProgramMembershipCrudEvents,
      indexer: membershipIndexer,
    })
  },
}

const deleteMembershipCommand: CommandHandler<{ id: string }, { membershipId: string }> = {
  id: 'partner_programs.memberships.delete',
  async prepare(input, ctx) {
    const id = requireId(input.id, 'Membership id is required')
    const em = ctx.container.resolve('em') as EntityManager
    const row = await em.findOne(PartnerProgramMembership, { id }, { populate: ['program'] })
    if (!row || row.deletedAt) return {}
    const proc = row.program
    const programId = typeof proc === 'string' ? proc : proc.id
    return { before: toMembershipSnapshot(row, programId) }
  },
  async execute(input, ctx) {
    const parsed = partnerProgramMembershipDeleteSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await findOneWithDecryption(
      em,
      PartnerProgramMembership,
      { id: parsed.id, deletedAt: null },
      { populate: ['program'] },
      { tenantId: ctx.auth?.tenantId ?? null, organizationId: ctx.auth?.orgId ?? null },
    )
    if (!record) throw new CrudHttpError(404, { error: 'Membership not found.' })
    const proc = record.program
    const program = typeof proc === 'string' ? await em.findOne(PartnerProgram, { id: proc }) : proc
    if (!program || program.deletedAt) throw new CrudHttpError(404, { error: 'Partner program not found.' })
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
      events: partnerProgramMembershipCrudEvents,
      indexer: membershipIndexer,
    })
    return { membershipId: record.id }
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as MembershipSnapshot | undefined
    if (!before) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('partner_programs.audit.memberships.delete', 'Remove partner program member'),
      resourceKind: 'partner_programs.membership',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      payload: { undo: { before } satisfies MembershipUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<MembershipUndoPayload>(logEntry)
    const before =
      payload?.before ?? (logEntry?.snapshotBefore as MembershipSnapshot | null | undefined)
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    let row = await em.findOne(PartnerProgramMembership, { id: before.id })
    const program = await em.findOne(PartnerProgram, { id: before.programId })
    if (!program) return
    if (!row) {
      row = em.create(PartnerProgramMembership, {
        id: before.id,
        tenantId: before.tenantId,
        organizationId: before.organizationId,
        program,
        customerEntityId: before.customerEntityId,
        role: before.role,
        joinedAt: new Date(before.joinedAt),
        leftAt: before.leftAt ? new Date(before.leftAt) : null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      em.persist(row)
    } else {
      row.deletedAt = null
      row.role = before.role
      row.joinedAt = new Date(before.joinedAt)
      row.leftAt = before.leftAt ? new Date(before.leftAt) : null
      row.updatedAt = new Date()
    }
    await em.flush()
    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudUndoSideEffects({
      dataEngine,
      action: 'created',
      entity: row,
      identifiers: { id: row.id, organizationId: row.organizationId, tenantId: row.tenantId },
      events: partnerProgramMembershipCrudEvents,
      indexer: membershipIndexer,
    })
  },
}

registerCommand(createMembershipCommand)
registerCommand(deleteMembershipCommand)
