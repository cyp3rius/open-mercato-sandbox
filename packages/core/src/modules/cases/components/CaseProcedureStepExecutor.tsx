"use client"

import * as React from 'react'
import Link from 'next/link'
import {
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  CornerDownLeft,
  ExternalLink,
  GitBranch,
  Layers,
  PlayCircle,
  Send,
  StopCircle,
  X,
  Zap,
} from 'lucide-react'
import { formatDateTime } from '@open-mercato/shared/lib/time'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { CRUD_FORM_TEXT_INPUT_CLASS, CRUD_FORM_TEXTAREA_CLASS } from '@open-mercato/ui/backend/CrudForm'
import { Button } from '@open-mercato/ui/primitives/button'
import { Badge } from '@open-mercato/ui/primitives/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@open-mercato/ui/primitives/dialog'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { HtmlRichTextEditor } from '@open-mercato/ui/backend/richtext/HtmlRichTextEditor'
import type { CaseProcedureBlockJson } from '../lib/procedureBlockJson'
import { formatProcedurePlaybookLabel } from '../lib/formatProcedurePlaybookLabel'
import { defaultHtmlFromNotifyBody, htmlToPlainText } from '../lib/htmlToPlainText'
import { resolveUserDisplayLabel } from '../../procurement/lib/procurementEntitySearch'

type Kind = CaseProcedureBlockJson['kind']

function blockKindIcon(kind: Kind) {
  if (kind === 'start') return PlayCircle
  if (kind === 'end') return StopCircle
  if (kind === 'action') return Zap
  if (kind === 'condition') return GitBranch
  if (kind === 'invoke_procedure') return Layers
  return CornerDownLeft
}

function BlockKindBadge({ kind }: { kind: Kind }) {
  const t = useT()
  const label =
    kind === 'start'
      ? t('playbooks.procedure.kind.start', 'Start')
      : kind === 'end'
        ? t('playbooks.procedure.kind.end', 'End')
        : kind === 'action'
          ? t('playbooks.procedure.kind.action', 'Action')
          : kind === 'condition'
            ? t('playbooks.procedure.kind.condition', 'Condition')
            : kind === 'goto'
              ? t('playbooks.procedure.kind.goto', 'Go to step')
              : t('playbooks.procedure.kind.invoke_procedure', 'Procedure')
  const Icon = blockKindIcon(kind)
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-input bg-muted/40 px-2 py-1 text-xs font-medium text-foreground"
      title={label}
    >
      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="max-w-[10rem] truncate">{label}</span>
    </span>
  )
}

export type InvokeProcedureOptionHead = {
  slug: string
  playbookId: string | null
  title: string | null
  version: number | null
}

export type ProcedureTaskSummaryHead = {
  id: string
  title: string
  dueAt: string | null
  taskStatus: string
  userTaskId?: string | null
}

export type CaseProcedureStepExecutorProps = {
  block: CaseProcedureBlockJson | null
  caseId?: string
  disabled?: boolean
  canNext?: boolean
  canSendNotify?: boolean
  canAnswerYesNo?: boolean
  invokeProcedureOptions?: InvokeProcedureOptionHead[]
  canLaunchInvokeProcedure?: boolean
  procedureTaskSummary?: ProcedureTaskSummaryHead | null
  canScheduleProcedureTask?: boolean
  onNext?: (options?: { closingNote?: string }) => void
  onSendNotify?: (plainBody: string) => void
  onAnswer?: (branch: 'yes' | 'no') => void
  onLaunchInvokeProcedure?: (slug: string) => void
  onScheduleProcedureTask?: (payload: {
    title: string
    body?: string
    dueAt?: string | null
  }) => boolean | Promise<boolean>
}

export function CaseProcedureStepExecutor({
  block,
  caseId: caseIdProp,
  disabled = false,
  canNext = false,
  canSendNotify = false,
  canAnswerYesNo = false,
  invokeProcedureOptions = [],
  canLaunchInvokeProcedure = false,
  procedureTaskSummary = null,
  canScheduleProcedureTask = false,
  onNext,
  onSendNotify,
  onAnswer,
  onLaunchInvokeProcedure,
  onScheduleProcedureTask,
}: CaseProcedureStepExecutorProps) {
  const t = useT()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [notifyHtml, setNotifyHtml] = React.useState('')
  const [verifierDisplayLabel, setVerifierDisplayLabel] = React.useState('')
  const [closingNoteDraft, setClosingNoteDraft] = React.useState('')
  const [pickedInvokeSlug, setPickedInvokeSlug] = React.useState('')
  const [scheduleOpen, setScheduleOpen] = React.useState(false)
  const [scheduleTitle, setScheduleTitle] = React.useState('')
  const [scheduleDueLocal, setScheduleDueLocal] = React.useState('')
  const [scheduleSaving, setScheduleSaving] = React.useState(false)

  React.useEffect(() => {
    setClosingNoteDraft('')
  }, [block?.id])

  React.useEffect(() => {
    const resolved = invokeProcedureOptions.filter((o) => Boolean(o.playbookId?.trim().length))
    setPickedInvokeSlug((prev) => {
      if (resolved.length === 1) {
        return resolved[0].slug
      }
      if (prev && resolved.some((r) => r.slug === prev)) {
        return prev
      }
      return resolved[0]?.slug ?? ''
    })
  }, [block?.id, invokeProcedureOptions])

  React.useEffect(() => {
    if (block?.kind === 'action' && block.actionVariant === 'task') {
      setScheduleTitle(block.taskTitle?.trim() ?? '')
      setScheduleDueLocal('')
      setScheduleOpen(false)
    }
  }, [block?.id, block?.kind, block?.actionVariant])

  React.useEffect(() => {
    if (block?.kind === 'action' && block.actionVariant === 'notify') {
      setNotifyHtml(defaultHtmlFromNotifyBody(block.notifyBody))
    } else {
      setNotifyHtml('')
    }
  }, [block])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const vid =
        block?.kind === 'condition' &&
        block.conditionMode === 'verification' &&
        typeof block.verificationUserId === 'string'
          ? block.verificationUserId.trim()
          : ''
      if (!vid.length) {
        if (!cancelled) setVerifierDisplayLabel('')
        return
      }
      const label = await resolveUserDisplayLabel(vid)
      if (!cancelled) setVerifierDisplayLabel(label ?? '')
    })()
    return () => {
      cancelled = true
    }
  }, [block])

  const confirmRejectNo = React.useCallback(async () => {
    const ok = await confirm({
      title: t('cases.detail.procedure.rejectConfirmTitle', 'Reject this branch?'),
      text: t(
        'cases.detail.procedure.rejectConfirmText',
        'The procedure will follow the “no” branch. This may change subsequent steps, tasks, or notifications for this case.',
      ),
      confirmText: t('cases.detail.procedure.rejectConfirmAction', 'Reject'),
      variant: 'destructive',
    })
    if (ok) onAnswer?.('no')
  }, [confirm, onAnswer, t])

  if (!block) {
    return null
  }

  const notifyReadOnly =
    block.kind === 'action' && block.actionVariant === 'notify' && !canSendNotify

  const title =
    block.label?.trim().length
      ? block.label.trim()
      : block.kind === 'start'
        ? t('playbooks.procedure.kind.start', 'Start')
        : block.kind === 'end'
          ? t('playbooks.procedure.kind.end', 'End')
          : block.kind === 'action'
            ? t('playbooks.procedure.kind.action', 'Action')
            : block.kind === 'condition'
              ? t('playbooks.procedure.kind.condition', 'Condition')
              : block.kind === 'goto'
                ? t('playbooks.procedure.kind.goto', 'Go to step')
                : t('playbooks.procedure.kind.invoke_procedure', 'Procedure')

  const onPlaybookTaskStep = block.kind === 'action' && block.actionVariant === 'task'
  const showSchedulePlaybookTask =
    onPlaybookTaskStep && Boolean(canScheduleProcedureTask && onScheduleProcedureTask)
  const showNextButton = Boolean(canNext && onNext && !showSchedulePlaybookTask)

  const submitScheduleTask = async () => {
    const title = scheduleTitle.trim()
    if (!title.length || !onScheduleProcedureTask) return
    setScheduleSaving(true)
    try {
      let dueAt: string | null | undefined
      if (scheduleDueLocal.trim().length) {
        const dt = new Date(scheduleDueLocal)
        dueAt = Number.isNaN(dt.getTime()) ? null : dt.toISOString()
      }
      const ok = await onScheduleProcedureTask({
        title,
        dueAt,
      })
      if (ok !== false) {
        setScheduleOpen(false)
      }
    } finally {
      setScheduleSaving(false)
    }
  }

  return (
    <>
      {ConfirmDialogElement}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent
          className="flex flex-col sm:max-w-md sm:min-h-[20rem]"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              void submitScheduleTask()
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{t('cases.detail.procedure.scheduleTaskDialogTitle', 'Schedule a task')}</DialogTitle>
          </DialogHeader>
          <div className="flex min-h-[11rem] flex-1 flex-col space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="case-procedure-task-title">{t('cases.detail.procedure.taskTitleField', 'Title')}</Label>
              <Input
                id="case-procedure-task-title"
                className={CRUD_FORM_TEXT_INPUT_CLASS}
                value={scheduleTitle}
                onChange={(e) => setScheduleTitle(e.target.value)}
                disabled={disabled || scheduleSaving}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="case-procedure-task-due">
                {t('cases.detail.procedure.taskDueField', 'Due date')}
              </Label>
              <Input
                id="case-procedure-task-due"
                type="datetime-local"
                className={CRUD_FORM_TEXT_INPUT_CLASS}
                value={scheduleDueLocal}
                onChange={(e) => setScheduleDueLocal(e.target.value)}
                disabled={disabled || scheduleSaving}
              />
            </div>
          </div>
          <DialogFooter className="mt-auto gap-3 pt-2 sm:gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={scheduleSaving}
              onClick={() => setScheduleOpen(false)}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              type="button"
              variant="default"
              disabled={disabled || scheduleSaving || !scheduleTitle.trim().length}
              className="gap-2"
              onClick={() => void submitScheduleTask()}
            >
              <CalendarDays className="size-4 shrink-0" aria-hidden />
              {t('cases.detail.procedure.scheduleTaskConfirm', 'Save task')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    <div className="space-y-3 border-t border-border pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <BlockKindBadge kind={block.kind} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-snug">{title}</div>
        </div>
      </div>

      {block.kind === 'action' && block.actionVariant === 'notify' ? (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-md border border-border/60 bg-muted/20 px-2.5 py-2">
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {t('playbooks.procedure.actionType', 'Type')}
              </div>
              <div className="mt-0.5 text-sm font-medium">
                {t('playbooks.procedure.actionNotify', 'Notification')}
              </div>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/20 px-2.5 py-2">
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {t('playbooks.procedure.notifyChannel', 'Channel')}
              </div>
              <div className="mt-0.5 text-sm font-medium">
                {block.notifyChannel === 'email'
                  ? t('playbooks.procedure.channelEmail', 'Email')
                  : block.notifyChannel === 'whatsapp'
                    ? t('playbooks.procedure.channelWhatsapp', 'WhatsApp')
                    : block.notifyChannel === 'message'
                      ? t('playbooks.procedure.channelMessage', 'Message')
                      : '—'}
              </div>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/20 px-2.5 py-2 sm:col-span-2">
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {t('playbooks.procedure.notifyTarget', 'Recipient')}
              </div>
              <div className="mt-0.5 text-sm font-medium">
                {block.notifyTarget === 'customer'
                  ? t('playbooks.procedure.targetCustomer', 'Customer')
                  : t('playbooks.procedure.targetOwner', 'Owner')}
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-foreground">
              {t('cases.detail.procedure.notifyEditorLabel', 'Message content')}
            </span>
            <HtmlRichTextEditor
              value={notifyHtml}
              onChange={setNotifyHtml}
              disabled={disabled || notifyReadOnly}
            />
          </div>
          {canSendNotify && onSendNotify ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="default"
                className="gap-2 bg-foreground text-background hover:bg-foreground/90"
                disabled={disabled}
                onClick={() => onSendNotify(htmlToPlainText(notifyHtml))}
              >
                <Send className="size-4 shrink-0" aria-hidden />
                {t('cases.detail.procedure.sendMessage', 'Send')}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {block.kind === 'action' && block.actionVariant === 'task' ? (
        <div className="space-y-3">
          {!procedureTaskSummary ? (
            block.taskTitle?.trim().length ? (
              <p className="text-muted-foreground text-sm leading-relaxed">{block.taskTitle.trim()}</p>
            ) : (
              <p className="text-muted-foreground text-sm italic leading-relaxed">
                {t('cases.detail.procedure.taskPlaybookNoHint', 'No hint defined for this task step.')}
              </p>
            )
          ) : null}
          {procedureTaskSummary ? (
            <div className="rounded-md border border-border/60 bg-muted/15 px-3 py-2.5 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t('cases.detail.procedure.scheduledTaskLabel', 'Your task')}
                  </div>
                  <div className="text-sm font-semibold leading-snug">{procedureTaskSummary.title}</div>
                  {procedureTaskSummary.dueAt ? (
                    <div className="text-muted-foreground text-xs">
                      {t('cases.detail.procedure.taskDueShortLabel', 'Due')}:{' '}
                      <span className="text-foreground">
                        {formatDateTime(procedureTaskSummary.dueAt) ?? procedureTaskSummary.dueAt}
                      </span>
                    </div>
                  ) : (
                    <div className="text-muted-foreground text-xs">
                      {t('cases.detail.procedure.taskNoDue', 'No due date')}
                    </div>
                  )}
                  <div className="text-muted-foreground text-xs">
                    {t('cases.detail.procedure.taskStatusShortLabel', 'Status')}:{' '}
                    {t(
                      `cases.detail.procedure.taskStatusValue.${procedureTaskSummary.taskStatus}`,
                      procedureTaskSummary.taskStatus,
                    )}
                  </div>
                </div>
                {procedureTaskSummary.userTaskId?.trim().length ? (
                  <Button type="button" variant="outline" size="sm" className="shrink-0 gap-2" asChild>
                    <Link
                      href={`/backend/tasks/${encodeURIComponent(procedureTaskSummary.userTaskId!.trim())}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="size-4 shrink-0" aria-hidden />
                      {t('cases.detail.procedure.taskOpenInNewTab', 'Open')}
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
          {procedureTaskSummary && procedureTaskSummary.taskStatus !== 'done' ? (
            <p className="text-muted-foreground text-xs leading-relaxed">
              {t(
                'cases.detail.procedure.taskCompleteBeforeNextHint',
                'Mark this task as done before you can continue to the next step.',
              )}
            </p>
          ) : null}
          {canScheduleProcedureTask && onScheduleProcedureTask ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              className="gap-2"
              disabled={disabled}
              onClick={() => setScheduleOpen(true)}
            >
              <CalendarDays className="size-4 shrink-0" aria-hidden />
              {t('cases.detail.procedure.scheduleTask', 'Schedule')}
            </Button>
          ) : null}
        </div>
      ) : null}

      {block.kind === 'action' && block.actionVariant === 'other' ? (
        <p className="text-muted-foreground text-sm whitespace-pre-wrap leading-relaxed">
          {block.otherInstructions?.trim() || t('cases.detail.procedure.otherNoText', 'No instructions.')}
        </p>
      ) : null}

      {block.kind === 'condition' ? (
        <div className="space-y-2">
          {block.conditionMode ? (
            <Badge variant="secondary" className="inline-flex items-center gap-1.5 font-normal">
              {block.conditionMode === 'verification' ? (
                <CheckCheck className="size-3.5 shrink-0" aria-hidden />
              ) : null}
              {block.conditionMode === 'verification'
                ? t('playbooks.procedure.conditionVerification', 'Verification')
                : t('playbooks.procedure.conditionManual', 'Manual')}
            </Badge>
          ) : null}
          {block.conditionMode === 'verification' && block.verificationUserId ? (
            <div className="rounded-md border border-border/60 bg-muted/20 px-2.5 py-2">
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {t('playbooks.procedure.verificationAssignee', 'Verifier')}
              </div>
              <div className="mt-0.5 text-sm font-medium break-words">
                {verifierDisplayLabel || block.verificationUserId}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {block.kind === 'goto' && block.targetStepId ? (
        <p className="text-muted-foreground font-mono text-xs break-all">
          {t('playbooks.procedure.gotoTarget', 'Target step')}: {block.targetStepId}
        </p>
      ) : null}

      {block.kind === 'invoke_procedure' ? (
        <div className="space-y-3">
          <p className="text-muted-foreground text-xs leading-relaxed">
            {t(
              'cases.detail.procedure.invokeProcedureHint',
              'Choose a linked procedure from the list, or launch the suggested one.',
            )}
          </p>
          {!block.playbookSlugs.length ? (
            <p className="text-muted-foreground text-sm">
              {t('cases.detail.procedure.invokeProcedureEmpty', 'No procedures linked.')}
            </p>
          ) : invokeProcedureOptions.length ? (
            <div
              className="space-y-2"
              role="radiogroup"
              aria-label={t('cases.detail.procedure.invokeProcedurePickGroup', 'Procedure to launch')}
            >
              {invokeProcedureOptions.map((opt) => {
                const resolved = Boolean(opt.playbookId?.trim().length)
                const titleTrimmed = typeof opt.title === 'string' ? opt.title.trim() : ''
                const primaryLabel = resolved
                  ? titleTrimmed.length > 0
                    ? formatProcedurePlaybookLabel(titleTrimmed, opt.version, t)
                    : formatProcedurePlaybookLabel(
                        t('cases.detail.procedure.invokeProcedureUntitled', 'Untitled procedure'),
                        opt.version,
                        t,
                      )
                  : t(
                      'cases.detail.procedure.invokeProcedureNoActiveVersion',
                      'No active procedure version for this slug.',
                    )
                const selected = pickedInvokeSlug === opt.slug
                return (
                  <button
                    key={opt.slug}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={primaryLabel}
                    disabled={disabled || !resolved}
                    onClick={() => setPickedInvokeSlug(opt.slug)}
                    className={`flex w-full items-start gap-3 rounded-md border px-3 py-2.5 text-start transition-colors ${
                      selected
                        ? 'border-foreground/40 bg-muted/40'
                        : 'border-border/60 bg-muted/10 hover:bg-muted/25'
                    } ${!resolved ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    <span
                      className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/45 bg-background"
                      aria-hidden
                    >
                      {selected && resolved ? (
                        <span className="size-2 shrink-0 rounded-full bg-foreground" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-foreground">
                      {primaryLabel}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              {t('cases.detail.procedure.invokeProcedureEmpty', 'No procedures linked.')}
            </p>
          )}
          {onLaunchInvokeProcedure && block.playbookSlugs.length ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              className="gap-2"
              disabled={
                disabled ||
                !canLaunchInvokeProcedure ||
                !pickedInvokeSlug.trim().length ||
                !invokeProcedureOptions.some(
                  (o) => o.slug === pickedInvokeSlug && Boolean(o.playbookId?.trim().length),
                )
              }
              onClick={() => onLaunchInvokeProcedure(pickedInvokeSlug.trim())}
            >
              <PlayCircle className="size-4 shrink-0" aria-hidden />
              {t('cases.detail.procedure.launchInvokeProcedure', 'Launch procedure')}
            </Button>
          ) : null}
        </div>
      ) : null}

      {block.kind === 'end' ? (
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-foreground">
            {t('cases.detail.procedure.closingNoteLabel', 'Closing note (optional)')}
          </span>
          <textarea
            className={`${CRUD_FORM_TEXTAREA_CLASS} min-h-[4.5rem] w-full`}
            rows={3}
            value={closingNoteDraft}
            onChange={(e) => setClosingNoteDraft(e.target.value)}
            disabled={disabled}
            placeholder={t('cases.detail.procedure.closingNotePlaceholder', 'Optional note when completing…')}
          />
          <p className="text-muted-foreground text-xs leading-relaxed">
            {t(
              'cases.detail.procedure.closingNoteHint',
              'Completing this step closes the procedure and the case.',
            )}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        {showNextButton ? (
          <Button
            type="button"
            variant="default"
            size="sm"
            className="gap-1"
            disabled={disabled}
            onClick={() =>
              onNext!(
                block.kind === 'end'
                  ? { closingNote: closingNoteDraft.trim() || undefined }
                  : undefined,
              )
            }
          >
            <ChevronRight className="size-4 shrink-0" aria-hidden />
            {block.kind === 'end'
              ? t('cases.detail.procedure.completeProcedure', 'Complete procedure')
              : t('cases.detail.procedure.next', 'Next')}
          </Button>
        ) : null}
        {canAnswerYesNo && onAnswer ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={disabled}
              onClick={() => void confirmRejectNo()}
            >
              <X className="size-4 shrink-0" aria-hidden />
              {t('cases.detail.procedure.no', 'No')}
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              className="gap-2"
              disabled={disabled}
              onClick={() => onAnswer('yes')}
            >
              <Check className="size-4 shrink-0" aria-hidden />
              {t('cases.detail.procedure.yes', 'Yes')}
            </Button>
          </>
        ) : null}
      </div>
    </div>
    </>
  )
}
