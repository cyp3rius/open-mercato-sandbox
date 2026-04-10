import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { buildChanges, emitCrudSideEffects, requireId } from '@open-mercato/shared/lib/commands/helpers'
import { extractUndoPayload, type UndoPayload } from '@open-mercato/shared/lib/commands/undo'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { CrudEventsConfig } from '@open-mercato/shared/lib/crud/types'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import { InsuranceInsurer, InsuranceInsurerContact } from '../data/entities'
import {
  insuranceInsurerContactCreateSchema,
  insuranceInsurerContactUpdateSchema,
  type InsuranceInsurerContactCreateInput,
  type InsuranceInsurerContactUpdateInput,
} from '../data/validators'

const contactCrudEvents: CrudEventsConfig<InsuranceInsurerContact> = {
  module: 'insurance',
  entity: 'insurer_contact',
  persistent: true,
  buildPayload: (ctx) => ({
    id: ctx.identifiers.id,
    organizationId: ctx.identifiers.organizationId,
    tenantId: ctx.identifiers.tenantId,
  }),
}

type ContactSnapshot = {
  id: string
  organizationId: string
  tenantId: string
  insurerId: string
  fullName: string
  email: string | null
  phone: string | null
  role: string | null
  isDefault: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type ContactUndoPayload = UndoPayload<ContactSnapshot>

async function loadContactSnapshot(em: EntityManager, id: string): Promise<ContactSnapshot | null> {
  const record = await em.findOne(
    InsuranceInsurerContact,
    { id, deletedAt: null },
    { populate: ['insurer'] },
  )
  if (!record) return null
  const insurerRef = record.insurer
  const insurerId = typeof insurerRef === 'string' ? insurerRef : insurerRef.id
  return {
    id: record.id,
    organizationId: record.organizationId,
    tenantId: record.tenantId,
    insurerId,
    fullName: record.fullName,
    email: record.email ?? null,
    phone: record.phone ?? null,
    role: record.role ?? null,
    isDefault: !!record.isDefault,
    isActive: !!record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

async function resolveInsurer(
  em: EntityManager,
  insurerId: string,
  organizationId: string,
  tenantId: string,
): Promise<InsuranceInsurer> {
  const insurer = await em.findOne(InsuranceInsurer, {
    id: insurerId,
    organizationId,
    tenantId,
    deletedAt: null,
  })
  if (!insurer) {
    throw new CrudHttpError(404, { error: 'insurance.insurers.errors.notFound' })
  }
  return insurer
}

const createContactCommand: CommandHandler<InsuranceInsurerContactCreateInput, { contactId: string }> = {
  id: 'insurance.insurer_contacts.create',
  async execute(input, ctx) {
    const parsed = insuranceInsurerContactCreateSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const insurer = await resolveInsurer(em, parsed.insurerId, parsed.organizationId, parsed.tenantId)
    if (parsed.isDefault) {
      await em.nativeUpdate(
        InsuranceInsurerContact,
        { insurer: insurer.id, organizationId: parsed.organizationId, tenantId: parsed.tenantId, deletedAt: null },
        { isDefault: false, updatedAt: new Date() },
      )
    }
    const record = em.create(InsuranceInsurerContact, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      insurer,
      fullName: parsed.fullName,
      email: parsed.email ?? null,
      phone: parsed.phone ?? null,
      role: parsed.role ?? null,
      isDefault: parsed.isDefault ?? false,
      isActive: parsed.isActive ?? true,
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
      events: contactCrudEvents,
    })
    return { contactId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadContactSnapshot(em, result.contactId)
  },
  buildLog: async ({ result, snapshots }) => {
    const after = snapshots.after as ContactSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('insurance.audit.insurerContacts.create', 'Create insurer contact'),
      resourceKind: 'insurance.insurer_contact',
      resourceId: result.contactId,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
      payload: { undo: { after } satisfies ContactUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<ContactUndoPayload>(logEntry)
    const after = payload?.after
    if (!after) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(InsuranceInsurerContact, { id: after.id })
    if (!record) return
    record.deletedAt = new Date()
    record.isActive = false
    await em.flush()
  },
}

const updateContactCommand: CommandHandler<InsuranceInsurerContactUpdateInput, { contactId: string }> = {
  id: 'insurance.insurer_contacts.update',
  async prepare(input, ctx) {
    requireId(input.id, 'Contact id is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadContactSnapshot(em, input.id)
    return { before }
  },
  async execute(input, ctx) {
    const parsed = insuranceInsurerContactUpdateSchema.parse(input)
    requireId(parsed.id, 'Contact id is required')
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(
      InsuranceInsurerContact,
      { id: parsed.id, deletedAt: null },
      { populate: ['insurer'] },
    )
    if (!record) {
      throw new CrudHttpError(404, { error: 'insurance.insurerContacts.errors.notFound' })
    }
    if (parsed.insurerId) {
      await resolveInsurer(em, parsed.insurerId, record.organizationId, record.tenantId)
      record.insurer = em.getReference(InsuranceInsurer, parsed.insurerId)
    }
    if (parsed.isDefault === true) {
      const insurerId =
        typeof record.insurer === 'string' ? record.insurer : record.insurer.id
      await em.nativeUpdate(
        InsuranceInsurerContact,
        {
          insurer: insurerId,
          organizationId: record.organizationId,
          tenantId: record.tenantId,
          deletedAt: null,
          id: { $ne: record.id },
        },
        { isDefault: false, updatedAt: new Date() },
      )
    }
    const changes = buildChanges(record as unknown as Record<string, unknown>, parsed, [
      'fullName',
      'email',
      'phone',
      'role',
      'isDefault',
      'isActive',
    ])
    for (const [key, change] of Object.entries(changes)) {
      if (change.to !== undefined) {
        ;(record as unknown as Record<string, unknown>)[key] = change.to
      }
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
      events: contactCrudEvents,
    })
    return { contactId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadContactSnapshot(em, result.contactId)
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as ContactSnapshot | undefined
    const after = snapshots.after as ContactSnapshot | undefined
    if (!before || !after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('insurance.audit.insurerContacts.update', 'Update insurer contact'),
      resourceKind: 'insurance.insurer_contact',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      snapshotAfter: after,
      payload: { undo: { before, after } satisfies ContactUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<ContactUndoPayload>(logEntry)
    const before = payload?.before
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(InsuranceInsurerContact, { id: before.id })
    if (!record) return
    record.insurer = em.getReference(InsuranceInsurer, before.insurerId)
    record.fullName = before.fullName
    record.email = before.email
    record.phone = before.phone
    record.role = before.role
    record.isDefault = before.isDefault
    record.isActive = before.isActive
    record.updatedAt = new Date()
    await em.flush()
  },
}

const deleteContactCommand: CommandHandler<{ id: string }, { contactId: string }> = {
  id: 'insurance.insurer_contacts.delete',
  async prepare(input, ctx) {
    const id = requireId(input.id, 'Contact id is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadContactSnapshot(em, id)
    return { before }
  },
  async execute(input, ctx) {
    const id = requireId(input.id, 'Contact id is required')
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(InsuranceInsurerContact, { id, deletedAt: null })
    if (!record) {
      throw new CrudHttpError(404, { error: 'insurance.insurerContacts.errors.notFound' })
    }
    record.deletedAt = new Date()
    record.isActive = false
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
      events: contactCrudEvents,
    })
    return { contactId: record.id }
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as ContactSnapshot | undefined
    if (!before) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('insurance.audit.insurerContacts.delete', 'Delete insurer contact'),
      resourceKind: 'insurance.insurer_contact',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      payload: { undo: { before } satisfies ContactUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<ContactUndoPayload>(logEntry)
    const before = payload?.before
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(InsuranceInsurerContact, { id: before.id })
    if (!record) return
    record.deletedAt = null
    record.isActive = before.isActive
    record.updatedAt = new Date()
    await em.flush()
  },
}

registerCommand(createContactCommand)
registerCommand(updateContactCommand)
registerCommand(deleteContactCommand)
