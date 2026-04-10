"use client"

import * as React from 'react'
import { File } from 'lucide-react'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { formatAttachmentFileSize } from '@open-mercato/ui/backend/detail'
import { cn } from '@open-mercato/shared/lib/utils'

type Item = {
  id: string
  fileName: string
  url: string
  fileSize?: number
}

type Props = {
  entityId: string
  recordId: string | null
  className?: string
}

/**
 * Read-only list using Item-style layout (title + description + media) aligned with shadcn Item composition.
 */
export function AttachmentItemsPreview({ entityId, recordId, className }: Props) {
  const t = useT()
  const [items, setItems] = React.useState<Item[]>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!recordId) {
      setItems([])
      return
    }
    const resolvedRecordId = recordId
    let cancelled = false
    async function load() {
      setLoading(true)
      const call = await apiCall<{ items?: Item[] }>(
        `/api/attachments?entityId=${encodeURIComponent(entityId)}&recordId=${encodeURIComponent(resolvedRecordId)}`,
        undefined,
        { fallback: { items: [] } },
      )
      if (cancelled) return
      setItems(Array.isArray(call.result?.items) ? call.result.items : [])
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [entityId, recordId])

  if (!recordId) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('attachments.library.upload.saveFirst', 'Save the record before uploading files.')}
      </p>
    )
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading…')}</p>
  }

  if (!items.length) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('attachments.library.table.empty', 'No attachments found.')}
      </p>
    )
  }

  return (
    <ul className={cn('flex flex-col gap-2', className)}>
      {items.map((item) => (
        <li
          key={item.id}
          className="flex gap-3 rounded-lg border border-border/80 bg-card p-3 text-left shadow-sm"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted/40">
            <File className="size-5 text-muted-foreground" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="text-sm font-medium leading-snug text-foreground">
              <a href={item.url} className="hover:underline" target="_blank" rel="noreferrer">
                {item.fileName}
              </a>
            </div>
            <div className="text-xs text-muted-foreground">
              {typeof item.fileSize === 'number' ? formatAttachmentFileSize(item.fileSize) : '—'}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
