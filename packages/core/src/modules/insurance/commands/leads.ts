import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { emitCrudSideEffects, requireId } from '@open-mercato/shared/lib/commands/helpers'
import { extractUndoPayload, type UndoPayload } from '@open-mercato/shared/lib/commands/undo'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError, isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { CrudEventsConfig } from '@open-mercato/shared/lib/crud/types'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import { InsuranceLead, InsurancePolicy } from '../data/entities'
import { assertCustomerIsReferringParty } from '../lib/referringParty'
import {
  insuranceLeadCreateSchema,
  insuranceLeadUpdateSchema,
  type InsuranceLeadCreateInput,
  type InsuranceLeadUpdateInput,
} from '../data/validators'

const leadCrudEvents: CrudEventsConfig<InsuranceLead> = {
  module: 'insurance',
  entity: 'lead',
  persistent: true,
  buildPayload: (ctx) => ({
    id: ctx.identifiers.id,
    organizationId: ctx.identifiers.organizationId,
    tenantId: ctx.identifiers.tenantId,
  }),
}

type LeadSnapshot = {
  id: string
  organizationId: string
  tenantId: string
  title: string
  status: string
  source: string | null
  externalId: string | null
  payload: Record<string, unknown> | null
  referringPartnerEntityId: string | null
  linkedPolicyId: string | null
  createdAt: string
  updatedAt: string
}

type LeadUndoPayload = UndoPayload<LeadSnapshot>

async function loadLeadSnapshot(em: EntityManager, id: string): Promise<LeadSnapshot | null> {
  const record = await em.findOne(InsuranceLead, { id, deletedAt: null }, { populate: ['linkedPolicy'] })
  if (!record) return null
  const lp = record.linkedPolicy
  const linkedPolicyId = lp === null || lp === undefined ? null : typeof lp === 'string' ? lp : lp.id
  return {
    id: record.id,
    organizationId: record.organizationId,
    tenantId: record.tenantId,
    title: record.title,
    status: record.status,
    source: record.source ?? null,
    externalId: record.externalId ?? null,
    payload: record.payload ? { ...record.payload } : null,
    referringPartnerEntityId: record.referringPartnerEntityId ?? null,
    linkedPolicyId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

async function enforceReferringPartnerOptional(
  em: EntityManager,
  entityId: string | null | undefined,
  organizationId: string,
  tenantId: string,
): Promise<void> {
  if (entityId == null || entityId === '') return
  try {
    await assertCustomerIsReferringParty(em, entityId, organizationId, tenantId)
  } catch (err) {
    if (!isCrudHttpError(err)) throw err
    const code = err.body?.error
    if (code === 'insurance.policies.errors.referringPartnerNotFound') {
      throw new CrudHttpError(400, { error: 'insurance.leads.errors.referringPartnerNotFound' })
    }
    if (code === 'insurance.policies.errors.referringPartyNotPartnerOrReferrer') {
      throw new CrudHttpError(400, { error: 'insurance.leads.errors.referringPartyNotPartnerOrReferrer' })
    }
    throw err
  }
}

const createLeadCommand: CommandHandler<InsuranceLeadCreateInput, { leadId: string }> = {
  id: 'insurance.leads.create',
  async execute(input, ctx) {
    const parsed = insuranceLeadCreateSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const externalId =
      parsed.externalId && parsed.externalId.trim().length > 0 ? parsed.externalId.trim() : null
    if (externalId) {
      const dup = await em.findOne(InsuranceLead, {
        organizationId: parsed.organizationId,
        tenantId: parsed.tenantId,
        externalId,
        deletedAt: null,
      })
      if (dup) {
        throw new CrudHttpError(400, { error: 'insurance.leads.errors.duplicateExternalId' })
      }
    }
    await enforceReferringPartnerOptional(
      em,
      parsed.referringPartnerEntityId,
      parsed.organizationId,
      parsed.tenantId,
    )
    const record = em.create(InsuranceLead, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      title: parsed.title,
      status: parsed.status?.trim().length ? parsed.status.trim() : 'received',
      source: parsed.source?.trim().length ? parsed.source.trim() : null,
      externalId,
      payload: parsed.payload ?? null,
      referringPartnerEntityId: parsed.referringPartnerEntityId ?? null,
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
      events: leadCrudEvents,
    })
    return { leadId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadLeadSnapshot(em, result.leadId)
  },
  buildLog: async ({ result, snapshots }) => {
    const after = snapshots.after as LeadSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('insurance.audit.leads.create', 'Create lead'),
      resourceKind: 'insurance.lead',
      resourceId: result.leadId,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
      payload: { undo: { after } satisfies LeadUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<LeadUndoPayload>(logEntry)
    const after = payload?.after
    if (!after) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(InsuranceLead, { id: after.id })
    if (!record) return
    record.deletedAt = new Date()
    await em.flush()
  },
}

const updateLeadCommand: CommandHandler<InsuranceLeadUpdateInput, { leadId: string }> = {
  id: 'insurance.leads.update',
  async prepare(input, ctx) {
    requireId(input.id, 'Lead id is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadLeadSnapshot(em, input.id)
    return { before }
  },
  async execute(input, ctx) {
    const parsed = insuranceLeadUpdateSchema.parse(input)
    requireId(parsed.id, 'Lead id is required')
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(InsuranceLead, { id: parsed.id, deletedAt: null })
    if (!record) {
      throw new CrudHttpError(404, { error: 'insurance.leads.errors.notFound' })
    }
    if (parsed.externalId !== undefined) {
      const externalId =
        parsed.externalId && String(parsed.externalId).trim().length > 0
          ? String(parsed.externalId).trim()
          : null
      if (externalId && externalId !== record.externalId) {
        const dup = await em.findOne(InsuranceLead, {
          organizationId: record.organizationId,
          tenantId: record.tenantId,
          externalId,
          deletedAt: null,
        })
        if (dup && dup.id !== record.id) {
          throw new CrudHttpError(400, { error: 'insurance.leads.errors.duplicateExternalId' })
        }
      }
      record.externalId = externalId
    }
    if (parsed.title !== undefined) record.title = parsed.title
    if (parsed.status !== undefined) record.status = parsed.status
    if (parsed.source !== undefined) record.source = parsed.source
    if (parsed.payload !== undefined) record.payload = parsed.payload
    if (parsed.referringPartnerEntityId !== undefined) {
      await enforceReferringPartnerOptional(
        em,
        parsed.referringPartnerEntityId,
        record.organizationId,
        record.tenantId,
      )
      record.referringPartnerEntityId = parsed.referringPartnerEntityId ?? null
    }
    if (parsed.linkedPolicyId !== undefined) {
      if (parsed.linkedPolicyId === null) {
        record.linkedPolicy = null
      } else {
        const policy = await em.findOne(InsurancePolicy, {
          id: parsed.linkedPolicyId,
          organizationId: record.organizationId,
          tenantId: record.tenantId,
          deletedAt: null,
        })
        if (!policy) {
          throw new CrudHttpError(400, { error: 'insurance.leads.errors.linkedPolicyNotFound' })
        }
        record.linkedPolicy = policy
      }
    }
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
      events: leadCrudEvents,
    })
    return { leadId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadLeadSnapshot(em, result.leadId)
  },
  buildLog: async ({ input, snapshots }) => {
    const before = snapshots.before as LeadSnapshot | undefined
    const after = snapshots.after as LeadSnapshot | undefined
    if (!before || !after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('insurance.audit.leads.update', 'Update lead'),
      resourceKind: 'insurance.lead',
      resourceId: input.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotBefore: before,
      snapshotAfter: after,
      payload: { undo: { before, after } satisfies LeadUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<LeadUndoPayload>(logEntry)
    const before = payload?.before
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(InsuranceLead, { id: before.id, deletedAt: null })
    if (!record) return
    record.title = before.title
    record.status = before.status
    record.source = before.source
    record.externalId = before.externalId
    record.payload = before.payload
    record.referringPartnerEntityId = before.referringPartnerEntityId
    if (before.linkedPolicyId) {
      const pol = await em.findOne(InsurancePolicy, { id: before.linkedPolicyId, deletedAt: null })
      record.linkedPolicy = pol ?? null
    } else {
      record.linkedPolicy = null
    }
    await em.flush()
  },
}

const deleteLeadCommand: CommandHandler<{ id: string; organizationId?: string; tenantId?: string }, { leadId: string }> =
  {
    id: 'insurance.leads.delete',
    async prepare(input, ctx) {
      requireId(input.id, 'Lead id is required')
      const em = ctx.container.resolve('em') as EntityManager
      const before = await loadLeadSnapshot(em, input.id)
      return { before }
    },
    async execute(input, ctx) {
      requireId(input.id, 'Lead id is required')
      const em = (ctx.container.resolve('em') as EntityManager).fork()
      const record = await em.findOne(InsuranceLead, { id: input.id, deletedAt: null }, { populate: ['linkedPolicy'] })
      if (!record) {
        throw new CrudHttpError(404, { error: 'insurance.leads.errors.notFound' })
      }
      record.linkedPolicy = null
      record.deletedAt = new Date()
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
        events: leadCrudEvents,
      })
      return { leadId: record.id }
    },
    buildLog: async ({ input, snapshots }) => {
      const before = snapshots.before as LeadSnapshot | undefined
      if (!before) return null
      const { translate } = await resolveTranslations()
      return {
        actionLabel: translate('insurance.audit.leads.delete', 'Delete lead'),
        resourceKind: 'insurance.lead',
        resourceId: input.id,
        tenantId: before.tenantId,
        organizationId: before.organizationId,
        snapshotBefore: before,
        payload: { undo: { before } satisfies LeadUndoPayload },
      }
    },
    undo: async ({ logEntry, ctx }) => {
      const payload = extractUndoPayload<LeadUndoPayload>(logEntry)
      const before = payload?.before
      if (!before) return
      const em = (ctx.container.resolve('em') as EntityManager).fork()
      const record = await em.findOne(InsuranceLead, { id: before.id })
      if (!record) return
      record.deletedAt = null
      if (before.linkedPolicyId) {
        const pol = await em.findOne(InsurancePolicy, { id: before.linkedPolicyId, deletedAt: null })
        record.linkedPolicy = pol ?? null
      } else {
        record.linkedPolicy = null
      }
      await em.flush()
    },
  }

registerCommand(createLeadCommand)
registerCommand(updateLeadCommand)
registerCommand(deleteLeadCommand)
