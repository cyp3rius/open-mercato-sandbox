export const OPERATIONS_TASK_CONTEXT_PROCUREMENT_PROCESS = 'procurement_process' as const

/** Service case playbook verification step (see `cases` module). */
export const OPERATIONS_TASK_CONTEXT_CASE_SERVICE = 'case_service' as const

export type OperationsTaskContextType =
  | typeof OPERATIONS_TASK_CONTEXT_PROCUREMENT_PROCESS
  | typeof OPERATIONS_TASK_CONTEXT_CASE_SERVICE
