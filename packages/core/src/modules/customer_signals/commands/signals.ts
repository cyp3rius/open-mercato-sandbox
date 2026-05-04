import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { CustomerSignal } from '../data/entities'
import { customerSignalCreateSchema, type CustomerSignalCreateInput } from '../data/validators'
import { ensureOrganizationScope, ensureTenantScope } from './shared'

const createSignalCommand: CommandHandler<CustomerSignalCreateInput, { signalId: string }> = {
  id: 'customer_signals.signals.create',
  async execute(input, ctx) {
    const parsed = customerSignalCreateSchema.parse(input)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const now = new Date()
    const occurredAt = parsed.occurredAt ?? now
    const row = em.create(CustomerSignal, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      customerEntityId: parsed.customerEntityId,
      signalType: parsed.signalType,
      source: parsed.source,
      subjectEntityType: parsed.subjectEntityType ?? null,
      subjectEntityId: parsed.subjectEntityId ?? null,
      payload: parsed.payload ?? null,
      occurredAt,
      createdAt: now,
    })
    em.persist(row)
    await em.flush()
    return { signalId: row.id }
  },
}

registerCommand(createSignalCommand)
