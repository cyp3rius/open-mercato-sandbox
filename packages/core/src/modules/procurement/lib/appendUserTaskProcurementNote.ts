import type { EntityManager } from '@mikro-orm/core'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { UserTask } from '../../workflows/data/entities'
import type { OperationsTask, ProcurementProcess } from '../data/entities'
import { appendProcurementTimelineEvent } from './timeline'

export async function appendProcurementTimelineNoteFromUserTask(
  em: EntityManager,
  opts: {
    userTask: UserTask
    procurementTask: OperationsTask
    process: ProcurementProcess
    text: string
    actorUserId: string | null
  },
): Promise<void> {
  const { translate } = await resolveTranslations()
  await appendProcurementTimelineEvent(em, {
    process: opts.process,
    eventType: 'task.user_task_note',
    message: translate(
      'procurement.timeline.msg.userTaskNote',
      'User task note: {{text}}',
      { text: opts.text.trim() },
    ),
    actorUserId: opts.actorUserId,
    metadata: { procurementTaskId: opts.procurementTask.id, userTaskId: opts.userTask.id },
  })
}
