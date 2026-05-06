import type { EntityManager } from '@mikro-orm/postgresql'
import { UserTask } from '../../workflows/data/entities'
import type { OperationsTask } from '../../procurement/data/entities'
import type { ServiceCase } from '../data/entities'

function mapOperationsTaskStatusToUserTaskStatus(
  taskStatus: string,
  currentUserTaskStatus?: string | null,
): 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'ESCALATED' {
  const s = taskStatus.toLowerCase()
  if (s === 'done') return 'COMPLETED'
  if (s === 'cancelled' || s === 'canceled') return 'CANCELLED'
  if (currentUserTaskStatus === 'IN_PROGRESS') return 'IN_PROGRESS'
  return 'PENDING'
}

function truncateTaskName(title: string): string {
  return title.length > 255 ? title.slice(0, 255) : title
}

function truncateCaseTitle(title: string): string {
  return title.length > 500 ? title.slice(0, 500) : title
}

function copyDueAt(task: OperationsTask): Date | null {
  const raw = task.dueAt
  if (!raw) return null
  const d = raw instanceof Date ? raw : new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return new Date(d.getTime())
}

export function applyCaseServiceProcedureTaskToUserTask(
  userTask: UserTask,
  task: OperationsTask,
  serviceCase: ServiceCase,
): void {
  userTask.taskName = truncateTaskName(task.title)
  userTask.description = task.body ?? null
  userTask.assignedTo = task.assignedUserId ?? null
  userTask.dueDate = copyDueAt(task)
  userTask.serviceCaseId = serviceCase.id
  userTask.serviceCaseTitle = truncateCaseTitle(serviceCase.title)

  const st = task.taskStatus.toLowerCase()
  if (st === 'done') {
    userTask.status = 'COMPLETED'
    userTask.completedAt = task.updatedAt ? new Date(task.updatedAt.getTime()) : new Date()
  } else if (st === 'cancelled' || st === 'canceled') {
    userTask.status = 'CANCELLED'
    userTask.completedAt = null
    userTask.completedBy = null
  } else {
    userTask.status = mapOperationsTaskStatusToUserTaskStatus(task.taskStatus, userTask.status)
    if (userTask.status === 'PENDING' || userTask.status === 'IN_PROGRESS') {
      userTask.completedAt = null
      userTask.completedBy = null
    }
  }
}

export async function syncCaseServiceProcedureTaskWorkItemCreate(
  em: EntityManager,
  serviceCase: ServiceCase,
  task: OperationsTask,
): Promise<void> {
  if (task.workItemUserTaskId) return

  const now = new Date()
  const userTask = em.create(UserTask, {
    workflowInstanceId: null,
    stepInstanceId: null,
    taskName: '',
    status: 'PENDING',
    formSchema: null,
    formData: null,
    assignedToRoles: null,
    claimedBy: null,
    claimedAt: null,
    tenantId: task.tenantId,
    organizationId: task.organizationId,
    createdAt: now,
    updatedAt: now,
  })
  applyCaseServiceProcedureTaskToUserTask(userTask, task, serviceCase)
  userTask.updatedAt = new Date()
  em.persist(userTask)
  await em.flush()
  task.workItemUserTaskId = userTask.id
  await em.persistAndFlush(task)
}
