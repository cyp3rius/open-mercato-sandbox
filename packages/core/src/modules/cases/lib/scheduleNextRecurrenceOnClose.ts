import { addDurationToDate, type ProcedureDuration } from '../../playbooks/lib/duration'
import type { ServiceCase } from '../data/entities'

function intervalFromCase(caseRow: ServiceCase): ProcedureDuration | null {
  const amount = caseRow.recurrenceIntervalAmount
  const unit = caseRow.recurrenceIntervalUnit
  if (!amount || amount <= 0 || !unit) return null
  if (unit !== 'hours' && unit !== 'days' && unit !== 'weeks' && unit !== 'months') return null
  return { amount, unit }
}

/** When a recurring case closes, schedule the next occurrence timestamp if missing. */
export function scheduleNextRecurrenceOnClose(caseRow: ServiceCase, closedAt: Date): void {
  if (!caseRow.recurrenceEnabled) return
  const interval = intervalFromCase(caseRow)
  if (!interval) return
  if (!caseRow.recurrenceSeriesId) {
    caseRow.recurrenceSeriesId = caseRow.id
  }
  caseRow.recurrenceNextOccurrenceAt = addDurationToDate(closedAt, interval)
}
