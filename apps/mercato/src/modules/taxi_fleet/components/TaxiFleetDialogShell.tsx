"use client"

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@open-mercato/ui/primitives/dialog'
import { cn } from '@open-mercato/shared/lib/utils'

export type TaxiFleetDialogSize = 'md' | 'lg' | '2xl'

const dialogSizeClass: Record<TaxiFleetDialogSize, string> = {
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  '2xl': 'sm:max-w-2xl',
}

export const taxiFleetDialogContentClass = (size: TaxiFleetDialogSize = 'lg') =>
  cn('flex max-h-[min(90vh,48rem)] flex-col gap-0 overflow-hidden p-0', dialogSizeClass[size])

export const taxiFleetDialogHeaderClass = 'shrink-0 border-b border-border/70 px-6 pt-6 pb-4'

export const taxiFleetDialogCrudFormLayoutClass =
  // Flex chain: optional shell wrappers → CrudForm root → DataLoader → form (grid scrolls, footer pinned).
  '[&>div]:flex [&>div]:min-h-0 [&>div]:flex-1 [&>div]:flex-col ' +
  '[&>div>div]:flex [&>div>div]:min-h-0 [&>div>div]:flex-1 [&>div>div]:flex-col ' +
  '[&>div>div>div]:flex [&>div>div>div]:min-h-0 [&>div>div>div]:flex-1 [&>div>div>div]:flex-col ' +
  '[&_form]:flex [&_form]:min-h-0 [&_form]:flex-1 [&_form]:flex-col ' +
  '[&_form>.grid]:min-h-0 [&_form>.grid]:flex-1 [&_form>.grid]:overflow-y-auto [&_form>.grid]:overscroll-contain [&_form>.grid]:pb-2 ' +
  '[&_form>div:last-child]:relative! [&_form>div:last-child]:mt-auto [&_form>div:last-child]:-mx-6 [&_form>div:last-child]:overflow-visible [&_form>div:last-child]:border-t [&_form>div:last-child]:border-border/60 [&_form>div:last-child]:bg-background [&_form>div:last-child]:px-6 [&_form>div:last-child]:py-4'

export const taxiFleetDialogCrudBodyClass = cn(
  'flex min-h-0 flex-1 flex-col overflow-hidden px-6 pt-4',
  taxiFleetDialogCrudFormLayoutClass,
  '[&_.grid]:grid-cols-1!',
)

/** Tabbed trip/allocation dialogs — single column, no group cards, fields keep responsive half-width grid. */
export const taxiFleetDialogCrudTabbedBodyClass = cn(
  taxiFleetDialogCrudBodyClass,
  '[&_[data-crud-group-id]]:rounded-none [&_[data-crud-group-id]]:border-0 [&_[data-crud-group-id]]:bg-transparent [&_[data-crud-group-id]]:p-0 [&_[data-crud-group-id]]:shadow-none',
)

/** Wider trip/allocation dialogs — keeps responsive CrudForm field grid (e.g. half-width date fields). */
export const taxiFleetDialogCrudWideBodyClass = cn(
  'flex min-h-0 flex-1 flex-col overflow-hidden px-6 pt-4',
  taxiFleetDialogCrudFormLayoutClass,
)

export const taxiFleetDialogScrollBodyClass = 'min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pt-4 pb-2'

export const taxiFleetDialogFooterClass =
  'flex shrink-0 justify-end gap-2 border-t border-border/60 bg-background px-6 py-4'

type TaxiFleetDialogFrameProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  size?: TaxiFleetDialogSize
  contentRef?: React.Ref<HTMLDivElement>
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>
  /** Rendered below the title inside the dialog header (e.g. tab navigation). */
  headerBelow?: React.ReactNode
  children: React.ReactNode
}

export function TaxiFleetDialogFrame({
  open,
  onOpenChange,
  title,
  size = 'lg',
  contentRef,
  onKeyDown,
  headerBelow,
  children,
}: TaxiFleetDialogFrameProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={contentRef}
        className={cn(taxiFleetDialogContentClass(size), '!overflow-hidden')}
        onKeyDown={onKeyDown}
        onInteractOutside={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className={taxiFleetDialogHeaderClass}>
          <DialogTitle>{title}</DialogTitle>
          {headerBelow ? <div className="pt-3">{headerBelow}</div> : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

type TaxiFleetDialogFormProps = {
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  body: React.ReactNode
  footer: React.ReactNode
}

export function TaxiFleetDialogForm({ onSubmit, body, footer }: TaxiFleetDialogFormProps) {
  return (
    <form className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={onSubmit}>
      <div className={taxiFleetDialogScrollBodyClass}>{body}</div>
      <div className={taxiFleetDialogFooterClass}>{footer}</div>
    </form>
  )
}

export function useTaxiFleetDialogShortcuts({
  contentRef,
  onCancel,
  canSubmit = true,
}: {
  contentRef: React.RefObject<HTMLDivElement | null>
  onCancel: () => void
  canSubmit?: boolean
}) {
  return React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        if (!canSubmit) return
        event.preventDefault()
        const form = contentRef.current?.querySelector('form')
        form?.requestSubmit()
      }
    },
    [canSubmit, contentRef, onCancel],
  )
}
