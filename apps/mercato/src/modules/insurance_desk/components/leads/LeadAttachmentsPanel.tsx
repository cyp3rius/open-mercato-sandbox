"use client"

import * as React from 'react'
import { Upload, File, Trash2 } from 'lucide-react'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { INSURANCE_LEAD_ATTACHMENT_ENTITY_ID, INSURANCE_LEAD_ATTACHMENT_TAG } from '../../lib/insuranceDeskConstants'

type AttachmentItem = {
  id: string
  fileName: string
  url: string
  fileSize?: number
}

type Props = {
  leadId: string | null
  canUpload: boolean
  className?: string
  /** Hide heading/hint/border when nested in another card (e.g. detail section editor). */
  embedded?: boolean
}

export function LeadAttachmentsPanel({ leadId, canUpload, className, embedded = false }: Props) {
  const t = useT()
  const [items, setItems] = React.useState<AttachmentItem[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  const load = React.useCallback(async () => {
    if (!leadId) return
    setLoading(true)
    setError(null)
    try {
      const call = await apiCall<{ items?: AttachmentItem[]; error?: string }>(
        `/api/attachments?entityId=${encodeURIComponent(INSURANCE_LEAD_ATTACHMENT_ENTITY_ID)}&recordId=${encodeURIComponent(leadId)}`,
        undefined,
        { fallback: { items: [] } },
      )
      if (!call.ok) {
        throw new Error(call.result?.error || t('attachments.library.errors.load', 'Failed to load attachments.'))
      }
      setItems(Array.isArray(call.result?.items) ? call.result.items : [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [leadId, t])

  React.useEffect(() => {
    void load()
  }, [load])

  const onFiles = React.useCallback(
    async (files: FileList | null) => {
      if (!leadId || !canUpload || !files?.length) return
      setUploading(true)
      setError(null)
      try {
        for (const file of Array.from(files)) {
          const fd = new FormData()
          fd.set('entityId', INSURANCE_LEAD_ATTACHMENT_ENTITY_ID)
          fd.set('recordId', leadId)
          fd.set('file', file)
          fd.set('tags', JSON.stringify([INSURANCE_LEAD_ATTACHMENT_TAG.default]))
          const call = await apiCall<{ ok?: boolean; error?: string }>('/api/attachments', { method: 'POST', body: fd }, { fallback: null })
          if (!call.ok) {
            throw new Error(call.result?.error || t('attachments.library.upload.failed', 'Upload failed.'))
          }
        }
        await load()
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setUploading(false)
        if (inputRef.current) inputRef.current.value = ''
      }
    },
    [canUpload, leadId, load, t],
  )

  const onDelete = React.useCallback(
    async (id: string) => {
      const call = await apiCall(`/api/attachments?id=${encodeURIComponent(id)}`, { method: 'DELETE' }, { fallback: null })
      if (!call.ok) {
        setError(t('attachments.library.errors.delete', 'Failed to delete.'))
        return
      }
      await load()
    },
    [load, t],
  )

  if (!leadId) {
    return null
  }

  return (
    <div className={cn('space-y-2', !embedded && 'rounded-md border border-border bg-card px-3 py-3', className)}>
      {embedded ? null : (
        <>
          <div className="text-sm font-medium">{t('insurance_desk.leads.attachments.title', 'Files on this inquiry')}</div>
          <p className="text-xs text-muted-foreground">
            {t('insurance_desk.leads.attachments.hint', 'Files uploaded here are stored in the attachment library for this lead.')}
          </p>
        </>
      )}
      {canUpload ? (
        <>
          <input ref={inputRef} type="file" className="hidden" multiple onChange={(e) => onFiles(e.target.files)} />
          <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
            <Upload className="size-4 mr-1" />
            {uploading ? t('common.loading', 'Loading…') : t('insurance_desk.leads.attachments.upload', 'Upload')}
          </Button>
        </>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? <p className="text-xs text-muted-foreground">{t('common.loading', 'Loading…')}</p> : null}
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-sm">
            <div className="flex min-w-0 items-center gap-2">
              <File className="size-4 shrink-0 text-muted-foreground" />
              <a href={item.url} className="truncate font-medium text-primary hover:underline" target="_blank" rel="noreferrer">
                {item.fileName}
              </a>
            </div>
            {canUpload ? (
              <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => onDelete(item.id)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default LeadAttachmentsPanel
