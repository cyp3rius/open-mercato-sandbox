"use client"

import * as React from 'react'
import Link from 'next/link'
import { ArrowLeft, CircleCheck, ExternalLink } from 'lucide-react'
import { ApplyBreadcrumb } from '@open-mercato/ui/backend/AppShell'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { LoadingMessage, ErrorMessage } from '@open-mercato/ui/backend/detail'
import { Button } from '@open-mercato/ui/primitives/button'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { formatDateTime } from '@open-mercato/shared/lib/time'

type ProcedureTaskDetail = {
  id: string
  title: string
  body: string | null
  taskStatus: string
  dueAt: string | null
  assignedUserId: string | null
  userTaskId?: string | null
  createdAt: string
  updatedAt: string
  canMarkDone?: boolean
}

export default function CaseProcedureTaskPage({
  params,
}: {
  params?: { id?: string; taskId?: string }
}) {
  const caseId = params?.id?.trim() ?? ''
  const taskId = params?.taskId?.trim() ?? ''
  const t = useT()
  const [row, setRow] = React.useState<ProcedureTaskDetail | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [markingDone, setMarkingDone] = React.useState(false)

  const loadTask = React.useCallback(async () => {
    if (!caseId.length || !taskId.length) {
      setLoading(false)
      setError(t('errors.validation', 'Invalid request.'))
      return
    }
    setLoading(true)
    setError(null)
    const call = await apiCall<ProcedureTaskDetail>(
      `/api/cases/${encodeURIComponent(caseId)}/procedure-tasks/${encodeURIComponent(taskId)}`,
    )
    setLoading(false)
    if (!call.ok || !call.result) {
      setRow(null)
      setError(
        call.result && typeof call.result === 'object' && typeof (call.result as { error?: unknown }).error === 'string'
          ? (call.result as { error: string }).error
          : t('cases.errors.notFound', 'Case not found.'),
      )
      return
    }
    setRow(call.result)
  }, [caseId, taskId, t])

  React.useEffect(() => {
    void loadTask()
  }, [loadTask])

  function formatProcedureTaskStatus(status: string) {
    return t(`cases.detail.procedure.taskStatusValue.${status}`, status)
  }

  const markDone = React.useCallback(async () => {
    if (!caseId.length || !taskId.length) return
    setMarkingDone(true)
    try {
      const call = await apiCall<{ ok?: boolean }>(
        `/api/cases/${encodeURIComponent(caseId)}/procedure-tasks/${encodeURIComponent(taskId)}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ taskStatus: 'done' }),
        },
      )
      if (!call.ok) {
        const rawErr =
          call.result && typeof call.result === 'object' && typeof (call.result as { error?: unknown }).error === 'string'
            ? (call.result as { error: string }).error
            : null
        flash(rawErr && rawErr.startsWith('cases.') ? t(rawErr, rawErr) : rawErr ?? t('errors.generic', 'Something went wrong.'), 'error')
        return
      }
      flash(t('cases.detail.procedure.taskMarkedDone', 'Task marked as done.'), 'success')
      await loadTask()
    } finally {
      setMarkingDone(false)
    }
  }, [caseId, taskId, loadTask, t])

  const backHref = `/backend/cases/${encodeURIComponent(caseId)}`

  return (
    <>
      <ApplyBreadcrumb trail={[{ label: t('cases.detail.title', 'Case'), href: backHref }, { label: row?.title ?? '…' }]} />
      <Page>
        <PageBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-2" asChild>
              <Link href={backHref}>
                <ArrowLeft className="size-4 shrink-0" aria-hidden />
                {t('cases.detail.procedure.taskBackToCase', 'Back to case')}
              </Link>
            </Button>
          </div>

          {loading ? (
            <LoadingMessage label={t('cases.detail.procedure.taskLoading', 'Loading task…')} />
          ) : error ? (
            <ErrorMessage message={error} />
          ) : row ? (
            <div className="rounded-lg border bg-card px-4 py-4 space-y-4">
              <div>
                <h1 className="text-lg font-semibold leading-snug">{row.title}</h1>
                <p className="text-muted-foreground mt-1 text-xs uppercase tracking-wide">
                  {t('cases.detail.procedure.taskStatusShortLabel', 'Status')}: {formatProcedureTaskStatus(row.taskStatus)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {row.userTaskId?.trim().length ? (
                  <Button type="button" variant="outline" size="sm" className="gap-2" asChild>
                    <Link
                      href={`/backend/tasks/${encodeURIComponent(row.userTaskId!.trim())}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="size-4 shrink-0" aria-hidden />
                      {t('cases.detail.procedure.taskOpenInNewTab', 'Open')}
                    </Link>
                  </Button>
                ) : null}
                {row.canMarkDone ? (
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="gap-2"
                    disabled={markingDone}
                    onClick={() => void markDone()}
                  >
                    <CircleCheck className="size-4 shrink-0" aria-hidden />
                    {t('cases.detail.procedure.taskMarkDone', 'Mark as done')}
                  </Button>
                ) : null}
              </div>
              {row.dueAt ? (
                <div className="text-sm">
                  <span className="text-muted-foreground">{t('cases.detail.procedure.taskDueShortLabel', 'Due')}:</span>{' '}
                  <span className="font-medium">{formatDateTime(row.dueAt) ?? row.dueAt}</span>
                </div>
              ) : null}
              {row.body?.trim().length ? (
                <div className="space-y-1">
                  <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    {t('cases.detail.procedure.taskDetailDescription', 'Description')}
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{row.body.trim()}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </PageBody>
      </Page>
    </>
  )
}
