/**
 * Due date semantics: a task is "overdue" only after the calendar day of the due date
 * has passed (end-of-day style), not simply when `dueDate < now()` on the same day.
 */
export function isUserTaskCalendarOverdue(
  dueDate: Date | string | null | undefined,
  status: string,
): boolean {
  if (!dueDate || status === 'COMPLETED' || status === 'CANCELLED') {
    return false
  }
  const d = typeof dueDate === 'string' ? new Date(dueDate) : dueDate
  if (Number.isNaN(d.getTime())) return false
  const dueDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return dueDay < today
}

/** Start of today in local time — for API overdue filters. */
export function startOfLocalToday(): Date {
  const n = new Date()
  n.setHours(0, 0, 0, 0)
  return n
}
