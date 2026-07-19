import type { JobContext, QueuedJob, WorkerMeta } from '@open-mercato/queue'
import type { EntityManager } from '@mikro-orm/postgresql'
import { randomUUID } from 'node:crypto'
import { ServiceCase } from '../data/entities'
import { CatalogCustomerOffering } from '../../catalog/data/entities'
import {
  isRecurrenceOccurrenceWithinSubscription,
  resolveCustomerOfferingIdFromMetadata,
  resolveRecurrenceSeriesEndsAt,
} from '../../catalog/lib/customerOffering'
import { addDurationToDate, type ProcedureDuration } from '../../playbooks/lib/duration'
import { cloneCaseMetadataRow, readCasePlaybookRun, writeCasePlaybookRun } from '../lib/casePlaybookMetadata'
import { startBoundPlaybookIfReady } from '../lib/startBoundPlaybookIfReady'

type Payload = { tenantId: string; organizationId: string }
type Context = JobContext & { resolve: <T = unknown>(name: string) => T }

export const metadata: WorkerMeta = { queue: 'cases-recurrence-check', id: 'cases:recurrence-check', concurrency: 3 }

function duration(amount: number | null | undefined, unit: string | null | undefined): ProcedureDuration | null {
  return amount && amount > 0 && unit && ['hours', 'days', 'weeks', 'months'].includes(unit)
    ? { amount, unit: unit as ProcedureDuration['unit'] }
    : null
}

function subtractDurationFromDate(date: Date, value: ProcedureDuration): Date {
  const result = new Date(date)
  switch (value.unit) {
    case 'hours':
      result.setHours(result.getHours() - value.amount)
      break
    case 'days':
      result.setDate(result.getDate() - value.amount)
      break
    case 'weeks':
      result.setDate(result.getDate() - value.amount * 7)
      break
    case 'months':
      result.setMonth(result.getMonth() - value.amount)
      break
  }
  return result
}

export default async function handle(job: QueuedJob<Payload>, ctx: Context): Promise<void> {
  const { tenantId, organizationId } = job.payload
  if (!tenantId || !organizationId) return
  const em = ctx.resolve<EntityManager>('em').fork()
  const now = new Date()

  const closedCases = await em.find(ServiceCase, {
    tenantId,
    organizationId,
    deletedAt: null,
    recurrenceEnabled: true,
    closedAt: { $ne: null },
  })
  for (const previous of closedCases) {
    const interval = duration(previous.recurrenceIntervalAmount, previous.recurrenceIntervalUnit)
    if (!interval || !previous.closedAt) continue
    const nextOccurrenceAt = previous.recurrenceNextOccurrenceAt ?? addDurationToDate(previous.closedAt, interval)
    const lead = previous.recurrenceCreateLeadTime as ProcedureDuration | null | undefined
    const createAt = lead ? subtractDurationFromDate(nextOccurrenceAt, lead) : nextOccurrenceAt
    const seriesId = previous.recurrenceSeriesId ?? previous.id
    const occurrenceKey = nextOccurrenceAt.toISOString()
    const existing = await em.findOne(ServiceCase, {
      tenantId,
      organizationId,
      recurrenceSeriesId: seriesId,
      recurrenceOccurrenceKey: occurrenceKey,
      deletedAt: null,
    })
    if (!existing && now >= createAt) {
      const previousMetadata =
        previous.metadata && typeof previous.metadata === 'object'
          ? (previous.metadata as Record<string, unknown>)
          : null
      let seriesEndsAt = resolveRecurrenceSeriesEndsAt(previousMetadata)
      const offeringId = resolveCustomerOfferingIdFromMetadata(previousMetadata)
      if (!seriesEndsAt && offeringId) {
        const offering = await em.findOne(CatalogCustomerOffering, {
          id: offeringId,
          tenantId,
          organizationId,
          deletedAt: null,
        })
        seriesEndsAt = offering?.endsAt ?? null
      }
      if (
        !isRecurrenceOccurrenceWithinSubscription({
          nextOccurrenceAt,
          endsAt: seriesEndsAt,
        })
      ) {
        previous.recurrenceEnabled = false
        previous.recurrenceNextOccurrenceAt = null
        previous.updatedAt = now
        if (offeringId && seriesEndsAt && now.getTime() > seriesEndsAt.getTime()) {
          const offering = await em.findOne(CatalogCustomerOffering, {
            id: offeringId,
            tenantId,
            organizationId,
            deletedAt: null,
          })
          if (offering && offering.status === 'active') {
            offering.status = 'ended'
            offering.updatedAt = now
          }
        }
        await em.flush()
        continue
      }
      const metadata = cloneCaseMetadataRow(previous.metadata)
      const run = readCasePlaybookRun(metadata)
      const nextMetadata = run
        ? writeCasePlaybookRun(metadata, { playbookId: run.playbookId, currentBlockId: null })
        : metadata
      em.persist(
        em.create(ServiceCase, {
          id: randomUUID(),
          tenantId,
          organizationId,
          title: previous.title,
          statusValue: 'new',
          statusLabel: previous.statusLabel,
          statusColor: previous.statusColor,
          customerEntityId: previous.customerEntityId,
          resourceId: previous.resourceId ?? null,
          procurementProcessId: previous.procurementProcessId ?? null,
          insurancePolicyId: previous.insurancePolicyId ?? null,
          ownerUserId: previous.ownerUserId ?? null,
          openedAt: now,
          closedAt: null,
          dueAt: null,
          overdueNotifiedAt: null,
          priority: previous.priority,
          metadata: nextMetadata,
          recurrenceEnabled: true,
          recurrenceSeriesId: seriesId,
          recurrenceIntervalAmount: previous.recurrenceIntervalAmount,
          recurrenceIntervalUnit: previous.recurrenceIntervalUnit,
          recurrenceCreateLeadTime: previous.recurrenceCreateLeadTime,
          recurrenceOccurrenceKey: occurrenceKey,
          recurrenceNextOccurrenceAt: nextOccurrenceAt,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        }),
      )
      await em.flush()
    }
  }

  const pendingStarts = await em.find(ServiceCase, {
    tenantId,
    organizationId,
    deletedAt: null,
    closedAt: null,
    recurrenceEnabled: true,
    recurrenceNextOccurrenceAt: { $lte: now },
  })
  for (const caseRow of pendingStarts) {
    const result = await startBoundPlaybookIfReady(em, caseRow)
    if (result.started) await em.flush()
  }
}
