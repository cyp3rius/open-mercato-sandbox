import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { ProcurementProcess } from '../data/entities'

export async function resolveProcurementProcess(
  em: EntityManager,
  processId: string,
  organizationId: string,
  tenantId: string,
): Promise<ProcurementProcess> {
  const process = await em.findOne(ProcurementProcess, {
    id: processId,
    organizationId,
    tenantId,
    deletedAt: null,
  })
  if (!process) {
    throw new CrudHttpError(404, { error: 'Procurement process not found.' })
  }
  return process
}
