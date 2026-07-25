import type { EntityManager } from '@mikro-orm/postgresql'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { Playbook } from '../data/entities'
import { compileProcedureDocument, type PlaybookUpsertPayload } from './procedureMarkdown'
import {
  mergePlaybookUpdateIntoSnapshot,
  playbookContentSnapshotsEqual,
  snapshotPlaybookContent,
} from './playbookVersioning'

export type ApplyPlaybookMarkdownResult = {
  action: 'created' | 'updated' | 'unchanged' | 'compiled'
  slug: string
  playbookId: string | null
  payload: PlaybookUpsertPayload
}

export async function applyPlaybookMarkdown(params: {
  markdown: string
  tenantId: string
  organizationId: string
  dryRun?: boolean
  commandBus: CommandBus
  ctx: CommandRuntimeContext
  em: EntityManager
}): Promise<ApplyPlaybookMarkdownResult> {
  const payload = compileProcedureDocument(params.markdown)
  if (params.dryRun) {
    return {
      action: 'compiled',
      slug: payload.slug,
      playbookId: null,
      payload,
    }
  }

  const existing = await params.em.findOne(Playbook, {
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    slug: payload.slug,
    deletedAt: null,
    isActive: true,
  })

  if (!existing) {
    const { result } = await params.commandBus.execute('playbooks.playbooks.create', {
      input: {
        tenantId: params.tenantId,
        organizationId: params.organizationId,
        slug: payload.slug,
        title: payload.title,
        body: payload.body,
        audience: payload.audience,
        contextTags: payload.contextTags,
        defaultSlaDuration: payload.defaultSlaDuration,
        recommendedOwnerUserIds: payload.recommendedOwnerUserIds,
        procedureDefinition: payload.procedureDefinition,
        isActive: true,
      },
      ctx: params.ctx,
    })
    const created = result as { playbookId?: string } | undefined
    return {
      action: 'created',
      slug: payload.slug,
      playbookId: typeof created?.playbookId === 'string' ? created.playbookId : null,
      payload,
    }
  }

  const before = snapshotPlaybookContent(existing)
  const after = mergePlaybookUpdateIntoSnapshot(before, {
    id: existing.id,
    slug: payload.slug,
    title: payload.title,
    body: payload.body,
    audience: payload.audience,
    contextTags: payload.contextTags,
    defaultSlaDuration: payload.defaultSlaDuration,
    recommendedOwnerUserIds: payload.recommendedOwnerUserIds,
    procedureDefinition: payload.procedureDefinition,
  })
  if (playbookContentSnapshotsEqual(before, after)) {
    return {
      action: 'unchanged',
      slug: payload.slug,
      playbookId: existing.id,
      payload,
    }
  }

  const { result } = await params.commandBus.execute('playbooks.playbooks.update', {
    input: {
      id: existing.id,
      slug: payload.slug,
      title: payload.title,
      body: payload.body,
      audience: payload.audience,
      contextTags: payload.contextTags,
      defaultSlaDuration: payload.defaultSlaDuration,
      recommendedOwnerUserIds: payload.recommendedOwnerUserIds,
      procedureDefinition: payload.procedureDefinition,
    },
    ctx: params.ctx,
  })
  const updated = result as { playbookId?: string } | undefined

  return {
    action: 'updated',
    slug: payload.slug,
    playbookId: typeof updated?.playbookId === 'string' ? updated.playbookId : existing.id,
    payload,
  }
}
