'use client'

import * as React from 'react'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@open-mercato/ui/primitives/alert-dialog'
import { Button } from '@open-mercato/ui/primitives/button'
import { CRUD_FORM_TEXTAREA_CLASS } from '@open-mercato/ui/backend/CrudForm'
import { cn } from '@open-mercato/shared/lib/utils'

export type CaseInterruptOutcome = 'closed' | 'aborted'

export type CaseCloseDialogVariant = 'choice' | 'abortedOnly'

export type CaseInterruptCloseDialogProps = {
  open: boolean
  variant?: CaseCloseDialogVariant
  onOpenChange: (open: boolean) => void
  onConfirm: (outcome: CaseInterruptOutcome, closingNote: string) => void | Promise<void>
  loading?: boolean
}

export function CaseInterruptCloseDialog({
  open,
  variant = 'choice',
  onOpenChange,
  onConfirm,
  loading = false,
}: CaseInterruptCloseDialogProps) {
  const t = useT()
  const [outcome, setOutcome] = React.useState<CaseInterruptOutcome>('closed')
  const [note, setNote] = React.useState('')

  React.useEffect(() => {
    if (open) {
      setOutcome('closed')
      setNote('')
    }
  }, [open])

  const isAbortedOnly = variant === 'abortedOnly'

  return (
    <AlertDialog open={open} onOpenChange={(next) => !loading && onOpenChange(next)}>
      <AlertDialogContent
        className="max-w-lg"
        onEscapeKeyDown={(e) => {
          if (loading) e.preventDefault()
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isAbortedOnly
              ? t('cases.detail.abortedOnlyClose.title', 'Reject / discontinue case')
              : t('cases.detail.outcomeClose.title', 'Close case')}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left">
            {isAbortedOnly
              ? t(
                  'cases.detail.abortedOnlyClose.lead',
                  'There is no active procedure step. Closing from here sets the rejected status only. Completing through the procedure sets closed.',
                )
              : t(
                  'cases.detail.outcomeClose.leadInterrupt',
                  'A procedure step is in progress. Choose closed or rejected and optionally add a closing note.',
                )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isAbortedOnly ? null : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => setOutcome('closed')}
            className={cn(
              'flex flex-col items-start gap-2 rounded-lg border px-3 py-3 text-left transition-colors',
              outcome === 'closed'
                ? 'border-emerald-600/60 bg-emerald-600/10 ring-2 ring-emerald-600/30'
                : 'border-border bg-card hover:bg-muted/40',
            )}
          >
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              <CheckCircle2 className="size-5 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden />
              {t('cases.detail.interruptClose.optionClosed', 'Completed')}
            </span>
            <span className="text-xs text-muted-foreground leading-snug">
              {t('cases.detail.interruptClose.optionClosedHint', 'Normal closure — status “closed”.')}
            </span>
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => setOutcome('aborted')}
            className={cn(
              'flex flex-col items-start gap-2 rounded-lg border px-3 py-3 text-left transition-colors',
              outcome === 'aborted'
                ? 'border-red-600/60 bg-red-600/10 ring-2 ring-red-600/30'
                : 'border-border bg-card hover:bg-muted/40',
            )}
          >
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-red-950 dark:text-red-100">
              <XCircle className="size-5 shrink-0 text-red-700 dark:text-red-300" aria-hidden />
              {t('cases.detail.interruptClose.optionAborted', 'Rejected')}
            </span>
            <span className="text-xs text-muted-foreground leading-snug">
              {t('cases.detail.interruptClose.optionAbortedHint', 'Rejected / discontinued — status “aborted”.')}
            </span>
          </button>
        </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="case-interrupt-closing-note" className="text-xs font-medium text-foreground">
            {t('cases.detail.procedure.closingNoteLabel', 'Closing note')}
          </label>
          <textarea
            id="case-interrupt-closing-note"
            className={`${CRUD_FORM_TEXTAREA_CLASS} min-h-[4.5rem] w-full`}
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={loading}
            placeholder={t('cases.detail.interruptClose.notePlaceholder', 'Add a closing note…')}
          />
        </div>

        <AlertDialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>
            {t('ui.dialogs.confirm.cancelText', 'Cancel')}
          </Button>
          <Button
            type="button"
            variant={isAbortedOnly || outcome === 'aborted' ? 'destructive' : 'default'}
            disabled={loading}
            onClick={() =>
              void onConfirm(isAbortedOnly ? 'aborted' : outcome, note.trim())
            }
          >
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : null}
            {isAbortedOnly
              ? t('cases.detail.abortedOnlyClose.confirm', 'Reject case')
              : t('cases.detail.interruptClose.confirm', 'Close case')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
