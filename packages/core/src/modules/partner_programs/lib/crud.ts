import type { CrudEventsConfig } from '@open-mercato/shared/lib/crud/types'
import type { PartnerProgram, PartnerProgramMembership } from '../data/entities'

function buildProgramCrudEvents<TEntity>(): CrudEventsConfig<TEntity> {
  return {
    module: 'partner_programs',
    entity: 'program',
    persistent: true,
    buildPayload: (ctx) => ({
      id: ctx.identifiers.id,
      organizationId: ctx.identifiers.organizationId,
      tenantId: ctx.identifiers.tenantId,
    }),
  }
}

function buildMembershipCrudEvents<TEntity>(): CrudEventsConfig<TEntity> {
  return {
    module: 'partner_programs',
    entity: 'membership',
    persistent: true,
    buildPayload: (ctx) => ({
      id: ctx.identifiers.id,
      organizationId: ctx.identifiers.organizationId,
      tenantId: ctx.identifiers.tenantId,
    }),
  }
}

export const partnerProgramCrudEvents = buildProgramCrudEvents<PartnerProgram>()
export const partnerProgramMembershipCrudEvents = buildMembershipCrudEvents<PartnerProgramMembership>()
