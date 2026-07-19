import type { JobContext, QueuedJob, WorkerMeta } from '@open-mercato/queue'
import type { EntityManager } from '@mikro-orm/postgresql'
import { ServiceCase } from '../data/entities'
import { cloneCaseMetadataRow, readCasePlaybookRun, writeCasePlaybookRun } from '../lib/casePlaybookMetadata'

type Payload = { tenantId: string; organizationId: string }
type Context = JobContext & { resolve: <T = unknown>(name: string) => T }

export const metadata: WorkerMeta = { queue: 'cases-overdue-check', id: 'cases:overdue-check', concurrency: 3 }

export default async function handle(job: QueuedJob<Payload>, ctx: Context): Promise<void> {
  const { tenantId, organizationId } = job.payload
  if (!tenantId || !organizationId) return
  const em = ctx.resolve<EntityManager>('em').fork()
  const eventBus = ctx.resolve<{ emitEvent: (event: string, data: unknown) => Promise<void> }>('eventBus')
  const now = new Date()
  const cases = await em.find(ServiceCase, { tenantId, organizationId, deletedAt: null, closedAt: null })
  for (const caseRow of cases) {
    const meta = cloneCaseMetadataRow(caseRow.metadata)
    const run = readCasePlaybookRun(meta)
    const procedureOverdue = run?.procedureDueAt && !run.procedureOverdueNotifiedAt && new Date(run.procedureDueAt) < now
    const caseOverdue = caseRow.dueAt && !caseRow.overdueNotifiedAt && caseRow.dueAt < now
    if (!procedureOverdue && !caseOverdue) continue
    if (caseOverdue) caseRow.overdueNotifiedAt = now
    if (procedureOverdue && run) {
      caseRow.metadata = writeCasePlaybookRun(meta, { ...run, procedureOverdueNotifiedAt: now.toISOString() })
    }
    caseRow.updatedAt = now
    await em.flush()
    await eventBus.emitEvent('cases.case.overdue', {
      caseId: caseRow.id,
      ownerUserId: run?.procedureOwnerUserId ?? caseRow.ownerUserId ?? null,
      tenantId,
      organizationId,
    })
  }
}
