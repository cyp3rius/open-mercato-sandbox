import type { EntityManager } from '@mikro-orm/postgresql'
import { Playbook } from '../../playbooks/data/entities'
import { parseProcedureBlocksJson } from '../../playbooks/lib/procedureBlocks'
import { addDurationToDate } from '../../playbooks/lib/duration'
import {
  findWithPath,
  firstExecutableBlockId,
} from './caseProcedureEngine'
import {
  cloneCaseMetadataRow,
  readCasePlaybookRun,
  writeCasePlaybookRun,
  type CasePlaybookRunMetadata,
} from './casePlaybookMetadata'
import type { ServiceCase } from '../data/entities'

type StartResult = { started: boolean; run: CasePlaybookRunMetadata | null }

/**
 * Starts a bound but unstarted playbook on an open case (used by recurrence worker).
 * Returns started=false when prerequisites are missing.
 */
export async function startBoundPlaybookIfReady(
  em: EntityManager,
  caseRow: ServiceCase,
): Promise<StartResult> {
  if (caseRow.closedAt || caseRow.deletedAt) return { started: false, run: null }
  const meta = cloneCaseMetadataRow(caseRow.metadata)
  const run = readCasePlaybookRun(meta)
  if (!run?.playbookId || run.startedAt) return { started: false, run }
  const ownerUserId = caseRow.ownerUserId?.trim()
  if (!ownerUserId) return { started: false, run }

  const pb = await em.findOne(Playbook, {
    id: run.playbookId,
    tenantId: caseRow.tenantId,
    organizationId: caseRow.organizationId,
    deletedAt: null,
  })
  if (!pb) return { started: false, run }

  const def = parseProcedureBlocksJson(pb.procedureDefinition ?? null)
  const first = firstExecutableBlockId(def)
  const startedAt = new Date().toISOString()
  let nextRun: CasePlaybookRunMetadata = {
    playbookId: run.playbookId,
    startedAt,
    currentBlockId: first,
    procedureOwnerUserId: ownerUserId,
    ...(pb.defaultSlaDuration
      ? { procedureDueAt: addDurationToDate(new Date(startedAt), pb.defaultSlaDuration).toISOString() }
      : {}),
  }
  if (!caseRow.dueAt && pb.defaultSlaDuration) {
    caseRow.dueAt = addDurationToDate(new Date(startedAt), pb.defaultSlaDuration)
  }
  if (first) {
    const loc = findWithPath(def, first)
    // Verification tasks require interactive create; leave block as current without auto-task here.
    void loc
  }
  caseRow.metadata = writeCasePlaybookRun(meta, nextRun)
  caseRow.updatedAt = new Date()
  return { started: true, run: nextRun }
}
