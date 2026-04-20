import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { buildChanges, emitCrudSideEffects, requireId } from '@open-mercato/shared/lib/commands/helpers'
import { extractUndoPayload, type UndoPayload } from '@open-mercato/shared/lib/commands/undo'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { CustomerEntity } from '@open-mercato/core/modules/customers/data/entities'
import { ProcurementProcess, ProcurementProcessSupplier } from '../data/entities'
import {
  procurementSupplierCreateSchema,
  procurementSupplierUpdateSchema,
  type ProcurementSupplierCreateInput,
  type ProcurementSupplierUpdateInput,
} from '../data/validators'
import { appendProcurementTimelineEvent } from '../lib/timeline'
import { resolveProcurementProcess } from '../lib/resolveProcess'
import {
  procurementSupplierCrudEvents,
  procurementSupplierCrudIndexer,
} from '../lib/crud'

type SupplierSnapshot = {
  id: string
  organizationId: string
  tenantId: string
  processId: string
  vendorCustomerEntityId: string | null
  vendorLabel: string
  contactName: string | null
  email: string | null
  phone: string | null
  website: string | null
  notes: string | null
  offerSummary: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

type SupplierUndoPayload = UndoPayload<SupplierSnapshot>

async function resolveVendorCustomerCompany(
  em: EntityManager,
  params: { id: string; tenantId: string; organizationId: string },
): Promise<CustomerEntity> {
  const ent = await em.findOne(CustomerEntity, {
    id: params.id,
    deletedAt: null,
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    kind: 'company',
  })
  if (!ent) {
    const { translate } = await resolveTranslations()
    throw new CrudHttpError(400, {
      error: translate(
        'procurement.errors.supplierCompanyNotFound',
        'Company not found or outside your organization scope.',
      ),
    })
  }
  return ent
}

async function loadSupplierSnapshot(em: EntityManager, id: string): Promise<SupplierSnapshot | null> {
  const record = await em.findOne(
    ProcurementProcessSupplier,
    { id, deletedAt: null },
    { populate: ['process', 'vendorCustomerEntity'] },
  )
  if (!record) return null
  const proc = record.process
  const processId = typeof proc === 'string' ? proc : proc.id
  const vce = record.vendorCustomerEntity
  const vendorCustomerEntityId =
    vce && typeof vce === 'object' && 'id' in vce ? String((vce as CustomerEntity).id) : null
  return {
    id: record.id,
    organizationId: record.organizationId,
    tenantId: record.tenantId,
    processId,
    vendorCustomerEntityId,
    vendorLabel: record.vendorLabel,
    contactName: record.contactName ?? null,
    email: record.email ?? null,
    phone: record.phone ?? null,
    website: record.website ?? null,
    notes: record.notes ?? null,
    offerSummary: record.offerSummary ?? null,
    sortOrder: record.sortOrder,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

const createSupplierCommand: CommandHandler<ProcurementSupplierCreateInput, { supplierId: string }> = {
  id: 'procurement.process_suppliers.create',
  async execute(input, ctx) {
    const parsed = procurementSupplierCreateSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const process = await resolveProcurementProcess(
      em,
      parsed.processId,
      parsed.organizationId,
      parsed.tenantId,
    )
    const now = new Date()
    let vendorCustomerEntity: CustomerEntity | null = null
    if (parsed.vendorCustomerEntityId) {
      vendorCustomerEntity = await resolveVendorCustomerCompany(em, {
        id: parsed.vendorCustomerEntityId,
        tenantId: parsed.tenantId,
        organizationId: parsed.organizationId,
      })
    }
    const record = em.create(ProcurementProcessSupplier, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      process,
      vendorCustomerEntity,
      vendorLabel: parsed.vendorLabel,
      contactName: parsed.contactName ?? null,
      email: parsed.email ?? null,
      phone: parsed.phone ?? null,
      website: parsed.website ?? null,
      notes: parsed.notes ?? null,
      offerSummary: parsed.offerSummary ?? null,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(record)
    await em.flush()
    await appendProcurementTimelineEvent(em, {
      process,
      eventType: 'supplier.added',
      message: `Supplier "${parsed.vendorLabel}" added.`,
      actorUserId: ctx.auth?.userId ?? null,
      metadata: { supplierId: record.id },
    })
    await em.flush()
    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine,
      action: 'created',
      entity: record,
      identifiers: { id: record.id, organizationId: record.organizationId, tenantId: record.tenantId },
      events: procurementSupplierCrudEvents,
      indexer: procurementSupplierCrudIndexer,
    })
    return { supplierId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadSupplierSnapshot(em, result.supplierId)
  },
  buildLog: async ({ result, snapshots }) => {
    const after = snapshots.after as SupplierSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('procurement.audit.suppliers.create', 'Add procurement supplier'),
      resourceKind: 'procurement.process_supplier',
      resourceId: result.supplierId,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
      payload: { undo: { after } satisfies SupplierUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<SupplierUndoPayload>(logEntry)
    const after = payload?.after
    if (!after) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(ProcurementProcessSupplier, { id: after.id })
    if (!record) return
    record.deletedAt = new Date()
    record.updatedAt = new Date()
    await em.flush()
  },
}

const updateSupplierCommand: CommandHandler<ProcurementSupplierUpdateInput, { supplierId: string }> = {
  id: 'procurement.process_suppliers.update',
  async prepare(input, ctx) {
    requireId(input.id, 'Supplier id is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadSupplierSnapshot(em, input.id)
    return { before }
  },
  async execute(input, ctx) {
    const parsed = procurementSupplierUpdateSchema.parse(input)
    requireId(parsed.id, 'Supplier id is required')
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await findOneWithDecryption(
      em,
      ProcurementProcessSupplier,
      { id: parsed.id, deletedAt: null },
      { populate: ['process', 'vendorCustomerEntity'] },
      { tenantId: ctx.auth?.tenantId ?? null, organizationId: ctx.auth?.orgId ?? null },
    )
    if (!record) throw new CrudHttpError(404, { error: 'Procurement supplier not found.' })

    const changes = buildChanges(record as unknown as Record<string, unknown>, parsed as Record<string, unknown>, [
      'vendorLabel',
      'contactName',
      'email',
      'phone',
      'website',
      'notes',
      'offerSummary',
      'sortOrder',
    ])
    for (const [key, change] of Object.entries(changes)) {
      if (change.to !== undefined) {
        ;(record as unknown as Record<string, unknown>)[key] = change.to
      }
    }
    if (parsed.vendorCustomerEntityId !== undefined) {
      if (parsed.vendorCustomerEntityId === null) {
        record.vendorCustomerEntity = null
      } else {
        record.vendorCustomerEntity = await resolveVendorCustomerCompany(em, {
          id: parsed.vendorCustomerEntityId,
          tenantId: parsed.tenantId,
          organizationId: parsed.organizationId,
        })
      }
    }
    record.updatedAt = new Date()
    await em.flush()

    const process = typeof record.process === 'string' ? null : record.process
    if (process) {
      await appendProcurementTimelineEvent(em, {
        process,
        eventType: 'supplier.updated',
        message: `Supplier "${record.vendorLabel}" updated.`,
        actorUserId: ctx.auth?.userId ?? null,
        metadata: { supplierId: record.id },
      })
      await em.flush()
    }

    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine,
      action: 'updated',
      entity: record,
      identifiers: { id: record.id, organizationId: record.organizationId, tenantId: record.tenantId },
      events: procurementSupplierCrudEvents,
      indexer: procurementSupplierCrudIndexer,
    })
    return { supplierId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadSupplierSnapshot(em, result.supplierId)
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as SupplierSnapshot | undefined
    const after = snapshots.after as SupplierSnapshot | undefined
    if (!before || !after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('procurement.audit.suppliers.update', 'Update procurement supplier'),
      resourceKind: 'procurement.process_supplier',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      snapshotAfter: after,
      payload: { undo: { before, after } satisfies SupplierUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<SupplierUndoPayload>(logEntry)
    const before = payload?.before
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(ProcurementProcessSupplier, { id: before.id })
    if (!record) return
    record.vendorLabel = before.vendorLabel
    record.contactName = before.contactName
    record.email = before.email
    record.phone = before.phone
    record.website = before.website
    record.notes = before.notes
    record.offerSummary = before.offerSummary
    record.sortOrder = before.sortOrder
    record.vendorCustomerEntity = before.vendorCustomerEntityId
      ? em.getReference(CustomerEntity, before.vendorCustomerEntityId)
      : null
    record.updatedAt = new Date()
    await em.flush()
  },
}

const deleteSupplierCommand: CommandHandler<{ id: string }, { supplierId: string }> = {
  id: 'procurement.process_suppliers.delete',
  async prepare(input, ctx) {
    const id = requireId(input.id, 'Supplier id is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadSupplierSnapshot(em, id)
    return { before }
  },
  async execute(input, ctx) {
    const id = requireId(input.id, 'Supplier id is required')
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await findOneWithDecryption(
      em,
      ProcurementProcessSupplier,
      { id, deletedAt: null },
      { populate: ['process'] },
      { tenantId: ctx.auth?.tenantId ?? null, organizationId: ctx.auth?.orgId ?? null },
    )
    if (!record) throw new CrudHttpError(404, { error: 'Procurement supplier not found.' })

    const process = typeof record.process === 'string' ? await em.findOne(ProcurementProcess, { id: record.process }) : record.process
    const vendorLabel = record.vendorLabel
    const now = new Date()
    record.deletedAt = now
    record.updatedAt = now
    if (process && process.selectedSupplierId === record.id) {
      process.selectedSupplierId = null
      process.updatedAt = now
    }
    await em.flush()

    if (process) {
      await appendProcurementTimelineEvent(em, {
        process,
        eventType: 'supplier.removed',
        message: `Supplier "${vendorLabel}" removed.`,
        actorUserId: ctx.auth?.userId ?? null,
        metadata: { supplierId: id },
      })
      await em.flush()
    }

    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine,
      action: 'deleted',
      entity: record,
      identifiers: { id: record.id, organizationId: record.organizationId, tenantId: record.tenantId },
      events: procurementSupplierCrudEvents,
      indexer: procurementSupplierCrudIndexer,
    })
    return { supplierId: record.id }
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as SupplierSnapshot | undefined
    if (!before) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('procurement.audit.suppliers.delete', 'Remove procurement supplier'),
      resourceKind: 'procurement.process_supplier',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      payload: { undo: { before } satisfies SupplierUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<SupplierUndoPayload>(logEntry)
    const before = payload?.before
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(ProcurementProcessSupplier, { id: before.id })
    if (!record) return
    record.deletedAt = null
    record.updatedAt = new Date()
    await em.flush()
  },
}

registerCommand(createSupplierCommand)
registerCommand(updateSupplierCommand)
registerCommand(deleteSupplierCommand)
