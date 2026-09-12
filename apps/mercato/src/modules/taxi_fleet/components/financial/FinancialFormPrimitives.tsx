"use client"

import * as React from 'react'
import { Upload, X } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { CRUD_FORM_SELECT_CLASS, CRUD_FORM_TEXT_INPUT_CLASS, CRUD_FORM_TEXTAREA_CLASS } from '@open-mercato/ui/backend/CrudForm'
import { MoneyInputField } from '@open-mercato/ui/backend/inputs/MoneyInputField'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { Button } from '@open-mercato/ui/primitives/button'
import { Label } from '@open-mercato/ui/primitives/label'

import { TAXI_FLEET_FINANCIAL_ENTRY_ENTITY_ID } from '../../lib/financialEntryEntity'

export { TAXI_FLEET_FINANCIAL_ENTRY_ENTITY_ID }

type FormFieldLabelProps = {
  label: string
  required?: boolean
  htmlFor?: string
}

export function FormFieldLabel({ label, required, htmlFor }: FormFieldLabelProps) {
  return (
    <Label htmlFor={htmlFor} className="block text-sm font-medium">
      {label}
      {required ? <span className="text-red-600"> *</span> : null}
    </Label>
  )
}

export { MoneyInputField }

type DateInputFieldProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function DateInputField({ id, value, onChange, disabled }: DateInputFieldProps) {
  return (
    <input
      id={id}
      type="date"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      className={CRUD_FORM_TEXT_INPUT_CLASS}
    />
  )
}

type NotesInputFieldProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function NotesInputField({ id, value, onChange, disabled }: NotesInputFieldProps) {
  return (
    <textarea
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      rows={3}
      className={CRUD_FORM_TEXTAREA_CLASS}
    />
  )
}

type SelectInputFieldProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  children: React.ReactNode
}

export function SelectInputField({ id, value, onChange, disabled, children }: SelectInputFieldProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      className={CRUD_FORM_SELECT_CLASS}
    >
      {children}
    </select>
  )
}

type FinancialAttachmentFieldProps = {
  attachmentId: string | null
  recordId: string
  onChange: (attachmentId: string | null) => void
  disabled?: boolean
}

type AttachmentUploadResponse = {
  item?: { id?: string; fileName?: string }
  error?: string
}

type AttachmentListResponse = {
  items?: Array<{ id: string; fileName: string }>
}

export function FinancialAttachmentField({
  attachmentId,
  recordId,
  onChange,
  disabled,
}: FinancialAttachmentFieldProps) {
  const t = useT()
  const fileRef = React.useRef<HTMLInputElement | null>(null)
  const [fileName, setFileName] = React.useState<string | null>(null)
  const [uploading, setUploading] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      if (!attachmentId) {
        setFileName(null)
        return
      }
      const call = await apiCall<AttachmentListResponse>(
        `/api/attachments?entityId=${encodeURIComponent(TAXI_FLEET_FINANCIAL_ENTRY_ENTITY_ID)}&recordId=${encodeURIComponent(recordId)}`,
        undefined,
        { fallback: { items: [] } },
      )
      if (cancelled) return
      const match = (call.result?.items ?? []).find((item) => item.id === attachmentId)
      setFileName(match?.fileName ?? t('taxi_fleet.financial.attachmentUploaded', 'File attached'))
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [attachmentId, recordId, t])

  const handleUpload = React.useCallback(
    async (file: File) => {
      setUploading(true)
      try {
        const form = new FormData()
        form.set('entityId', TAXI_FLEET_FINANCIAL_ENTRY_ENTITY_ID)
        form.set('recordId', recordId)
        form.set('file', file)
        const call = await apiCall<AttachmentUploadResponse>(
          '/api/attachments',
          { method: 'POST', body: form },
          { fallback: null },
        )
        if (!call.ok) {
          throw new Error(call.result?.error ?? t('taxi_fleet.financial.attachmentError', 'Could not upload attachment.'))
        }
        const newId = typeof call.result?.item?.id === 'string' ? call.result.item.id : ''
        if (!newId) throw new Error(t('taxi_fleet.financial.attachmentError', 'Could not upload attachment.'))
        onChange(newId)
        setFileName(call.result?.item?.fileName ?? file.name)
      } finally {
        setUploading(false)
      }
    },
    [onChange, recordId, t],
  )

  return (
    <div className="space-y-2">
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept="image/*,.pdf"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void handleUpload(file)
        }}
      />
      {attachmentId && fileName ? (
        <div className="flex items-center justify-between gap-2 rounded border px-3 py-2 text-sm">
          <span className="truncate">{fileName}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || uploading}
            onClick={() => {
              onChange(null)
              setFileName(null)
            }}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="inline-flex items-center gap-2"
          disabled={disabled || uploading}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="size-4 shrink-0" aria-hidden />
          {uploading
            ? t('taxi_fleet.financial.attachmentUploading', 'Uploading…')
            : t('taxi_fleet.financial.attachmentAdd', 'Add attachment')}
        </Button>
      )}
    </div>
  )
}
