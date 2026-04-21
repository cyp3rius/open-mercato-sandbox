import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { User } from '@open-mercato/core/modules/auth/data/entities'
import type { ProcurementProcess } from '../data/entities'

const MANAGE = 'procurement.processes.manage'
const HANDLE = 'procurement.processes.handle'

type Rbac = {
  userHasAllFeatures: (
    userId: string,
    features: string[],
    scope: { tenantId: string | null; organizationId: string | null },
  ) => Promise<boolean>
}

type AccessCtx = {
  container: { resolve: (name: string) => unknown }
  auth?: { sub?: string | null } | null
}

function rbacService(container: AccessCtx['container']): Rbac {
  return container.resolve('rbacService') as Rbac
}

export async function assertProcurementProcessMutationAllowed(
  ctx: AccessCtx,
  process: ProcurementProcess,
): Promise<void> {
  const userId = ctx.auth?.sub ?? null
  if (!userId) throw new CrudHttpError(401, { error: 'Unauthorized.' })
  const rbac = rbacService(ctx.container)
  const scope = { tenantId: process.tenantId, organizationId: process.organizationId }
  if (await rbac.userHasAllFeatures(userId, [MANAGE], scope)) return
  if (await rbac.userHasAllFeatures(userId, [HANDLE], scope)) {
    if (process.handlerUserId === userId) return
  }
  throw new CrudHttpError(403, { error: 'Forbidden.' })
}

export async function assertProcurementProcessManageOnly(ctx: AccessCtx, process: ProcurementProcess): Promise<void> {
  const userId = ctx.auth?.sub ?? null
  if (!userId) throw new CrudHttpError(401, { error: 'Unauthorized.' })
  const rbac = rbacService(ctx.container)
  const scope = { tenantId: process.tenantId, organizationId: process.organizationId }
  const ok = await rbac.userHasAllFeatures(userId, [MANAGE], scope)
  if (!ok) throw new CrudHttpError(403, { error: 'Forbidden.' })
}

export async function ensureProcurementHandlerUserInScope(
  em: EntityManager,
  handlerUserId: string | null | undefined,
  tenantId: string,
  organizationId: string,
): Promise<void> {
  const raw = typeof handlerUserId === 'string' ? handlerUserId.trim() : ''
  if (!raw) return
  const user = await em.findOne(User, { id: raw, deletedAt: null })
  if (!user) {
    throw new CrudHttpError(400, { error: 'Handler user not found.' })
  }
  if (user.tenantId !== tenantId) {
    throw new CrudHttpError(400, { error: 'Handler user is outside this tenant.' })
  }
  if (user.organizationId && user.organizationId !== organizationId) {
    throw new CrudHttpError(400, { error: 'Handler user is outside this organization.' })
  }
}
