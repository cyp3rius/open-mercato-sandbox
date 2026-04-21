import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { UserTask } from '../../workflows/data/entities'
import type { ProcurementProcess, ProcurementProcessTask } from '../data/entities'

function mapProcurementTaskStatusToUserTaskStatus(
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

function copyDueAt(task: ProcurementProcessTask): Date | null {
  const raw = task.dueAt
  if (!raw) return null
  const d = raw instanceof Date ? raw : new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return new Date(d.getTime())
}

/**
 * Maps procurement task + process onto a UserTask row (create + update paths).
 */
export function applyProcurementTaskToUserTask(
  userTask: UserTask,
  task: ProcurementProcessTask,
  process: ProcurementProcess,
): void {
  const processId = process.id
  userTask.taskName = truncateTaskName(task.title)
  userTask.description = task.body ?? null
  userTask.assignedTo = task.assignedUserId ?? null
  userTask.dueDate = copyDueAt(task)
  userTask.procurementProcessId = processId
  userTask.procurementProcessTaskId = task.id
  userTask.procurementProcessTitle = process.title

  const st = task.taskStatus.toLowerCase()
  if (st === 'done') {
    userTask.status = 'COMPLETED'
    userTask.completedAt = task.updatedAt ? new Date(task.updatedAt.getTime()) : new Date()
  } else if (st === 'cancelled' || st === 'canceled') {
    userTask.status = 'CANCELLED'
    userTask.completedAt = null
    userTask.completedBy = null
  } else {
    userTask.status = mapProcurementTaskStatusToUserTaskStatus(task.taskStatus, userTask.status)
    if (userTask.status === 'PENDING' || userTask.status === 'IN_PROGRESS') {
      userTask.completedAt = null
      userTask.completedBy = null
    }
  }
}

/**
 * Creates or updates a workflows `UserTask` so the procurement task appears on `/backend/tasks`.
 */
export async function syncProcurementTaskWorkItemCreate(
  _ctx: CommandRuntimeContext,
  em: EntityManager,
  process: ProcurementProcess,
  task: ProcurementProcessTask,
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
  applyProcurementTaskToUserTask(userTask, task, process)
  userTask.updatedAt = new Date()
  em.persist(userTask)
  await em.flush()
  task.workItemUserTaskId = userTask.id
  await em.persistAndFlush(task)
}

export async function syncProcurementTaskWorkItemUpdate(
  _ctx: CommandRuntimeContext,
  em: EntityManager,
  process: ProcurementProcess,
  task: ProcurementProcessTask,
): Promise<void> {
  if (!task.workItemUserTaskId) return

  const userTask = await em.findOne(UserTask, { id: task.workItemUserTaskId })
  if (!userTask) return

  applyProcurementTaskToUserTask(userTask, task, process)
  userTask.updatedAt = new Date()
  await em.flush()
}

export async function syncProcurementTaskWorkItemDelete(
  _ctx: CommandRuntimeContext,
  em: EntityManager,
  task: ProcurementProcessTask,
): Promise<void> {
  if (!task.workItemUserTaskId) return

  const userTask = await em.findOne(UserTask, { id: task.workItemUserTaskId })
  if (userTask) {
    em.remove(userTask)
  }
  task.workItemUserTaskId = null
  await em.flush()
}
