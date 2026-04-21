import type { EntityManager } from '@mikro-orm/core'
import { ProcurementProcess, ProcurementProcessTimelineEvent } from '../data/entities'

export async function appendProcurementTimelineEvent(
  em: EntityManager,
  params: {
    process: ProcurementProcess
    eventType: string
    message: string
    actorUserId?: string | null
    metadata?: Record<string, unknown> | null
  },
): Promise<ProcurementProcessTimelineEvent> {
  const row = em.create(ProcurementProcessTimelineEvent, {
    tenantId: params.process.tenantId,
    organizationId: params.process.organizationId,
    process: params.process,
    eventType: params.eventType,
    message: params.message,
    actorUserId: params.actorUserId ?? null,
    metadata: params.metadata ?? null,
    createdAt: new Date(),
  })
  em.persist(row)
  return row
}
