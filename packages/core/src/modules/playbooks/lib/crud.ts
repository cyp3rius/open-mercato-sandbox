import type { CrudEventsConfig } from '@open-mercato/shared/lib/crud/types'
import type { Playbook } from '../data/entities'

function buildPlaybookCrudEvents<TEntity>(): CrudEventsConfig<TEntity> {
  return {
    module: 'playbooks',
    entity: 'playbook',
    persistent: true,
    buildPayload: (ctx) => ({
      id: ctx.identifiers.id,
      organizationId: ctx.identifiers.organizationId,
      tenantId: ctx.identifiers.tenantId,
    }),
  }
}

export const playbookCrudEvents = buildPlaybookCrudEvents<Playbook>()
