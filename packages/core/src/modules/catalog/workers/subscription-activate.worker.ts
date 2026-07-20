import type { JobContext, QueuedJob, WorkerMeta } from '@open-mercato/queue'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CatalogCustomerOffering } from '../data/entities'
import { activateCustomerOfferingById } from '../commands/customerOfferings'
import { isSubscriptionProduct } from '../lib/customerOffering'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'

type Payload = { tenantId?: string; organizationId?: string }
type Context = JobContext & { resolve: <T = unknown>(name: string) => T }

export const metadata: WorkerMeta = {
  queue: 'catalog-subscription-activate',
  id: 'catalog:subscription-activate',
  concurrency: 3,
}

export default async function handle(job: QueuedJob<Payload>, ctx: Context): Promise<void> {
  const em = ctx.resolve<EntityManager>('em').fork()
  const now = new Date()
  const where: Record<string, unknown> = {
    deletedAt: null,
    status: 'pending',
    startsAt: { $lte: now },
  }
  if (job.payload?.tenantId) where.tenantId = job.payload.tenantId
  if (job.payload?.organizationId) where.organizationId = job.payload.organizationId

  const pending = await em.find(CatalogCustomerOffering, where, { limit: 100 })
  for (const offering of pending) {
    const isSubscription = await isSubscriptionProduct(em, offering.productId)
    if (!isSubscription) continue
    const commandCtx = {
      container: { resolve: ctx.resolve },
      auth: {
        tenantId: offering.tenantId,
        orgId: offering.organizationId,
        sub: null,
      },
      selectedOrganizationId: offering.organizationId,
    } as unknown as CommandRuntimeContext
    try {
      await activateCustomerOfferingById(commandCtx, offering.id)
    } catch (err) {
      console.error('[catalog:subscription-activate] Failed', offering.id, err)
    }
  }
}
