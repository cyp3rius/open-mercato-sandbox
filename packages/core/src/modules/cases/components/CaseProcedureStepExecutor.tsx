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
  Search,
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
import {
  EntitySearchCombobox,
  type EntitySearchComboboxOption,
} from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import type { CaseProcedureBlockJson } from '../lib/procedureBlockJson'
import { formatProcedurePlaybookLabel } from '../lib/formatProcedurePlaybookLabel'
import { defaultHtmlFromNotifyBody } from '../lib/htmlToPlainText'
import { getProcedureEntityKindAdapter } from '../lib/procedureEntitySearch'
import type { ResourceProcedureSearchScope } from '../lib/caseRelationsSearch'
import {
  mergeEntitySearchOption,
  remoteSearchAuthUsers,
  resolveUserDisplayLabel,
} from '../../procurement/lib/procurementEntitySearch'

type Kind = CaseProcedureBlockJson['kind']

function blockKindIcon(kind: Kind) {
  if (kind === 'start') return PlayCircle
  if (kind === 'end') return StopCircle
  if (kind === 'action') return Zap
  if (kind === 'condition') return GitBranch
  if (kind === 'invoke_procedure') return Layers
  if (kind === 'select_entity') return Search
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
              : kind === 'select_entity'
                ? t('playbooks.procedure.kind.select_entity', 'Select entity')
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

export type CaseProcedureEntitySelectionHead = {
  entityKind: string
  entityId: string
  label?: string | null
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
  canAssignProcedureOwner?: boolean
  procedureTaskSummary?: ProcedureTaskSummaryHead | null
  canScheduleProcedureTask?: boolean
  canConfirmSelectEntity?: boolean
  entitySelection?: CaseProcedureEntitySelectionHead | null
  customerEntityId?: string | null
  onNext?: (options?: { closingNote?: string }) => void
  onSendNotify?: (bodyHtml: string) => void
  onAnswer?: (branch: 'yes' | 'no') => void
  onLaunchInvokeProcedure?: (slug: string, ownerUserId?: string) => void
  onScheduleProcedureTask?: (payload: {
    title: string
    body?: string
    dueAt?: string | null
  }) => boolean | Promise<boolean>
  onSelectEntity?: (payload: { entityId: string; label?: string | null }) => void
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
  canAssignProcedureOwner = false,
  procedureTaskSummary = null,
  canScheduleProcedureTask = false,
  canConfirmSelectEntity = false,
  entitySelection = null,
  customerEntityId = null,
  onNext,
  onSendNotify,
  onAnswer,
  onLaunchInvokeProcedure,
  onScheduleProcedureTask,
  onSelectEntity,
}: CaseProcedureStepExecutorProps) {
  const t = useT()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [notifyHtml, setNotifyHtml] = React.useState('')
  const [verifierDisplayLabel, setVerifierDisplayLabel] = React.useState('')
  const [closingNoteDraft, setClosingNoteDraft] = React.useState('')
  const [pickedInvokeSlug, setPickedInvokeSlug] = React.useState('')
  const [invokeOwnerUserId, setInvokeOwnerUserId] = React.useState('')
  const [scheduleOpen, setScheduleOpen] = React.useState(false)
  const [scheduleTitle, setScheduleTitle] = React.useState('')
  const [scheduleDueLocal, setScheduleDueLocal] = React.useState('')
  const [scheduleSaving, setScheduleSaving] = React.useState(false)
  const [selectEntityId, setSelectEntityId] = React.useState('')
  const [selectEntityLabel, setSelectEntityLabel] = React.useState('')
  const [selectEntityEditing, setSelectEntityEditing] = React.useState(true)
  const [resourceSearchScope, setResourceSearchScope] =
    React.useState<ResourceProcedureSearchScope>('customer')
  const selectEntityOptionsRef = React.useRef<EntitySearchComboboxOption[]>([])

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
    setInvokeOwnerUserId('')
  }, [block?.id, pickedInvokeSlug])

  React.useEffect(() => {
    if (block?.kind === 'action' && block.actionVariant === 'task') {
      setScheduleTitle(block.taskTitle?.trim() ?? '')
      setScheduleDueLocal('')
      setScheduleOpen(false)
    }
  }, [block?.id, block?.kind, block?.kind === 'action' ? block.actionVariant : undefined])

  React.useEffect(() => {
    if (block?.kind === 'action' && block.actionVariant === 'notify') {
      setNotifyHtml(defaultHtmlFromNotifyBody(block.notifyBody))
    } else {
      setNotifyHtml('')
    }
  }, [block])

  React.useEffect(() => {
    if (block?.kind !== 'select_entity') {
      setSelectEntityId('')
      setSelectEntityLabel('')
      setSelectEntityEditing(true)
      selectEntityOptionsRef.current = []
      setResourceSearchScope('customer')
      return
    }
    const savedId = entitySelection?.entityId?.trim() ?? ''
    const savedLabel = entitySelection?.label?.trim() ?? ''
    if (savedId.length) {
      setSelectEntityId(savedId)
      setSelectEntityLabel(savedLabel.length ? savedLabel : savedId)
      setSelectEntityEditing(false)
    } else {
      setSelectEntityId('')
      setSelectEntityLabel('')
      setSelectEntityEditing(true)
    }
    selectEntityOptionsRef.current = []
    setResourceSearchScope('customer')
  }, [block?.id, block?.kind, entitySelection?.entityId, entitySelection?.label])

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
                : block.kind === 'select_entity'
                  ? t('playbooks.procedure.kind.select_entity', 'Select entity')
                  : t('playbooks.procedure.kind.invoke_procedure', 'Procedure')

  const onPlaybookTaskStep = block.kind === 'action' && block.actionVariant === 'task'
  const showSchedulePlaybookTask =
    onPlaybookTaskStep && Boolean(canScheduleProcedureTask && onScheduleProcedureTask)
  const showCompleteTaskWithoutSchedule = Boolean(
    showSchedulePlaybookTask && canNext && onNext,
  )
  const showNextButton = Boolean(canNext && onNext && !showSchedulePlaybookTask)
  const selectEntityAdapter =
    block.kind === 'select_entity' ? getProcedureEntityKindAdapter(block.entityKind) : null
  const selectEntityKindLabel =
    block.kind === 'select_entity'
      ? t(`playbooks.procedure.entityKind.${block.entityKind}`, block.entityKind)
      : ''
  const caseHasCustomer = Boolean(customerEntityId?.trim().length)
  const showResourceScopeToggle =
    block.kind === 'select_entity' &&
    block.entityKind === 'resource' &&
    caseHasCustomer &&
    selectEntityEditing
  const showSelectEntityConfirm = Boolean(
    block.kind === 'select_entity' &&
      canConfirmSelectEntity &&
      onSelectEntity &&
      selectEntityId.trim().length,
  )

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
                  : block.notifyChannel === 'message'
                    ? t('playbooks.procedure.channelMessage', 'Message')
                    : block.notifyChannel === 'in_app'
                      ? t('playbooks.procedure.channelInApp', 'In-app notification')
                      : '—'}
              </div>
            </div>
            {block.notifyChannel !== 'in_app' ? (
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
            ) : null}
          </div>
          {block.notifyChannel !== 'in_app' ? (
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
          ) : (
            <p className="text-muted-foreground text-sm leading-relaxed">
              {t(
                'cases.detail.procedure.notifyInAppHint',
                'This step sends an in-app notification to the procedure owner.',
              )}
            </p>
          )}
          {canSendNotify && onSendNotify ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="default"
                className="gap-2 bg-foreground text-background hover:bg-foreground/90"
                disabled={disabled}
                onClick={() =>
                  onSendNotify(
                    block.notifyChannel === 'in_app'
                      ? `<p>${t('cases.detail.procedure.notifyInAppDefaultBody', 'Procedure notification')}</p>`
                      : notifyHtml,
                  )
                }
              >
                <Send className="size-4 shrink-0" aria-hidden />
                {block.notifyChannel === 'in_app'
                  ? t('cases.detail.procedure.sendInApp', 'Send notification')
                  : t('cases.detail.procedure.sendMessage', 'Send')}
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
          {showSchedulePlaybookTask ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs leading-relaxed">
                {t(
                  'cases.detail.procedure.taskScheduleOrCompleteHint',
                  'Schedule a task for later, or mark done if you already completed the work.',
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                {onScheduleProcedureTask ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={disabled}
                    onClick={() => setScheduleOpen(true)}
                  >
                    <CalendarDays className="size-4 shrink-0" aria-hidden />
                    {t('cases.detail.procedure.scheduleTask', 'Schedule')}
                  </Button>
                ) : null}
                {showCompleteTaskWithoutSchedule ? (
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="gap-2"
                    disabled={disabled}
                    onClick={() => onNext!()}
                  >
                    <Check className="size-4 shrink-0" aria-hidden />
                    {t('cases.detail.procedure.taskCompleteWithoutSchedule', 'Done')}
                  </Button>
                ) : null}
              </div>
            </div>
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
                  <Button
                    key={opt.slug}
                    type="button"
                    variant="outline"
                    role="radio"
                    aria-checked={selected}
                    aria-label={primaryLabel}
                    disabled={disabled || !resolved}
                    onClick={() => setPickedInvokeSlug(opt.slug)}
                    className={`h-auto w-full justify-start whitespace-normal px-3 py-2.5 text-start ${
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
                  </Button>
                )
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              {t('cases.detail.procedure.invokeProcedureEmpty', 'No procedures linked.')}
            </p>
          )}
          {canAssignProcedureOwner && onLaunchInvokeProcedure && block.playbookSlugs.length ? (
            <div className="space-y-1.5">
              <Label>
                {t('cases.detail.procedure.invokeOwner', 'Procedure owner (optional)')}
              </Label>
              <EntitySearchCombobox
                value={invokeOwnerUserId}
                onChange={setInvokeOwnerUserId}
                options={mergeEntitySearchOption(
                  [],
                  invokeOwnerUserId,
                  invokeOwnerUserId,
                )}
                onRemoteSearch={async (query) => {
                  const rows = await remoteSearchAuthUsers(query)
                  return mergeEntitySearchOption(rows, invokeOwnerUserId, invokeOwnerUserId)
                }}
                placeholder={t(
                  'cases.detail.procedure.invokeOwnerPlaceholder',
                  'Use recommended owner…',
                )}
                searchPlaceholder={t(
                  'cases.detail.procedure.invokeOwnerSearch',
                  'Search users…',
                )}
                disabled={disabled || !canLaunchInvokeProcedure}
                createInNewTabHref="/backend/users/create"
                createInNewTabAriaLabel={t(
                  'cases.detail.procedure.invokeOwnerAddUser',
                  'Create user in a new tab',
                )}
              />
              <p className="text-xs text-muted-foreground">
                {t(
                  'cases.detail.procedure.invokeOwnerHint',
                  'Leave empty to use the first recommended owner or inherit the current owner.',
                )}
              </p>
            </div>
          ) : null}
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
              onClick={() =>
                onLaunchInvokeProcedure(
                  pickedInvokeSlug.trim(),
                  invokeOwnerUserId.trim() || undefined,
                )
              }
            >
              <PlayCircle className="size-4 shrink-0" aria-hidden />
              {t('cases.detail.procedure.launchInvokeProcedure', 'Launch procedure')}
            </Button>
          ) : null}
        </div>
      ) : null}

      {block.kind === 'select_entity' && selectEntityAdapter ? (
        <div className="space-y-3">
          <div className="rounded-md border border-border/60 bg-muted/20 px-2.5 py-2">
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t('playbooks.procedure.entityKindLabel', 'Entity')}
            </div>
            <div className="mt-0.5 text-sm font-medium">{selectEntityKindLabel}</div>
          </div>
          {!selectEntityEditing && selectEntityId.trim().length ? (
            <div className="rounded-md border border-border/60 bg-muted/15 px-3 py-2.5 space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('cases.detail.procedure.selectEntitySaved', 'Selected')}
              </div>
              <div className="text-sm font-semibold leading-snug break-words">
                {selectEntityLabel.trim() || selectEntityId}
              </div>
              {canConfirmSelectEntity ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() => setSelectEntityEditing(true)}
                >
                  {t('cases.detail.procedure.selectEntityChange', 'Change')}
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>
                {t('cases.detail.procedure.selectEntityPicker', 'Search and select')}
              </Label>
              {showResourceScopeToggle ? (
                <div
                  className="inline-flex rounded-md border border-border bg-background p-0.5"
                  role="group"
                  aria-label={t(
                    'cases.detail.procedure.resourceScopeGroup',
                    'Resource list scope',
                  )}
                >
                  <Button
                    type="button"
                    variant={resourceSearchScope === 'customer' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 rounded-sm px-2.5 text-xs"
                    disabled={disabled || !canConfirmSelectEntity}
                    onClick={() => {
                      if (resourceSearchScope === 'customer') return
                      setResourceSearchScope('customer')
                      selectEntityOptionsRef.current = []
                      setSelectEntityId('')
                      setSelectEntityLabel('')
                    }}
                  >
                    {t('cases.detail.procedure.resourceScopeCustomer', 'Customer resources')}
                  </Button>
                  <Button
                    type="button"
                    variant={resourceSearchScope === 'all' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 rounded-sm px-2.5 text-xs"
                    disabled={disabled || !canConfirmSelectEntity}
                    onClick={() => {
                      if (resourceSearchScope === 'all') return
                      setResourceSearchScope('all')
                      selectEntityOptionsRef.current = []
                      setSelectEntityId('')
                      setSelectEntityLabel('')
                    }}
                  >
                    {t('cases.detail.procedure.resourceScopeAll', 'All resources')}
                  </Button>
                </div>
              ) : null}
              <EntitySearchCombobox
                key={
                  showResourceScopeToggle
                    ? `resource-scope-${resourceSearchScope}`
                    : 'select-entity'
                }
                value={selectEntityId}
                onChange={(next) => {
                  const id = next.trim()
                  setSelectEntityId(id)
                  const match = selectEntityOptionsRef.current.find((row) => row.value === id)
                  setSelectEntityLabel(match?.label?.trim() || id)
                }}
                options={mergeEntitySearchOption(
                  selectEntityOptionsRef.current,
                  selectEntityId,
                  selectEntityLabel || selectEntityId,
                )}
                onRemoteSearch={async (query) => {
                  const rows = await selectEntityAdapter.onRemoteSearch(query, {
                    customerEntityId,
                    ...(block.kind === 'select_entity' && block.entityKind === 'resource'
                      ? {
                          resourceScope: caseHasCustomer ? resourceSearchScope : 'all',
                        }
                      : {}),
                  })
                  selectEntityOptionsRef.current = rows
                  return mergeEntitySearchOption(rows, selectEntityId, selectEntityLabel || selectEntityId)
                }}
                placeholder={t('cases.detail.procedure.selectEntityPlaceholder', 'Search…')}
                searchPlaceholder={t('cases.detail.procedure.selectEntitySearch', 'Search…')}
                disabled={disabled || !canConfirmSelectEntity}
                createInNewTabHref={
                  block.allowCreate !== false ? selectEntityAdapter.createInNewTabHref : null
                }
                createInNewTabChoices={
                  block.allowCreate !== false && selectEntityAdapter.createInNewTabChoices?.length
                    ? selectEntityAdapter.createInNewTabChoices.map((choice) => ({
                        href: choice.href,
                        label: t(choice.labelKey, choice.labelFallback),
                      }))
                    : null
                }
                createInNewTabAriaLabel={t(
                  'cases.detail.procedure.selectEntityCreate',
                  'Create in a new tab',
                )}
                selectedDisplayOverride={selectEntityLabel || undefined}
              />
              {block.required !== false ? (
                <p className="text-xs text-muted-foreground">
                  {t(
                    'cases.detail.procedure.selectEntityRequiredHint',
                    'Select a record and confirm to continue.',
                  )}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t(
                    'cases.detail.procedure.selectEntityOptionalHint',
                    'Optional — confirm a selection or skip with Next.',
                  )}
                </p>
              )}
            </div>
          )}
          {showSelectEntityConfirm ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              className="gap-2"
              disabled={disabled || !selectEntityId.trim().length}
              onClick={() =>
                onSelectEntity!({
                  entityId: selectEntityId.trim(),
                  label: selectEntityLabel.trim() || null,
                })
              }
            >
              <Check className="size-4 shrink-0" aria-hidden />
              {t('cases.detail.procedure.selectEntityConfirm', 'Confirm selection')}
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
