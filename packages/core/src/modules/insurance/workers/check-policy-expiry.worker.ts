import type { JobContext, QueuedJob, WorkerMeta } from '@open-mercato/queue'
import type { EntityManager } from '@mikro-orm/postgresql'
import { ActionLog } from '../../audit_logs/data/entities'
import {
  addUtcDays,
  daysUntilUtcDate,
  POLICY_EXPIRY_NOTICE_DAYS,
  utcDateKey,
} from '../lib/policyExpiryConstants'

type PolicyExpiryCheckPayload = {
  tenantId: string
  organizationId: string
}

type HandlerContext = JobContext & {
  resolve: <T = unknown>(name: string) => T
}

export const metadata: WorkerMeta = {
  queue: 'insurance-policy-expiry-check',
  id: 'insurance:policy-expiry-check',
  concurrency: 2,
}

type ExpiringPolicyRow = {
  id: string
  policyNumber: string
  validTo: Date
  caretakerUserId: string | null
  tenantId: string
  organizationId: string
}

async function loadCreatorUserIds(
  em: EntityManager,
  tenantId: string,
  policyIds: string[],
): Promise<Map<string, string>> {
  if (policyIds.length === 0) return new Map()

  const logs = await em.find(
    ActionLog,
    {
      tenantId,
      resourceKind: 'insurance.policy',
      resourceId: { $in: policyIds },
      commandId: 'insurance.policies.create',
      executionState: 'done',
    },
    { orderBy: { createdAt: 'ASC' } },
  )

  const creators = new Map<string, string>()
  for (const log of logs) {
    const policyId = log.resourceId?.trim()
    const actorUserId = log.actorUserId?.trim()
    if (!policyId || !actorUserId || creators.has(policyId)) continue
    creators.set(policyId, actorUserId)
  }
  return creators
}

async function findPoliciesExpiringOn(
  em: EntityManager,
  scope: PolicyExpiryCheckPayload,
  targetDateKey: string,
): Promise<ExpiringPolicyRow[]> {
  const knex = (em.getConnection() as unknown as { getKnex: () => import('knex').Knex }).getKnex()
  const rows = await knex('insurance_policies')
    .select(
      'id',
      'policy_number as policyNumber',
      'valid_to as validTo',
      'caretaker_user_id as caretakerUserId',
      'tenant_id as tenantId',
      'organization_id as organizationId',
    )
    .where({
      tenant_id: scope.tenantId,
      organization_id: scope.organizationId,
      deleted_at: null,
    })
    .whereNotNull('valid_to')
    .whereRaw(`DATE(valid_to AT TIME ZONE 'UTC') = ?`, [targetDateKey])

  return rows.map((row) => ({
    id: String(row.id),
    policyNumber: String(row.policyNumber),
    validTo: row.validTo instanceof Date ? row.validTo : new Date(String(row.validTo)),
    caretakerUserId: row.caretakerUserId ? String(row.caretakerUserId) : null,
    tenantId: String(row.tenantId),
    organizationId: String(row.organizationId),
  }))
}

export default async function handle(job: QueuedJob<PolicyExpiryCheckPayload>, ctx: HandlerContext): Promise<void> {
  const tenantId = job.payload?.tenantId?.trim()
  const organizationId = job.payload?.organizationId?.trim()
  if (!tenantId || !organizationId) return

  const em = ctx.resolve<EntityManager>('em')
  const eventBus = ctx.resolve<{ emitEvent: (event: string, data: unknown) => Promise<void> }>('eventBus')
  const now = new Date()

  for (const daysUntilExpiry of POLICY_EXPIRY_NOTICE_DAYS) {
    const targetDateKey = utcDateKey(addUtcDays(now, daysUntilExpiry))
    const policies = await findPoliciesExpiringOn(em, { tenantId, organizationId }, targetDateKey)
    if (policies.length === 0) continue

    const creatorByPolicyId = await loadCreatorUserIds(
      em,
      tenantId,
      policies.map((policy) => policy.id),
    )

    for (const policy of policies) {
      const computedDays = daysUntilUtcDate(policy.validTo, now)
      if (computedDays !== daysUntilExpiry) continue

      await eventBus.emitEvent('insurance.policy.expiring', {
        policyId: policy.id,
        policyNumber: policy.policyNumber,
        validTo: policy.validTo.toISOString(),
        daysUntilExpiry,
        caretakerUserId: policy.caretakerUserId,
        creatorUserId: creatorByPolicyId.get(policy.id) ?? null,
        tenantId: policy.tenantId,
        organizationId: policy.organizationId,
      })
    }
  }
}
