"use client"

import * as React from 'react'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { apiCallOrThrow, readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Button } from '@open-mercato/ui/primitives/button'
import { IconButton } from '@open-mercato/ui/primitives/icon-button'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { E } from '#generated/entities.ids.generated'

type GalleryRow = { id: string; attachmentId: string; sortOrder: number }

type AttachmentRow = {
  id: string
  url: string
  fileName: string
  thumbnailUrl?: string
  mimeType?: string | null
}

export function VehicleGallerySection({ resourceId }: { resourceId: string | null }) {
  const t = useT()
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [rows, setRows] = React.useState<GalleryRow[]>([])
  const [attachmentsById, setAttachmentsById] = React.useState<Map<string, AttachmentRow>>(new Map())
  const [loading, setLoading] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)

  const loadGallery = React.useCallback(async () => {
    if (!resourceId) return
    setLoading(true)
    try {
      const gallery = await readApiResultOrThrow<{ items?: GalleryRow[] }>(
        `/api/resources/resource-gallery?resourceId=${encodeURIComponent(resourceId)}`,
        undefined,
        { errorMessage: t('resources.gallery.error.load', 'Failed to load gallery.') },
      )
      const items = Array.isArray(gallery?.items) ? gallery.items : []
      setRows(items)
      const attachmentPayload = await readApiResultOrThrow<{ items?: AttachmentRow[] }>(
        `/api/attachments?entityId=${encodeURIComponent(E.resources.resources_resource)}&recordId=${encodeURIComponent(resourceId)}`,
        undefined,
        { errorMessage: t('resources.gallery.error.loadAttachments', 'Failed to load attachments.') },
      )
      const attItems = Array.isArray(attachmentPayload?.items) ? attachmentPayload.items : []
      const map = new Map<string, AttachmentRow>()
      attItems.forEach((item) => {
        if (item?.id) map.set(item.id, item)
      })
      setAttachmentsById(map)
    } finally {
      setLoading(false)
    }
  }, [resourceId, t])

  React.useEffect(() => {
    void loadGallery()
  }, [loadGallery])

  const handleUploadClick = React.useCallback(() => {
    fileRef.current?.click()
  }, [])

  const handleFileChange = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file || !resourceId) return
      setUploading(true)
      try {
        const form = new FormData()
        form.set('entityId', E.resources.resources_resource)
        form.set('recordId', resourceId)
        form.set('file', file)
        const created = await apiCallOrThrow<{ item?: { id?: string } }>(
          '/api/attachments',
          { method: 'POST', body: form },
          { errorMessage: t('resources.gallery.error.upload', 'Failed to upload file.') },
        )
        const attachmentId = typeof created.result?.item?.id === 'string' ? created.result.item.id : null
        if (!attachmentId) throw new Error('missing id')
        await apiCallOrThrow(
          '/api/resources/resource-gallery',
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ resourceId, attachmentId }),
          },
          { errorMessage: t('resources.gallery.error.save', 'Failed to add to gallery.') },
        )
        flash(t('resources.gallery.flash.added', 'Photo added to gallery.'), 'success')
        await loadGallery()
      } finally {
        setUploading(false)
      }
    },
    [loadGallery, resourceId, t],
  )

  const reorder = React.useCallback(
    async (next: GalleryRow[]) => {
      if (!resourceId) return
      setRows(next)
      await apiCallOrThrow(
        '/api/resources/resource-gallery',
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ resourceId, orderedItemIds: next.map((row) => row.id) }),
        },
        { errorMessage: t('resources.gallery.error.reorder', 'Failed to reorder gallery.') },
      )
    },
    [resourceId, t],
  )

  const move = React.useCallback(
    (index: number, delta: number) => {
      const target = index + delta
      if (target < 0 || target >= rows.length) return
      const next = [...rows]
      const [removed] = next.splice(index, 1)
      next.splice(target, 0, removed)
      void reorder(next)
    },
    [reorder, rows],
  )

  const remove = React.useCallback(
    async (galleryItemId: string) => {
      await apiCallOrThrow(
        `/api/resources/resource-gallery?id=${encodeURIComponent(galleryItemId)}`,
        { method: 'DELETE' },
        { errorMessage: t('resources.gallery.error.delete', 'Failed to remove gallery item.') },
      )
      flash(t('resources.gallery.flash.removed', 'Removed from gallery.'), 'success')
      await loadGallery()
    },
    [loadGallery, t],
  )

  if (!resourceId) return null

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold">{t('resources.gallery.title', 'Vehicle photos')}</div>
        <div>
          <input ref={fileRef} type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
          <Button type="button" size="sm" disabled={uploading} onClick={handleUploadClick}>
            {uploading
              ? t('resources.gallery.uploading', 'Uploading…')
              : t('resources.gallery.addPhoto', 'Add photo')}
          </Button>
        </div>
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">{t('resources.gallery.loading', 'Loading…')}</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('resources.gallery.empty', 'No gallery photos yet.')}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row, index) => {
            const att = attachmentsById.get(row.attachmentId)
            const src = att?.thumbnailUrl ?? att?.url ?? ''
            const label = att?.fileName ?? row.attachmentId
            return (
              <li
                key={row.id}
                className="flex flex-col overflow-hidden rounded-md border border-border/60 bg-card text-sm"
              >
                <div className="relative aspect-video bg-muted">
                  {src ? (
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">{label}</div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-1 border-t px-2 py-1">
                  <span className="truncate text-xs text-muted-foreground" title={label}>
                    {label}
                  </span>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <IconButton
                      type="button"
                      variant="ghost"
                      size="xs"
                      aria-label={t('resources.gallery.moveUp', 'Move up')}
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                    >
                      <ChevronUp className="size-4" />
                    </IconButton>
                    <IconButton
                      type="button"
                      variant="ghost"
                      size="xs"
                      aria-label={t('resources.gallery.moveDown', 'Move down')}
                      onClick={() => move(index, 1)}
                      disabled={index === rows.length - 1}
                    >
                      <ChevronDown className="size-4" />
                    </IconButton>
                    <IconButton
                      type="button"
                      variant="ghost"
                      size="xs"
                      aria-label={t('resources.gallery.remove', 'Remove from gallery')}
                      onClick={() => void remove(row.id)}
                    >
                      <Trash2 className="size-4" />
                    </IconButton>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
