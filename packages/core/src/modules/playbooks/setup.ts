import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'
import { ensurePlaybookProcedureStatusDictionary } from './lib/ensurePlaybookProcedureStatusDictionary'

export const setup: ModuleSetupConfig = {
  async seedDefaults(ctx) {
    await ensurePlaybookProcedureStatusDictionary(ctx.em, {
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
