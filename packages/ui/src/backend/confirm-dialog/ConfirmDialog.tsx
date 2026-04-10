"use client"

import * as React from "react"
import { useT } from "@open-mercato/shared/lib/i18n/context"
import { Button } from "@open-mercato/ui/primitives/button"
import { Loader2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../primitives/alert-dialog"

export type ConfirmDialogProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onConfirm: () => void | Promise<void>
  onCancel?: () => void
  title?: string
  text?: string
  confirmText?: string | false
  cancelText?: string | false
  variant?: "default" | "destructive"
  loading?: boolean
  trigger?: React.ReactNode
}

export function ConfirmDialog({
  open: controlledOpen,
  onOpenChange,
  onConfirm,
  onCancel,
  title,
  text,
  confirmText,
  cancelText,
  variant = "default",
  loading = false,
  trigger,
}: ConfirmDialogProps) {
  const t = useT()
  const [internalOpen, setInternalOpen] = React.useState(false)

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (isControlled) {
        onOpenChange?.(next)
      } else {
        setInternalOpen(next)
        if (!next) {
          onCancel?.()
        }
      }
    },
    [isControlled, onOpenChange, onCancel],
  )

  const resolvedTitle =
    title ?? t("ui.dialogs.confirm.defaultTitle", "Are you sure?")
  const resolvedConfirmText =
    confirmText === false
      ? false
      : confirmText ?? t("ui.dialogs.confirm.confirmText", "Confirm")
  const resolvedCancelText =
    cancelText === false
      ? false
      : cancelText ?? t("ui.dialogs.confirm.cancelText", "Cancel")

  const requestClose = React.useCallback(() => {
    if (!loading) {
      setOpen(false)
    }
  }, [loading, setOpen])

  const handleConfirm = React.useCallback(async () => {
    await onConfirm()
    if (!loading) {
      setOpen(false)
    }
  }, [loading, onConfirm, setOpen])

  React.useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !loading) {
        e.preventDefault()
        void handleConfirm()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, loading, handleConfirm])

  const handleCancel = () => {
    requestClose()
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (loading) return
        setOpen(next)
      }}
    >
      {trigger ? (
        <AlertDialogTrigger asChild className="inline-block">
          {trigger}
        </AlertDialogTrigger>
      ) : null}
      <AlertDialogContent
        onEscapeKeyDown={(e) => {
          if (loading) e.preventDefault()
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{resolvedTitle}</AlertDialogTitle>
          {text ? (
            <AlertDialogDescription>{text}</AlertDialogDescription>
          ) : (
            <AlertDialogDescription className="sr-only">
              {resolvedTitle}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          {resolvedCancelText !== false && (
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {resolvedCancelText}
            </Button>
          )}
          {resolvedConfirmText !== false && (
            <Button
              type="button"
              variant={variant === "destructive" ? "destructive" : "default"}
              onClick={() => void handleConfirm()}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {resolvedConfirmText}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
