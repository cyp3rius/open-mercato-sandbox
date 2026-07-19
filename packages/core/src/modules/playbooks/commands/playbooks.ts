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
import {
  mergePlaybookUpdateIntoSnapshot,
  playbookContentSnapshotsEqual,
  snapshotPlaybookContent,
} from '../lib/playbookVersioning'
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
    const activeDup = await em.findOne(Playbook, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      slug: slugLower,
      deletedAt: null,
      isActive: true,
    })
    if (activeDup) {
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
      recommendedOwnerUserIds: parsed.recommendedOwnerUserIds ?? [],
      defaultSlaDuration: parsed.defaultSlaDuration ?? null,
      procedureDefinition: parsed.procedureDefinition ?? [],
      audience: parsed.audience ?? 'internal',
      version: parsed.version ?? 0,
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

const updatePlaybookCommand: CommandHandler<PlaybookUpdateInput, { ok: true; playbookId?: string }> = {
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
    if (!row.isActive) {
      throw new CrudHttpError(400, { error: 'playbooks.errors.archivedVersionReadOnly' })
    }

    const before = snapshotPlaybookContent(row)
    const merged = mergePlaybookUpdateIntoSnapshot(before, parsed)
    const contentChanged = !playbookContentSnapshotsEqual(before, merged)
    const isActiveChanged = parsed.isActive !== undefined && parsed.isActive !== row.isActive

    if (!contentChanged && !isActiveChanged) {
      return { ok: true as const }
    }

    if (!contentChanged && isActiveChanged) {
      row.isActive = parsed.isActive!
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
      return { ok: true as const }
    }

    const conflictingHead = await em.findOne(Playbook, {
      organizationId: row.organizationId,
      tenantId: row.tenantId,
      slug: merged.slug,
      deletedAt: null,
      isActive: true,
      id: { $ne: row.id },
    })
    if (conflictingHead) {
      throw new CrudHttpError(409, { error: 'Playbook slug already exists for this organization.' })
    }

    const tags =
      parsed.contextTags !== undefined
        ? parsed.contextTags.map((x) => String(x).trim()).filter(Boolean)
        : [...(row.contextTags ?? [])]
    const proc =
      parsed.procedureDefinition !== undefined
        ? JSON.parse(JSON.stringify(parsed.procedureDefinition))
        : JSON.parse(JSON.stringify(row.procedureDefinition ?? []))

    row.isActive = false
    row.updatedAt = new Date()

    const now = new Date()
    const newRow = em.create(Playbook, {
      tenantId: row.tenantId,
      organizationId: row.organizationId,
      slug: merged.slug,
      title: merged.title,
      body: merged.body,
      contextTags: tags,
      recommendedOwnerUserIds:
        parsed.recommendedOwnerUserIds !== undefined
          ? Array.from(new Set(parsed.recommendedOwnerUserIds))
          : [...(row.recommendedOwnerUserIds ?? [])],
      defaultSlaDuration:
        parsed.defaultSlaDuration !== undefined ? parsed.defaultSlaDuration : row.defaultSlaDuration ?? null,
      procedureDefinition: proc,
      audience: merged.audience,
      version: row.version + 1,
      publishedAt: parsed.publishedAt !== undefined ? parsed.publishedAt : row.publishedAt ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    em.persist(newRow)
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
    await emitCrudSideEffects({
      dataEngine,
      action: 'created',
      entity: newRow,
      identifiers: { id: newRow.id, organizationId: newRow.organizationId, tenantId: newRow.tenantId },
      events: playbookCrudEvents,
      indexer: playbookIndexer,
    })
    try {
      const eventBus = ctx.container.resolve('eventBus') as {
        emitEvent: (event: string, data: unknown) => Promise<void>
      }
      await eventBus.emitEvent('playbooks.playbook.version_published', {
        playbookId: newRow.id,
        slug: newRow.slug,
        title: newRow.title,
        version: newRow.version,
        tenantId: newRow.tenantId,
        organizationId: newRow.organizationId,
      })
    } catch {
      // non-blocking
    }
    return { ok: true as const, playbookId: newRow.id }
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
