"use client"

import * as React from 'react'
import {
  Check,
  CheckCheck,
  CornerDownLeft,
  GitBranch,
  PlayCircle,
  Send,
  StopCircle,
  ChevronRight,
  X,
  Zap,
} from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { Button } from '@open-mercato/ui/primitives/button'
import { Badge } from '@open-mercato/ui/primitives/badge'
import { CRUD_FORM_TEXTAREA_CLASS } from '@open-mercato/ui/backend/CrudForm'
import { HtmlRichTextEditor } from '@open-mercato/ui/backend/richtext/HtmlRichTextEditor'
import type { CaseProcedureBlockJson } from '../lib/procedureBlockJson'
import { defaultHtmlFromNotifyBody, htmlToPlainText } from '../lib/htmlToPlainText'
import { resolveUserDisplayLabel } from '../../procurement/lib/procurementEntitySearch'

type Kind = CaseProcedureBlockJson['kind']

function blockKindIcon(kind: Kind) {
  if (kind === 'start') return PlayCircle
  if (kind === 'end') return StopCircle
  if (kind === 'action') return Zap
  if (kind === 'condition') return GitBranch
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
            : t('playbooks.procedure.kind.goto', 'Go to step')
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

export type CaseProcedureStepExecutorProps = {
  block: CaseProcedureBlockJson | null
  disabled?: boolean
  canNext?: boolean
  canSendNotify?: boolean
  canAnswerYesNo?: boolean
  onNext?: (options?: { closingNote?: string }) => void
  onSendNotify?: (plainBody: string) => void
  onAnswer?: (branch: 'yes' | 'no') => void
}

export function CaseProcedureStepExecutor({
  block,
  disabled = false,
  canNext = false,
  canSendNotify = false,
  canAnswerYesNo = false,
  onNext,
  onSendNotify,
  onAnswer,
}: CaseProcedureStepExecutorProps) {
  const t = useT()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [notifyHtml, setNotifyHtml] = React.useState('')
  const [verifierDisplayLabel, setVerifierDisplayLabel] = React.useState('')
  const [closingNoteDraft, setClosingNoteDraft] = React.useState('')

  React.useEffect(() => {
    setClosingNoteDraft('')
  }, [block?.id])

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
              : t('playbooks.procedure.kind.goto', 'Go to step')

  return (
    <>
      {ConfirmDialogElement}
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
        <p className="text-muted-foreground text-sm leading-relaxed">
          {block.taskTitle?.trim() || t('cases.detail.procedure.taskNoTitle', 'No task title.')}
        </p>
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
        {canNext && onNext ? (
          <Button
            type="button"
            variant="default"
            size="sm"
            className="gap-1"
            disabled={disabled}
            onClick={() =>
              onNext(
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
