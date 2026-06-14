import { asFunction } from 'awilix'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { AppContainer } from '@open-mercato/shared/lib/di/container'
import { createGuardAndPlanInsuranceSigningCase } from './lib/guardAndPlanInsuranceSigningCase'

export function register(container: AppContainer) {
  container.register({
    'workflowFunction:guardAndPlanInsuranceSigningCase': asFunction(
      ({ em }: { em: EntityManager }) => createGuardAndPlanInsuranceSigningCase(em),
    ).inject((c: AppContainer) => ({
      em: c.resolve('em'),
    })),
  })
}
