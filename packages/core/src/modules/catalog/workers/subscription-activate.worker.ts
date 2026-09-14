import type { JobContext, QueuedJob, WorkerMeta } from '@open-mercato/queue'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CatalogCustomerOffering } from '../data/entities'
import { activateCustomerOfferingById } from '../commands/customerOfferings'
import { isSubscriptionProduct } from '../lib/customerOffering'
import { casePlanItemIsDue } from '../lib/casePlan'
import type { CatalogProductCaseTemplate } from '../data/types'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'

type Payload = { tenantId?: string; organizationId?: string }
type Context = JobContext & { resolve: <T = unknown>(name: string) => T }

export const metadata: WorkerMeta = {
  queue: 'catalog-subscription-activate',
  id: 'catalog:subscription-activate',
  concurrency: 3,
}

function offeringHasPendingCaseSpawns(
  offering: CatalogCustomerOffering,
  now: Date,
): boolean {
  const templates = Array.isArray(offering.caseTemplatesSnapshot)
    ? (offering.caseTemplatesSnapshot as CatalogProductCaseTemplate[])
    : []
  if (!templates.length) return false
  const spawned = offering.spawnedCaseIds ?? {}
  return templates.some((template) => {
    if (spawned[template.id]) return false
    return casePlanItemIsDue(template, now)
  })
}

export default async function handle(job: QueuedJob<Payload>, ctx: Context): Promise<void> {
  const em = ctx.resolve<EntityManager>('em').fork()
  const now = new Date()
  const scope: Record<string, unknown> = { deletedAt: null }
  if (job.payload?.tenantId) scope.tenantId = job.payload.tenantId
  if (job.payload?.organizationId) scope.organizationId = job.payload.organizationId

  const pending = await em.find(
    CatalogCustomerOffering,
    {
      ...scope,
      status: 'pending',
      startsAt: { $lte: now },
    },
    { limit: 100 },
  )

  const active = await em.find(
    CatalogCustomerOffering,
    {
      ...scope,
      status: 'active',
    },
    { limit: 100, orderBy: { updatedAt: 'ASC' } },
  )

  const toProcess = [
    ...pending,
    ...active.filter((offering) => offeringHasPendingCaseSpawns(offering, now)),
  ]

  for (const offering of toProcess) {
    if (offering.status === 'pending') {
      const isSubscription = await isSubscriptionProduct(em, offering.productId)
      if (!isSubscription) continue
    }
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
