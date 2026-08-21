import type { EntityManager } from '@mikro-orm/postgresql'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetFinancialEntry, TaxiFleetWeeklySettlement } from '../data/entities'
import { normalizeNipDigits } from '@open-mercato/core/modules/customers/lib/nip'
import {
  parseSettlementCostExclusions,
  type SettlementCostExclusion,
} from './settlementCostExclusions'
import { resolveFinancialEntryWeekStart } from './settlementWeekScope'
import { isWeeklySettlementLocked } from './settlementLock'
import { applyWeeklySettlementRecalculation } from './settlementRecalculation'

export const DOCUMENT_DUPLICATE_EXCLUSION_COMMENT = 'document_duplicate'

export function normalizeDocumentDuplicateNumber(value: string | null | undefined): string | null {
  if (value == null) return null
  const normalized = value.trim().toUpperCase().replace(/[\s\-./]/g, '')
  return normalized.length > 0 ? normalized : null
}

export function normalizeDocumentDuplicateNip(value: string | null | undefined): string | null {
  if (value == null) return null
  const digits = normalizeNipDigits(value)
  return digits && digits.length > 0 ? digits : null
}

export function documentOccurredDateKey(occurredAt: Date | string | null | undefined): string | null {
  if (occurredAt == null) return null
  const date = occurredAt instanceof Date ? occurredAt : new Date(occurredAt)
  if (Number.isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function financialEntriesAreDocumentDuplicates(
  left: {
    documentNumber?: string | null
    occurredAt?: Date | string | null
    documentNip?: string | null
  },
  right: {
    documentNumber?: string | null
    occurredAt?: Date | string | null
    documentNip?: string | null
  },
): boolean {
  const leftNumber = normalizeDocumentDuplicateNumber(left.documentNumber)
  const rightNumber = normalizeDocumentDuplicateNumber(right.documentNumber)
  if (!leftNumber || !rightNumber || leftNumber !== rightNumber) return false

  const leftNip = normalizeDocumentDuplicateNip(left.documentNip)
  const rightNip = normalizeDocumentDuplicateNip(right.documentNip)
  if (leftNip && rightNip) {
    return leftNip === rightNip
  }
  // Same document number with NIP only on one side still counts as a duplicate.
  if (leftNip || rightNip) {
    return true
  }

  const leftDate = documentOccurredDateKey(left.occurredAt)
  const rightDate = documentOccurredDateKey(right.occurredAt)
  if (!leftDate || !rightDate || leftDate !== rightDate) return false
  return true
}

async function excludeDuplicateFromSettlement(
  em: EntityManager,
  entry: TaxiFleetFinancialEntry,
): Promise<void> {
  if (entry.kind !== 'expense') return
  const weekStart = resolveFinancialEntryWeekStart(entry.occurredAt)
  const settlement = await findWithDecryption(
    em,
    TaxiFleetWeeklySettlement,
    {
      tenantId: entry.tenantId,
      organizationId: entry.organizationId,
      teamMemberId: entry.teamMemberId,
      weekStart,
      deletedAt: null,
    },
    undefined,
    { tenantId: entry.tenantId, organizationId: entry.organizationId },
  )
  if (!settlement || isWeeklySettlementLocked(settlement.status)) return

  const existing = parseSettlementCostExclusions(settlement.snapshotJson)
  const includedDuplicateIds = Array.isArray(settlement.snapshotJson?.includedDuplicateEntryIds)
    ? (settlement.snapshotJson!.includedDuplicateEntryIds as unknown[]).filter(
        (id): id is string => typeof id === 'string',
      )
    : []
  if (includedDuplicateIds.includes(entry.id)) return
  if (existing.some((item) => item.financialEntryId === entry.id)) return

  const nextExcluded: SettlementCostExclusion[] = [
    ...existing,
    {
      financialEntryId: entry.id,
      comment: DOCUMENT_DUPLICATE_EXCLUSION_COMMENT,
      excludedAt: new Date().toISOString(),
    },
  ]
  await applyWeeklySettlementRecalculation(em, settlement, { excludedCosts: nextExcluded })
  await em.flush()
}

/**
 * Detects document duplicates (number + date [+ nip when both present]).
 * Keeps the oldest entry as original; marks newer ones as duplicates and excludes them from weekly settlement by default.
 */
export async function syncFinancialEntryDocumentDuplicates(
  em: EntityManager,
  entry: TaxiFleetFinancialEntry,
): Promise<{ isDuplicate: boolean; duplicateOfEntryId: string | null }> {
  const documentNumber = normalizeDocumentDuplicateNumber(entry.documentNumber)
  if (!documentNumber) {
    if (entry.isDocumentDuplicate || entry.duplicateOfEntryId) {
      entry.isDocumentDuplicate = false
      entry.duplicateOfEntryId = null
      entry.updatedAt = new Date()
      await em.flush()
    }
    return { isDuplicate: false, duplicateOfEntryId: null }
  }

  const dateKey = documentOccurredDateKey(entry.occurredAt)
  const dayStart = dateKey ? new Date(`${dateKey}T00:00:00`) : null
  const dayEnd = dateKey ? new Date(`${dateKey}T23:59:59.999`) : null
  const scope = { tenantId: entry.tenantId, organizationId: entry.organizationId }

  const byDay =
    dayStart && dayEnd
      ? await findWithDecryption(
          em,
          TaxiFleetFinancialEntry,
          {
            tenantId: entry.tenantId,
            organizationId: entry.organizationId,
            deletedAt: null,
            occurredAt: { $gte: dayStart, $lte: dayEnd },
          },
          { orderBy: { createdAt: 'ASC' } },
          scope,
        )
      : []

  const documentNip = normalizeDocumentDuplicateNip(entry.documentNip)
  const byNip = documentNip
    ? await findWithDecryption(
        em,
        TaxiFleetFinancialEntry,
        {
          tenantId: entry.tenantId,
          organizationId: entry.organizationId,
          deletedAt: null,
          documentNip,
        },
        { orderBy: { createdAt: 'ASC' } },
        scope,
      )
    : []

  const byNumberRows = await em.getConnection().execute<Array<{ id: string }>>(
    `
      select id
      from taxi_fleet_financial_entries
      where tenant_id = ?
        and organization_id = ?
        and deleted_at is null
        and document_number is not null
        and upper(regexp_replace(document_number, '[\\s\\-./]', '', 'g')) = ?
      order by created_at asc
      limit 50
    `,
    [entry.tenantId, entry.organizationId, documentNumber],
  )
  const byNumberIds = byNumberRows.map((row) => row.id).filter(Boolean)
  const byNumber = byNumberIds.length
    ? await findWithDecryption(
        em,
        TaxiFleetFinancialEntry,
        {
          id: { $in: byNumberIds },
          deletedAt: null,
        },
        { orderBy: { createdAt: 'ASC' } },
        scope,
      )
    : []

  const byId = new Map<string, TaxiFleetFinancialEntry>()
  for (const candidate of [...byDay, ...byNip, ...byNumber, entry]) {
    byId.set(candidate.id, candidate)
  }
  const candidates = [...byId.values()].sort(
    (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
  )

  const group = candidates.filter((candidate) =>
    financialEntriesAreDocumentDuplicates(entry, candidate),
  )
  if (group.length <= 1) {
    if (entry.isDocumentDuplicate || entry.duplicateOfEntryId) {
      entry.isDocumentDuplicate = false
      entry.duplicateOfEntryId = null
      entry.updatedAt = new Date()
      await em.flush()
    }
    return { isDuplicate: false, duplicateOfEntryId: null }
  }

  const original = group[0]!
  for (const member of group) {
    const shouldBeDuplicate = member.id !== original.id
    const nextDuplicateOf = shouldBeDuplicate ? original.id : null
    if (
      member.isDocumentDuplicate !== shouldBeDuplicate ||
      (member.duplicateOfEntryId ?? null) !== nextDuplicateOf
    ) {
      member.isDocumentDuplicate = shouldBeDuplicate
      member.duplicateOfEntryId = nextDuplicateOf
      member.updatedAt = new Date()
    }
  }
  await em.flush()

  for (const member of group) {
    if (member.isDocumentDuplicate) {
      await excludeDuplicateFromSettlement(em, member)
    }
  }

  const refreshed = group.find((member) => member.id === entry.id) ?? entry
  return {
    isDuplicate: Boolean(refreshed.isDocumentDuplicate),
    duplicateOfEntryId: refreshed.duplicateOfEntryId ?? null,
  }
}
