"use client"

import * as React from 'react'
import { Upload } from 'lucide-react'
import { Button } from '../../primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { AttachmentItemsGrid } from './AttachmentItemsGrid'
import type { AttachmentItem } from './AttachmentMetadataDialog'
import { ComponentReplacementHandles } from '@open-mercato/shared/modules/widgets/component-registry'
import { useRegisteredComponent } from '../injection/useRegisteredComponent'

type AttachmentsResponse = {
  items?: AttachmentItem[]
  error?: string
}

type Props = {
  entityId: string
  recordId: string | null
  title?: string
  description?: string
  className?: string
  showHeader?: boolean
  compact?: boolean
  onChanged?: () => void
}

function AttachmentsSectionImpl({
  entityId,
  recordId,
  title,
  description,
  className,
  showHeader = true,
  compact = false,
  onChanged,
}: Props) {
  const t = useT()
  const [items, setItems] = React.useState<AttachmentItem[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isUploading, setIsUploading] = React.useState(false)
  const [isDragOver, setIsDragOver] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  const load = React.useCallback(async () => {
    if (!recordId) return
    setLoading(true)
    setError(null)
    try {
      const call = await apiCall<AttachmentsResponse>(
        `/api/attachments?entityId=${encodeURIComponent(entityId)}&recordId=${encodeURIComponent(recordId)}`,
        undefined,
        { fallback: { items: [] } },
      )
      if (!call.ok) {
        const message = call.result?.error || t('attachments.library.errors.load', 'Failed to load attachments.')
        throw new Error(message)
      }
      const payload = call.result ?? { items: [] }
      setItems(Array.isArray(payload.items) ? payload.items : [])
    } catch (err: any) {
      setError(err?.message || t('attachments.library.errors.load', 'Failed to load attachments.'))
    } finally {
      setLoading(false)
    }
  }, [entityId, recordId, t])

  React.useEffect(() => {
    if (recordId) {
      void load()
    } else {
      setItems([])
      setError(null)
    }
  }, [load, recordId])

  const acceptFiles = React.useCallback(
    async (files: FileList | null) => {
      if (!files || !files.length || !recordId) return
      setError(null)
      setIsUploading(true)
      try {
        for (const file of Array.from(files)) {
          const fd = new FormData()
          fd.set('entityId', entityId)
          fd.set('recordId', recordId)
          fd.set('file', file)
          const call = await apiCall<{ ok?: boolean; item?: AttachmentItem; error?: string }>(
            '/api/attachments',
            { method: 'POST', body: fd },
            { fallback: null },
          )
          if (!call.ok) {
            const message = call.result?.error || t('attachments.library.upload.failed', 'Upload failed.')
            throw new Error(message)
          }
        }
        await load()
        onChanged?.()
      } catch (err: any) {
        setError(err?.message || t('attachments.library.upload.failed', 'Upload failed.'))
      } finally {
        setIsUploading(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    },
    [entityId, load, onChanged, recordId, t],
  )

  const handleDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.stopPropagation()
      setIsDragOver(false)
      void acceptFiles(event.dataTransfer?.files ?? null)
    },
    [acceptFiles],
  )

  const handleDragOver = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(false)
  }, [])

  const sectionTitle = title ?? t('attachments.library.title', 'Attachments')
  const sectionDescription =
    description ?? t('attachments.library.description', 'Browse, tag, and manage every file stored in this workspace.')

  return (
    <div className={cn('space-y-4', className)}>
      {showHeader ? (
        <div className="space-y-1">
          <div className="text-base font-medium">{sectionTitle}</div>
          <div className="text-sm text-muted-foreground">{sectionDescription}</div>
        </div>
      ) : null}

      {!recordId ? (
        <div className="rounded-md border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
          {t('attachments.library.upload.saveFirst', 'Save the record before uploading files.')}
        </div>
      ) : (
        <div
          className={cn(
            'flex flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center transition-colors',
            isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/30',
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          role="presentation"
        >
          <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            {t('attachments.library.upload.dropHint', 'Drag and drop files here or click to upload.')}
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
            {isUploading ? t('attachments.library.upload.submitting', 'Uploading…') : t('attachments.library.upload.choose', 'Choose files')}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => void acceptFiles(event.target.files)}
          />
        </div>
      )}

      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}

      {loading ? (
        <div className="text-sm text-muted-foreground">{t('attachments.library.loading', 'Loading attachments…')}</div>
      ) : items.length ? (
        <AttachmentItemsGrid
          items={items}
          compact={compact}
          onManagedChange={() => {
            void load()
            onChanged?.()
          }}
        />
      ) : (
        <div className="text-sm text-muted-foreground">
          {t('attachments.library.table.empty', 'No attachments found.')}
        </div>
      )}
    </div>
  )
}

export function AttachmentsSection(props: Props) {
  const handle = ComponentReplacementHandles.section('ui.detail', 'AttachmentsSection')
  const Resolved = useRegisteredComponent<Props>(
    handle,
    AttachmentsSectionImpl as React.ComponentType<Props>,
  )

  return (
    <div data-component-handle={handle}>
      <Resolved {...props} />
    </div>
  )
}
