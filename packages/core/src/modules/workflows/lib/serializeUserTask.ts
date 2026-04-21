import type { UserTask } from '../data/entities'

/** Plain JSON shape for API responses (ISO date strings). */
export function serializeUserTaskForApi(task: UserTask): Record<string, unknown> {
  return {
    id: task.id,
    workflowInstanceId: task.workflowInstanceId ?? null,
    stepInstanceId: task.stepInstanceId ?? null,
    procurementProcessTaskId: task.procurementProcessTaskId ?? null,
    procurementProcessId: task.procurementProcessId ?? null,
    procurementProcessTitle: task.procurementProcessTitle ?? null,
    taskName: task.taskName,
    description: task.description ?? null,
    status: task.status,
    formSchema: task.formSchema ?? null,
    formData: task.formData ?? null,
    assignedTo: task.assignedTo ?? null,
    assignedToRoles: task.assignedToRoles ?? null,
    claimedBy: task.claimedBy ?? null,
    claimedAt: task.claimedAt ? task.claimedAt.toISOString() : null,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    escalatedAt: task.escalatedAt ? task.escalatedAt.toISOString() : null,
    escalatedTo: task.escalatedTo ?? null,
    completedBy: task.completedBy ?? null,
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    comments: task.comments ?? null,
    tenantId: task.tenantId,
    organizationId: task.organizationId,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  }
}
