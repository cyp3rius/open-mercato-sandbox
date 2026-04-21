/** Deep link to procurement process detail: Tasks tab with a task dialog opened via `taskId` search param. */
export function buildProcurementProcessTaskDeepLink(processId: string, taskId: string): string {
  const q = new URLSearchParams({ tab: 'tasks', taskId })
  return `/backend/procurement/processes/${processId}?${q.toString()}`
}

/** Link to procurement process overview (no tab). */
export function buildProcurementProcessDeepLink(processId: string): string {
  return `/backend/procurement/processes/${processId}`
}
