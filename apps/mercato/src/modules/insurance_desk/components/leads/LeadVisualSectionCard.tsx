"use client"

import * as React from 'react'
import { Pencil, X, Check } from 'lucide-react'
import { Button } from '@open-mercato/ui/primitives/button'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'

export type LeadVisualSectionCardProps = {
  title: string
  description?: string
  preview: React.ReactNode
  editing: boolean
  onBeginEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: () => void | Promise<void>
  editContent: React.ReactNode
  saving?: boolean
  className?: string
  /** When true, section is display-only (no edit control). */
  readOnly?: boolean
}

export function LeadVisualSectionCard({
  title,
  description,
  preview,
  editing,
  onBeginEdit,
  onCancelEdit,
  onSaveEdit,
  editContent,
  saving = false,
  className,
  readOnly = false,
}: LeadVisualSectionCardProps) {
  const t = useT()
  return (
    <section className={cn('space-y-3 rounded-lg border bg-card px-4 py-3', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-semibold leading-tight">{title}</h3>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {!readOnly && !editing ? (
          <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={onBeginEdit} aria-label={t('insurance_desk.leads.detail.editSection', 'Edit section')}>
            <Pencil className="size-4" />
          </Button>
        ) : !readOnly && editing ? (
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onCancelEdit} disabled={saving}>
              <X className="mr-1 size-4" />
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="button" size="sm" onClick={() => void onSaveEdit()} disabled={saving}>
              <Check className="mr-1 size-4" />
              {t('common.save', 'Save')}
            </Button>
          </div>
        ) : null}
      </div>
      {readOnly || !editing ? (
        <div className="rounded-md border border-dashed bg-muted/20 px-3 py-3 text-sm">{preview}</div>
      ) : (
        <div className="pt-1">{editContent}</div>
      )}
    </section>
  )
}
