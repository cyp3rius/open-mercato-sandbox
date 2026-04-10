"use client"

import * as React from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '../../primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { AttachmentVisualPreview, formatAttachmentFileSize } from './AttachmentVisualPreview'
import { AttachmentDeleteDialog } from './AttachmentDeleteDialog'
import {
  AttachmentMetadataDialog,
  type AttachmentItem,
  type AttachmentMetadataSavePayload,
} from './AttachmentMetadataDialog'

export type AttachmentItemsGridProps = {
  items: AttachmentItem[]
  compact?: boolean
  className?: string
  /** Overrides default grid column classes (e.g. tighter layout inside list cards). */
  gridClassName?: string
  /**
   * When true (default), same as {@link AttachmentsSection}: click opens metadata, trash on hover, dialogs wired.
   * When false, each tile is a link to the file (new tab); no delete/metadata.
   */
  allowManage?: boolean
  onManagedChange?: () => void
}

function attachmentFileHref(item: AttachmentItem): string {
  if (item.url && item.url.trim().length > 0) return item.url
  return `/api/attachments/file/${encodeURIComponent(item.id)}`
}

export function AttachmentItemsGrid({
  items,
  compact = false,
  className,
  gridClassName,
  allowManage = true,
  onManagedChange,
}: AttachmentItemsGridProps) {
  const t = useT()
  const [metadataOpen, setMetadataOpen] = React.useState(false)
  const [selectedItem, setSelectedItem] = React.useState<AttachmentItem | null>(null)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<AttachmentItem | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setError(null)
  }, [items])

  const openMetadataDialog = React.useCallback((item: AttachmentItem) => {
    setSelectedItem(item)
    setMetadataOpen(true)
  }, [])

  const openDeleteDialog = React.useCallback((item: AttachmentItem) => {
    setDeleteTarget(item)
    setDeleteOpen(true)
  }, [])

  const handleDelete = React.useCallback(async () => {
    if (!deleteTarget) return
    try {
      setError(null)
      const call = await apiCall<{ error?: string }>(
        `/api/attachments?id=${encodeURIComponent(deleteTarget.id)}`,
        { method: 'DELETE' },
      )
      if (!call.ok) {
        const message = call.result?.error || t('attachments.library.errors.delete', 'Failed to delete attachment.')
        throw new Error(message)
      }
      setDeleteOpen(false)
      setDeleteTarget(null)
      onManagedChange?.()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('attachments.library.errors.delete', 'Failed to delete attachment.'))
    }
  }, [deleteTarget, onManagedChange, t])

  const handleMetadataSave = React.useCallback(
    async (id: string, payload: AttachmentMetadataSavePayload) => {
      const body: Record<string, unknown> = {
        tags: payload.tags,
        assignments: payload.assignments,
      }
      if (payload.customFields && Object.keys(payload.customFields).length) {
        body.customFields = payload.customFields
      }
      setError(null)
      const call = await apiCall<{ error?: string }>(`/api/attachments/library/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!call.ok) {
        const message = call.result?.error || t('attachments.library.metadata.error', 'Failed to update metadata.')
        throw new Error(message)
      }
      setMetadataOpen(false)
      onManagedChange?.()
    },
    [onManagedChange, t],
  )

  if (!items.length) return null

  const defaultGrid = compact ? 'grid-cols-3 sm:grid-cols-6 lg:grid-cols-12' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'

  const cardRounding = compact ? 'rounded-md' : 'rounded-lg'

  return (
    <div className={cn('space-y-2', className)}>
      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
      <div className={cn(compact ? 'grid gap-2' : 'grid gap-3', gridClassName ?? defaultGrid)}>
        {items.map((item) => {
          const inner = (
            <>
              <AttachmentVisualPreview
                fileName={item.fileName}
                mimeType={item.mimeType}
                thumbnailUrl={item.thumbnailUrl}
                className={
                  compact
                    ? 'h-14 max-h-14 w-full shrink-0'
                    : 'aspect-[4/3]'
                }
                iconClassName={compact ? 'mb-0.5 h-4 w-4' : undefined}
                labelClassName={compact ? 'text-[8px] font-semibold leading-none' : undefined}
                overlay={
                  allowManage ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'absolute opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100',
                        compact ? 'right-0.5 top-0.5 h-6 w-6' : 'right-2 top-2',
                      )}
                      onClick={(event) => {
                        event.stopPropagation()
                        openDeleteDialog(item)
                      }}
                    >
                      <Trash2 className={cn('text-destructive', compact ? 'h-3 w-3' : 'h-4 w-4')} />
                    </Button>
                  ) : undefined
                }
              />
              <div className={cn(compact ? 'space-y-0.5 px-1.5 pb-1.5 pt-1' : 'space-y-1 p-3')}>
                <div
                  className={cn(
                    'truncate font-medium leading-tight',
                    compact ? 'text-[11px]' : 'text-sm',
                  )}
                  title={item.fileName}
                >
                  {item.fileName}
                </div>
                <div className={cn('text-muted-foreground', compact ? 'text-[10px] leading-tight' : 'text-xs')}>
                  {formatAttachmentFileSize(item.fileSize)}
                </div>
              </div>
            </>
          )

          if (allowManage) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => openMetadataDialog(item)}
                className={cn(
                  'group flex flex-col overflow-hidden border bg-card text-left cursor-pointer transition-shadow hover:shadow-sm',
                  cardRounding,
                )}
              >
                {inner}
              </button>
            )
          }

          return (
            <a
              key={item.id}
              href={attachmentFileHref(item)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'group flex flex-col overflow-hidden border bg-card text-left transition-shadow hover:shadow-sm',
                cardRounding,
              )}
            >
              {inner}
            </a>
          )
        })}
      </div>

      {allowManage ? (
        <>
          <AttachmentMetadataDialog
            open={metadataOpen}
            onOpenChange={setMetadataOpen}
            item={selectedItem}
            availableTags={[]}
            onSave={handleMetadataSave}
          />
          <AttachmentDeleteDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            fileName={deleteTarget?.fileName}
            onConfirm={handleDelete}
            isDeleting={false}
          />
        </>
      ) : null}
    </div>
  )
}
