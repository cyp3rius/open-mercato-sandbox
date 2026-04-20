import type { EntityManager } from '@mikro-orm/postgresql'
import type { AwilixContainer } from 'awilix'
import { normalizeDictionaryValue } from '@open-mercato/core/modules/dictionaries/lib/utils'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { PROCUREMENT_PROCESS_STATUS_DICTIONARY_KEY } from './dictionaryKeys'
import { resolveDictionaryPresentation } from './resolveDictionaryPresentation'
import { ProcurementProcess, ProcurementProcessStatusTransition } from '../data/entities'

export function normProcurementStatusValue(raw: string | null | undefined): string {
  const t = typeof raw === 'string' ? raw.trim() : ''
  return t ? normalizeDictionaryValue(t) : ''
}

export async function procurementStatusTransitionsConfigured(
  em: EntityManager,
  tenantId: string,
  organizationId: string,
): Promise<boolean> {
  const c = await em.count(ProcurementProcessStatusTransition, {
    tenantId,
    organizationId,
  })
  return c > 0
}

export async function listAllProcurementStatusTransitions(
  em: EntityManager,
  tenantId: string,
  organizationId: string,
): Promise<ProcurementProcessStatusTransition[]> {
  return em.find(
    ProcurementProcessStatusTransition,
    { tenantId, organizationId },
    {
      orderBy: { sortOrder: 'ASC', id: 'ASC' },
    },
  )
}

type DictScope = { tenantId: string; organizationId: string }

export async function resolveProcurementStatusDictionaryToken(
  em: EntityManager,
  scope: DictScope,
  raw: string,
): Promise<string> {
  const pres = await resolveDictionaryPresentation(
    em,
    scope,
    PROCUREMENT_PROCESS_STATUS_DICTIONARY_KEY,
    raw.trim(),
    'Procurement status dictionary is not configured.',
    'Procurement status not found.',
  )
  return normProcurementStatusValue(pres.value)
}

export async function listOutgoingProcurementStatusTransitions(
  em: EntityManager,
  tenantId: string,
  organizationId: string,
  fromRaw: string | null | undefined,
): Promise<ProcurementProcessStatusTransition[]> {
  const fromNorm = normProcurementStatusValue(fromRaw)
  return em.find(
    ProcurementProcessStatusTransition,
    {
      tenantId,
      organizationId,
      fromStatusValue: fromNorm,
    },
    { orderBy: { sortOrder: 'ASC', toStatusValue: 'ASC' } },
  )
}

export async function findProcurementStatusTransition(
  em: EntityManager,
  tenantId: string,
  organizationId: string,
  fromRaw: string | null | undefined,
  toRaw: string | null | undefined,
): Promise<ProcurementProcessStatusTransition | null> {
  const fromNorm = normProcurementStatusValue(fromRaw)
  const toNorm = normProcurementStatusValue(toRaw)
  if (!toNorm) return null
  return em.findOne(ProcurementProcessStatusTransition, {
    tenantId,
    organizationId,
    fromStatusValue: fromNorm,
    toStatusValue: toNorm,
  })
}

export async function assertProcurementStatusTransitionAllowed(
  em: EntityManager,
  tenantId: string,
  organizationId: string,
  fromRaw: string | null | undefined,
  toRaw: string | null | undefined,
): Promise<void> {
  if (!(await procurementStatusTransitionsConfigured(em, tenantId, organizationId))) return
  const toNorm = normProcurementStatusValue(toRaw)
  if (!toNorm) {
    throw new CrudHttpError(400, {
      error: 'Clearing status is not allowed while status transitions are configured.',
      code: 'PROCUREMENT_STATUS_TRANSITION_DENIED',
    })
  }
  const fromNorm = normProcurementStatusValue(fromRaw)
  const row = await findProcurementStatusTransition(em, tenantId, organizationId, fromNorm, toNorm)
  if (!row) {
    throw new CrudHttpError(400, {
      error: 'Status transition not allowed.',
      code: 'PROCUREMENT_STATUS_TRANSITION_DENIED',
      details: { from: fromNorm.length ? fromNorm : null, to: toNorm },
    })
  }
}

export async function runProcurementTransitionAutomation(
  em: EntityManager,
  container: AwilixContainer,
  record: ProcurementProcess,
  fromStatus: string | null,
  toStatus: string | null,
  automationWorkflowId: string | null | undefined,
  initiatedBy: string | null | undefined,
): Promise<void> {
  const wid = typeof automationWorkflowId === 'string' ? automationWorkflowId.trim() : ''
  if (!wid.length) return

  const { startWorkflow, executeWorkflow } = await import('../../workflows/lib/workflow-executor')

  const instance = await startWorkflow(em, {
    workflowId: wid,
    tenantId: record.tenantId,
    organizationId: record.organizationId,
    correlationKey: `procurement.process:${record.id}:${Date.now()}`,
    initialContext: {
      procurementProcessId: record.id,
      fromStatusValue: fromStatus,
      toStatusValue: toStatus,
    },
    metadata: {
      entityType: 'procurement.process',
      entityId: record.id,
      initiatedBy: initiatedBy ?? undefined,
    },
  })

  void executeWorkflow(em, container, instance.id).catch((err) => {
    console.error('[procurement] transition workflow execute failed', err)
  })
}
