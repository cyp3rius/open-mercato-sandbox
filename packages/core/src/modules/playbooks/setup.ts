import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'
import { ensurePlaybookProcedureStatusDictionary } from './lib/ensurePlaybookProcedureStatusDictionary'
import { ensurePlaybookProcedureActionDictionary } from './lib/ensurePlaybookProcedureActionDictionary'
import { seedProcedureMarkdownExamples } from './lib/seedProcedureMarkdownExamples'

export const setup: ModuleSetupConfig = {
  async seedDefaults(ctx) {
    await ensurePlaybookProcedureStatusDictionary(ctx.em, {
      tenantId: ctx.tenantId,
      organizationId: ctx.organizationId,
    })
    await ensurePlaybookProcedureActionDictionary(ctx.em, {
      tenantId: ctx.tenantId,
      organizationId: ctx.organizationId,
    })
  },
  async seedExamples(ctx) {
    await seedProcedureMarkdownExamples({
      container: ctx.container,
      em: ctx.em,
      tenantId: ctx.tenantId,
      organizationId: ctx.organizationId,
    })
  },
  defaultRoleFeatures: {
    admin: ['playbooks.*'],
    employee: ['playbooks.view'],
  },
}

export default setup
