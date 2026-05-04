import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { emitCrudSideEffects } from '@open-mercato/shared/lib/commands/helpers'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import { Playbook } from '../data/entities'
import {
  playbookCreateSchema,
  playbookDeleteSchema,
  playbookUpdateSchema,
  type PlaybookCreateInput,
  type PlaybookDeleteInput,
  type PlaybookUpdateInput,
} from '../data/validators'
import { playbookCrudEvents } from '../lib/crud'
import { ensureOrganizationScope, ensureTenantScope } from './shared'
import { E } from '#generated/entities.ids.generated'

const playbookIndexer = { entityType: E.playbooks.playbook }

const createPlaybookCommand: CommandHandler<PlaybookCreateInput, { playbookId: string }> = {
  id: 'playbooks.playbooks.create',
  async execute(input, ctx) {
    const parsed = playbookCreateSchema.parse(input)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const slugLower = parsed.slug.trim().toLowerCase()
    const dup = await em.findOne(Playbook, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      slug: slugLower,
      deletedAt: null,
    })
    if (dup) {
      throw new CrudHttpError(409, { error: 'Playbook slug already exists for this organization.' })
    }
    const now = new Date()
    const row = em.create(Playbook, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      slug: slugLower,
      title: parsed.title.trim(),
      body: parsed.body,
      contextTags: parsed.contextTags ?? [],
      procedureDefinition: parsed.procedureDefinition ?? [],
      audience: parsed.audience ?? 'internal',
      version: parsed.version ?? 1,
      publishedAt: parsed.publishedAt ?? null,
      isActive: parsed.isActive ?? true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    em.persist(row)
    await em.flush()
    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine,
      action: 'created',
      entity: row,
      identifiers: { id: row.id, organizationId: row.organizationId, tenantId: row.tenantId },
      events: playbookCrudEvents,
      indexer: playbookIndexer,
    })
    return { playbookId: row.id }
  },
}

const updatePlaybookCommand: CommandHandler<PlaybookUpdateInput, { ok: true }> = {
  id: 'playbooks.playbooks.update',
  async execute(input, ctx) {
    const parsed = playbookUpdateSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await em.findOne(Playbook, { id: parsed.id, deletedAt: null })
    if (!row) {
      throw new CrudHttpError(404, { error: 'Playbook not found.' })
    }
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)
    if (parsed.slug !== undefined) {
      const slugLower = parsed.slug.trim().toLowerCase()
      const dup = await em.findOne(Playbook, {
        organizationId: row.organizationId,
        tenantId: row.tenantId,
        slug: slugLower,
        deletedAt: null,
        id: { $ne: row.id },
      })
      if (dup) {
        throw new CrudHttpError(409, { error: 'Playbook slug already exists for this organization.' })
      }
      row.slug = slugLower
    }
    if (parsed.title !== undefined) row.title = parsed.title.trim()
    if (parsed.body !== undefined) row.body = parsed.body
    if (parsed.contextTags !== undefined) row.contextTags = parsed.contextTags
    if (parsed.procedureDefinition !== undefined) row.procedureDefinition = parsed.procedureDefinition
    if (parsed.audience !== undefined) row.audience = parsed.audience
    if (parsed.version !== undefined) row.version = parsed.version
    if (parsed.publishedAt !== undefined) row.publishedAt = parsed.publishedAt
    if (parsed.isActive !== undefined) row.isActive = parsed.isActive
    row.updatedAt = new Date()
    await em.flush()
    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine,
      action: 'updated',
      entity: row,
      identifiers: { id: row.id, organizationId: row.organizationId, tenantId: row.tenantId },
      events: playbookCrudEvents,
      indexer: playbookIndexer,
    })
    return { ok: true }
  },
}

const deletePlaybookCommand: CommandHandler<PlaybookDeleteInput, { ok: true }> = {
  id: 'playbooks.playbooks.delete',
  async execute(input, ctx) {
    const parsed = playbookDeleteSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await em.findOne(Playbook, { id: parsed.id, deletedAt: null })
    if (!row) {
      throw new CrudHttpError(404, { error: 'Playbook not found.' })
    }
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)
    const now = new Date()
    row.deletedAt = now
    row.updatedAt = now
    await em.flush()
    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine,
      action: 'deleted',
      entity: row,
      identifiers: { id: row.id, organizationId: row.organizationId, tenantId: row.tenantId },
      events: playbookCrudEvents,
      indexer: playbookIndexer,
    })
    return { ok: true }
  },
}

registerCommand(createPlaybookCommand)
registerCommand(updatePlaybookCommand)
registerCommand(deletePlaybookCommand)
