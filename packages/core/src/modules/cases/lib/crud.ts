import type { CrudEventsConfig } from '@open-mercato/shared/lib/crud/types'
import type { ServiceCase } from '../data/entities'

function buildCaseCrudEvents<TEntity>(): CrudEventsConfig<TEntity> {
  return {
    module: 'cases',
    entity: 'case',
    persistent: true,
    buildPayload: (ctx) => ({
      id: ctx.identifiers.id,
      organizationId: ctx.identifiers.organizationId,
      tenantId: ctx.identifiers.tenantId,
    }),
  }
}

export const caseCrudEvents = buildCaseCrudEvents<ServiceCase>()
