import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { CaseTimelineEvent, ServiceCase } from '../data/entities'
import { caseTimelineAppendSchema, type CaseTimelineAppendInput } from '../data/validators'
import { ensureOrganizationScope, ensureTenantScope } from './shared'

const appendTimelineCommand: CommandHandler<CaseTimelineAppendInput, { timelineId: string }> = {
  id: 'cases.timeline.append',
  async execute(input, ctx) {
    const parsed = caseTimelineAppendSchema.parse(input)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const caseRow = await findOneWithDecryption(
      em,
      ServiceCase,
      { id: parsed.caseId, deletedAt: null },
      undefined,
      { tenantId: parsed.tenantId, organizationId: parsed.organizationId },
    )
    if (!caseRow) throw new CrudHttpError(404, { error: 'Case not found.' })
    if (caseRow.closedAt != null) {
      throw new CrudHttpError(400, { error: 'cases.timeline.caseClosed' })
    }
    const now = new Date()
    const occurredAt = parsed.occurredAt ?? now
    const actor =
      parsed.actorUserId ??
      (typeof ctx.auth?.sub === 'string' && ctx.auth.sub.length > 0 ? ctx.auth.sub : null)
    const row = em.create(CaseTimelineEvent, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      caseRecord: caseRow,
      eventType: parsed.eventType,
      body: parsed.body,
      occurredAt,
      actorUserId: actor,
      sourceRef: parsed.sourceRef ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    em.persist(row)
    await em.flush()
    const eventBus = ctx.container.resolve('eventBus') as { emitEvent: (e: string, p: unknown, o?: unknown) => Promise<void> }
    await eventBus.emitEvent(
      'cases.timeline.appended',
      {
        id: row.id,
        caseId: parsed.caseId,
        organizationId: parsed.organizationId,
        tenantId: parsed.tenantId,
        eventType: parsed.eventType,
      },
      { persistent: true },
    )
    return { timelineId: row.id }
  },
}

registerCommand(appendTimelineCommand)
