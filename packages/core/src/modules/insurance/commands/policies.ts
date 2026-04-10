import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { emitCrudSideEffects, requireId } from '@open-mercato/shared/lib/commands/helpers'
import { extractUndoPayload, type UndoPayload } from '@open-mercato/shared/lib/commands/undo'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { CrudEventsConfig } from '@open-mercato/shared/lib/crud/types'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import { User } from '@open-mercato/core/modules/auth/data/entities'
import { CustomerEntity } from '@open-mercato/core/modules/customers/data/entities'
import { ResourcesResource } from '@open-mercato/core/modules/resources/data/entities'
import {
  InsuranceInsurer,
  InsuranceInsurerContact,
  InsuranceLead,
  InsurancePolicy,
} from '../data/entities'
import {
  insurancePolicyCreateSchema,
  insurancePolicyUpdateSchema,
  type InsurancePolicyCreateInput,
  type InsurancePolicyUpdateInput,
} from '../data/validators'
import { assertCustomerIsReferringParty } from '../lib/referringParty'

const policyCrudEvents: CrudEventsConfig<InsurancePolicy> = {
  module: 'insurance',
  entity: 'policy',
  persistent: true,
  buildPayload: (ctx) => ({
    id: ctx.identifiers.id,
    organizationId: ctx.identifiers.organizationId,
    tenantId: ctx.identifiers.tenantId,
  }),
}

type PolicySnapshot = {
  id: string
  organizationId: string
  tenantId: string
  policyNumber: string
  insurerId: string
  insurerContactId: string | null
  caretakerUserId: string | null
  referringPartnerEntityId: string
  catalogProductId: string | null
  resourceId: string | null
  insuredPersonEntityId: string | null
  insuredCompanyEntityId: string | null
  validFrom: string | null
  validTo: string | null
  status: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

type PolicyUndoPayload = UndoPayload<PolicySnapshot>

async function loadPolicySnapshot(em: EntityManager, id: string): Promise<PolicySnapshot | null> {
  const record = await em.findOne(
    InsurancePolicy,
    { id, deletedAt: null },
    { populate: ['insurer', 'insurerContact'] },
  )
  if (!record) return null
  const ins = record.insurer
  const insurerId = typeof ins === 'string' ? ins : ins.id
  const ic = record.insurerContact
  const insurerContactId =
    ic === null || ic === undefined ? null : typeof ic === 'string' ? ic : ic.id
  return {
    id: record.id,
    organizationId: record.organizationId,
    tenantId: record.tenantId,
    policyNumber: record.policyNumber,
    insurerId,
    insurerContactId,
    caretakerUserId: record.caretakerUserId ?? null,
    referringPartnerEntityId: record.referringPartnerEntityId,
    catalogProductId: record.catalogProductId ?? null,
    resourceId: record.resourceId ?? null,
    insuredPersonEntityId: record.insuredPersonEntityId ?? null,
    insuredCompanyEntityId: record.insuredCompanyEntityId ?? null,
    validFrom: record.validFrom ? record.validFrom.toISOString() : null,
    validTo: record.validTo ? record.validTo.toISOString() : null,
    status: record.status ?? null,
    metadata: record.metadata ? { ...record.metadata } : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

async function enforceResource(
  em: EntityManager,
  resourceId: string,
  organizationId: string,
  tenantId: string,
): Promise<void> {
  const resource = await em.findOne(ResourcesResource, {
    id: resourceId,
    organizationId,
    tenantId,
    deletedAt: null,
  })
  if (!resource) {
    throw new CrudHttpError(400, { error: 'insurance.policies.errors.resourceNotFound' })
  }
}

async function enforceReferringPartner(
  em: EntityManager,
  entityId: string,
  organizationId: string,
  tenantId: string,
): Promise<void> {
  await assertCustomerIsReferringParty(em, entityId, organizationId, tenantId)
}

async function enforceInsuredCustomerEntity(
  em: EntityManager,
  id: string,
  organizationId: string,
  tenantId: string,
  kind: 'person' | 'company',
  errorKey: string,
): Promise<void> {
  const entity = await em.findOne(CustomerEntity, {
    id,
    organizationId,
    tenantId,
    kind,
    deletedAt: null,
  })
  if (!entity) {
    throw new CrudHttpError(400, { error: errorKey })
  }
}

async function enforceCaretakerUser(
  em: EntityManager,
  userId: string,
  organizationId: string,
  tenantId: string,
): Promise<void> {
  const user = await em.findOne(User, {
    id: userId,
    tenantId,
    deletedAt: null,
  })
  if (!user) {
    throw new CrudHttpError(400, { error: 'insurance.policies.errors.caretakerNotFound' })
  }
  if (user.organizationId && user.organizationId !== organizationId) {
    throw new CrudHttpError(400, { error: 'insurance.policies.errors.caretakerOrgMismatch' })
  }
}

async function enforceInsurerContact(
  em: EntityManager,
  contactId: string,
  insurerId: string,
  organizationId: string,
  tenantId: string,
): Promise<InsuranceInsurerContact> {
  const contact = await em.findOne(
    InsuranceInsurerContact,
    { id: contactId, organizationId, tenantId, deletedAt: null },
    { populate: ['insurer'] },
  )
  if (!contact) {
    throw new CrudHttpError(404, { error: 'insurance.insurerContacts.errors.notFound' })
  }
  const cIns = contact.insurer
  const cInsurerId = typeof cIns === 'string' ? cIns : cIns.id
  if (cInsurerId !== insurerId) {
    throw new CrudHttpError(400, { error: 'insurance.policies.errors.contactInsurerMismatch' })
  }
  return contact
}

const createPolicyCommand: CommandHandler<InsurancePolicyCreateInput, { policyId: string }> = {
  id: 'insurance.policies.create',
  async execute(input, ctx) {
    const parsed = insurancePolicyCreateSchema.parse(input)
    const { sourceLeadId, ...policyBody } = parsed
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    await enforceReferringPartner(
      em,
      policyBody.referringPartnerEntityId,
      policyBody.organizationId,
      policyBody.tenantId,
    )
    const insurer = await em.findOne(InsuranceInsurer, {
      id: policyBody.insurerId,
      organizationId: policyBody.organizationId,
      tenantId: policyBody.tenantId,
      deletedAt: null,
    })
    if (!insurer) {
      throw new CrudHttpError(404, { error: 'insurance.insurers.errors.notFound' })
    }
    let contactRef: InsuranceInsurerContact | null = null
    if (policyBody.insurerContactId) {
      contactRef = await enforceInsurerContact(
        em,
        policyBody.insurerContactId,
        insurer.id,
        policyBody.organizationId,
        policyBody.tenantId,
      )
    }
    if (policyBody.resourceId) {
      await enforceResource(em, policyBody.resourceId, policyBody.organizationId, policyBody.tenantId)
    }
    if (policyBody.insuredPersonEntityId) {
      await enforceInsuredCustomerEntity(
        em,
        policyBody.insuredPersonEntityId,
        policyBody.organizationId,
        policyBody.tenantId,
        'person',
        'insurance.policies.errors.insuredPersonNotFound',
      )
    }
    if (policyBody.insuredCompanyEntityId) {
      await enforceInsuredCustomerEntity(
        em,
        policyBody.insuredCompanyEntityId,
        policyBody.organizationId,
        policyBody.tenantId,
        'company',
        'insurance.policies.errors.insuredCompanyNotFound',
      )
    }
    if (policyBody.caretakerUserId) {
      await enforceCaretakerUser(em, policyBody.caretakerUserId, policyBody.organizationId, policyBody.tenantId)
    }
    const record = em.create(InsurancePolicy, {
      organizationId: policyBody.organizationId,
      tenantId: policyBody.tenantId,
      policyNumber: policyBody.policyNumber,
      insurer,
      insurerContact: contactRef,
      caretakerUserId: policyBody.caretakerUserId ?? null,
      referringPartnerEntityId: policyBody.referringPartnerEntityId,
      catalogProductId: policyBody.catalogProductId ?? null,
      resourceId: policyBody.resourceId ?? null,
      insuredPersonEntityId: policyBody.insuredPersonEntityId ?? null,
      insuredCompanyEntityId: policyBody.insuredCompanyEntityId ?? null,
      validFrom: policyBody.validFrom ?? null,
      validTo: policyBody.validTo ?? null,
      status: policyBody.status,
      metadata: policyBody.metadata ?? null,
    })
    em.persist(record)
    await em.flush()
    if (sourceLeadId) {
      const lead = await em.findOne(
        InsuranceLead,
        {
          id: sourceLeadId,
          organizationId: policyBody.organizationId,
          tenantId: policyBody.tenantId,
          deletedAt: null,
        },
        { populate: ['linkedPolicy'] },
      )
      if (!lead) {
        throw new CrudHttpError(400, { error: 'insurance.policies.errors.sourceLeadNotFound' })
      }
      const existing = lead.linkedPolicy
      const existingId =
        existing === null || existing === undefined ? null : typeof existing === 'string' ? existing : existing.id
      if (existingId && existingId !== record.id) {
        throw new CrudHttpError(400, { error: 'insurance.policies.errors.sourceLeadAlreadyLinked' })
      }
      if (!existingId) {
        lead.linkedPolicy = record
        lead.status = 'policy_created'
        await em.flush()
      }
    }
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
      events: policyCrudEvents,
    })
    return { policyId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadPolicySnapshot(em, result.policyId)
  },
  buildLog: async ({ result, snapshots }) => {
    const after = snapshots.after as PolicySnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('insurance.audit.policies.create', 'Create policy'),
      resourceKind: 'insurance.policy',
      resourceId: result.policyId,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
      payload: { undo: { after } satisfies PolicyUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<PolicyUndoPayload>(logEntry)
    const after = payload?.after
    if (!after) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(InsurancePolicy, { id: after.id })
    if (!record) return
    record.deletedAt = new Date()
    await em.flush()
  },
}

const updatePolicyCommand: CommandHandler<InsurancePolicyUpdateInput, { policyId: string }> = {
  id: 'insurance.policies.update',
  async prepare(input, ctx) {
    requireId(input.id, 'Policy id is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadPolicySnapshot(em, input.id)
    return { before }
  },
  async execute(input, ctx) {
    const parsed = insurancePolicyUpdateSchema.parse(input)
    requireId(parsed.id, 'Policy id is required')
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(InsurancePolicy, { id: parsed.id, deletedAt: null }, {
      populate: ['insurer', 'insurerContact'],
    })
    if (!record) {
      throw new CrudHttpError(404, { error: 'insurance.policies.errors.notFound' })
    }
    if (parsed.referringPartnerEntityId) {
      await enforceReferringPartner(
        em,
        parsed.referringPartnerEntityId,
        record.organizationId,
        record.tenantId,
      )
      record.referringPartnerEntityId = parsed.referringPartnerEntityId
    }
    if (parsed.insurerId) {
      const insurer = await em.findOne(InsuranceInsurer, {
        id: parsed.insurerId,
        organizationId: record.organizationId,
        tenantId: record.tenantId,
        deletedAt: null,
      })
      if (!insurer) {
        throw new CrudHttpError(404, { error: 'insurance.insurers.errors.notFound' })
      }
      record.insurer = insurer
    }
    if (parsed.insurerContactId !== undefined) {
      if (parsed.insurerContactId === null) {
        record.insurerContact = null
      } else {
        const ins = record.insurer
        const insurerId = typeof ins === 'string' ? ins : ins.id
        const contact = await enforceInsurerContact(
          em,
          parsed.insurerContactId,
          insurerId,
          record.organizationId,
          record.tenantId,
        )
        record.insurerContact = contact
      }
    }
    if (parsed.caretakerUserId !== undefined) {
      if (parsed.caretakerUserId === null) {
        record.caretakerUserId = null
      } else {
        await enforceCaretakerUser(em, parsed.caretakerUserId, record.organizationId, record.tenantId)
        record.caretakerUserId = parsed.caretakerUserId
      }
    }
    if (parsed.policyNumber !== undefined) record.policyNumber = parsed.policyNumber
    if (parsed.catalogProductId !== undefined) record.catalogProductId = parsed.catalogProductId
    if (parsed.resourceId !== undefined) {
      if (parsed.resourceId) {
        await enforceResource(em, parsed.resourceId, record.organizationId, record.tenantId)
      }
      record.resourceId = parsed.resourceId
    }
    if (parsed.insuredPersonEntityId !== undefined) {
      if (parsed.insuredPersonEntityId) {
        await enforceInsuredCustomerEntity(
          em,
          parsed.insuredPersonEntityId,
          record.organizationId,
          record.tenantId,
          'person',
          'insurance.policies.errors.insuredPersonNotFound',
        )
      }
      record.insuredPersonEntityId = parsed.insuredPersonEntityId
    }
    if (parsed.insuredCompanyEntityId !== undefined) {
      if (parsed.insuredCompanyEntityId) {
        await enforceInsuredCustomerEntity(
          em,
          parsed.insuredCompanyEntityId,
          record.organizationId,
          record.tenantId,
          'company',
          'insurance.policies.errors.insuredCompanyNotFound',
        )
      }
      record.insuredCompanyEntityId = parsed.insuredCompanyEntityId
    }
    if (parsed.validFrom !== undefined) record.validFrom = parsed.validFrom
    if (parsed.validTo !== undefined) record.validTo = parsed.validTo
    if (parsed.status !== undefined) record.status = parsed.status
    if (parsed.metadata !== undefined) record.metadata = parsed.metadata
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
      events: policyCrudEvents,
    })
    return { policyId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadPolicySnapshot(em, result.policyId)
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as PolicySnapshot | undefined
    const after = snapshots.after as PolicySnapshot | undefined
    if (!before || !after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('insurance.audit.policies.update', 'Update policy'),
      resourceKind: 'insurance.policy',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      snapshotAfter: after,
      payload: { undo: { before, after } satisfies PolicyUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<PolicyUndoPayload>(logEntry)
    const before = payload?.before
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(InsurancePolicy, { id: before.id }, { populate: ['insurer', 'insurerContact'] })
    if (!record) return
    record.policyNumber = before.policyNumber
    record.insurer = em.getReference(InsuranceInsurer, before.insurerId)
    record.insurerContact = before.insurerContactId
      ? em.getReference(InsuranceInsurerContact, before.insurerContactId)
      : null
    record.caretakerUserId = before.caretakerUserId
    record.referringPartnerEntityId = before.referringPartnerEntityId
    record.catalogProductId = before.catalogProductId
    record.resourceId = before.resourceId
    record.insuredPersonEntityId = before.insuredPersonEntityId
    record.insuredCompanyEntityId = before.insuredCompanyEntityId
    record.validFrom = before.validFrom ? new Date(before.validFrom) : null
    record.validTo = before.validTo ? new Date(before.validTo) : null
    record.status = before.status
    record.metadata = before.metadata ? { ...before.metadata } : null
    record.updatedAt = new Date()
    await em.flush()
  },
}

const deletePolicyCommand: CommandHandler<{ id: string }, { policyId: string }> = {
  id: 'insurance.policies.delete',
  async prepare(input, ctx) {
    const id = requireId(input.id, 'Policy id is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadPolicySnapshot(em, id)
    return { before }
  },
  async execute(input, ctx) {
    const id = requireId(input.id, 'Policy id is required')
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(InsurancePolicy, { id, deletedAt: null })
    if (!record) {
      throw new CrudHttpError(404, { error: 'insurance.policies.errors.notFound' })
    }
    const leadsLinkedToPolicy = await em.find(InsuranceLead, {
      linkedPolicy: record,
      deletedAt: null,
    })
    for (const lead of leadsLinkedToPolicy) {
      lead.linkedPolicy = null
    }
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
      events: policyCrudEvents,
    })
    return { policyId: record.id }
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as PolicySnapshot | undefined
    if (!before) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('insurance.audit.policies.delete', 'Delete policy'),
      resourceKind: 'insurance.policy',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      payload: { undo: { before } satisfies PolicyUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<PolicyUndoPayload>(logEntry)
    const before = payload?.before
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(InsurancePolicy, { id: before.id })
    if (!record) return
    record.deletedAt = null
    record.updatedAt = new Date()
    await em.flush()
  },
}

registerCommand(createPolicyCommand)
registerCommand(updatePolicyCommand)
registerCommand(deletePolicyCommand)
