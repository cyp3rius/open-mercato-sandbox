import type { EntityManager } from '@mikro-orm/postgresql'
import { ProcurementOrganizationSettings } from '../data/entities'
import { PROCUREMENT_PROCESS_STATUS_DICTIONARY_KEY } from './dictionaryKeys'
import { findDefaultDictionaryEntry, resolveDictionaryPresentation } from './resolveDictionaryPresentation'
import type { DictionaryPresentation } from './resolveDictionaryPresentation'

type Scope = { tenantId: string; organizationId: string }

/**
 * Status snapshot for a newly created process when the client omits `statusValue`:
 * org-configured default (if valid), otherwise the dictionary default entry.
 */
export async function resolveInitialProcurementProcessStatus(
  em: EntityManager,
  scope: Scope,
): Promise<DictionaryPresentation | null> {
  const settings = await em.findOne(ProcurementOrganizationSettings, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
  })
  const raw = settings?.defaultProcessStatusValue?.trim()
  if (raw) {
    try {
      return await resolveDictionaryPresentation(
        em,
        scope,
        PROCUREMENT_PROCESS_STATUS_DICTIONARY_KEY,
        raw,
        'Procurement status dictionary is not configured.',
        'Procurement status not found.',
      )
    } catch {
      // ignore invalid stored default
    }
  }
  return findDefaultDictionaryEntry(em, scope, PROCUREMENT_PROCESS_STATUS_DICTIONARY_KEY)
}

/**
 * Status snapshot when a process is completed (e.g. “Complete process” with linked resource):
 * org-configured terminal status if valid, otherwise the dictionary entry `closed`.
 */
export async function resolveProcurementProcessCompletionStatus(
  em: EntityManager,
  scope: Scope,
): Promise<DictionaryPresentation> {
  const settings = await em.findOne(ProcurementOrganizationSettings, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
  })
  const raw = settings?.terminalProcessStatusValue?.trim()
  if (raw) {
    try {
      return await resolveDictionaryPresentation(
        em,
        scope,
        PROCUREMENT_PROCESS_STATUS_DICTIONARY_KEY,
        raw,
        'Procurement status dictionary is not configured.',
        'Procurement status not found.',
      )
    } catch {
      // invalid stored terminal — fall back below
    }
  }
  return await resolveDictionaryPresentation(
    em,
    scope,
    PROCUREMENT_PROCESS_STATUS_DICTIONARY_KEY,
    'closed',
    'Procurement status dictionary is not configured.',
    'Closed status not found in dictionary.',
  )
}
