"use client"

import * as React from 'react'
import { Upload, File, Trash2 } from 'lucide-react'
import { Button } from '@open-mercato/ui/primitives/button'
import { Label } from '@open-mercato/ui/primitives/label'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { CRUD_FORM_SELECT_CLASS } from '@open-mercato/ui/backend/CrudForm'
import { INSURANCE_ATTACHMENT_TAG, INSURANCE_POLICY_ATTACHMENT_ENTITY_ID } from '../../lib/insuranceDeskConstants'

type AttachmentItem = {
  id: string
  fileName: string
  url: string
  fileSize?: number
  tags?: string[]
}

type Props = {
  policyId: string | null
  className?: string
  /** Hide title/hint/border when nested in another card. */
  embedded?: boolean
}

type Category = 'polisa' | 'inne' | 'klient'

function categoryFromTags(tags: string[] | undefined): Category {
  if (!tags?.length) return 'inne'
  if (tags.includes(INSURANCE_ATTACHMENT_TAG.polisa)) return 'polisa'
  if (tags.includes(INSURANCE_ATTACHMENT_TAG.klient)) return 'klient'
  return 'inne'
}

export function PolicyAttachmentsPanel({ policyId, className, embedded = false }: Props) {
  const t = useT()
  const [items, setItems] = React.useState<AttachmentItem[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [category, setCategory] = React.useState<Category>('inne')
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  const load = React.useCallback(async () => {
    if (!policyId) return
    setLoading(true)
    setError(null)
    try {
      const call = await apiCall<{ items?: AttachmentItem[]; error?: string }>(
        `/api/attachments?entityId=${encodeURIComponent(INSURANCE_POLICY_ATTACHMENT_ENTITY_ID)}&recordId=${encodeURIComponent(policyId)}`,
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
  }, [policyId, t])

  React.useEffect(() => {
    void load()
  }, [load])

  const tagForCategory = (cat: Category): string => {
    if (cat === 'polisa') return INSURANCE_ATTACHMENT_TAG.polisa
    if (cat === 'klient') return INSURANCE_ATTACHMENT_TAG.klient
    return INSURANCE_ATTACHMENT_TAG.inne
  }

  const onFiles = React.useCallback(
    async (files: FileList | null) => {
      if (!policyId || !files?.length) return
      setUploading(true)
      setError(null)
      try {
        const tag = tagForCategory(category)
        for (const file of Array.from(files)) {
          const fd = new FormData()
          fd.set('entityId', INSURANCE_POLICY_ATTACHMENT_ENTITY_ID)
          fd.set('recordId', policyId)
          fd.set('file', file)
          fd.set('tags', JSON.stringify([tag]))
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
    [category, load, policyId, t],
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

  if (!policyId) {
    return (
      <div className={cn('rounded-md border border-dashed border-border bg-muted/20 px-3 py-4 text-sm text-muted-foreground', className)}>
        {t('insurance_desk.policies.attachments.afterSave', 'Save the policy first to attach files (policy, registration, client documents).')}
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', !embedded && 'rounded-md border border-border bg-card px-3 py-3', className)}>
      {embedded ? null : (
        <>
          <div className="text-sm font-medium text-foreground">{t('insurance_desk.policies.attachments.title', 'Attachments')}</div>
          <p className="text-xs text-muted-foreground">
            {t('insurance_desk.policies.attachments.hint', 'Choose a category, then upload. You can add multiple files.')}
          </p>
        </>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">{t('insurance_desk.policies.attachments.category', 'Category')}</Label>
          <select
            className={cn(CRUD_FORM_SELECT_CLASS, 'min-w-40')}
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            disabled={uploading}
          >
            <option value="polisa">{t('insurance_desk.policies.attachments.cat.polisa', 'Policy document')}</option>
            <option value="inne">{t('insurance_desk.policies.attachments.cat.inne', 'Other')}</option>
            <option value="klient">{t('insurance_desk.policies.attachments.cat.klient', 'Client')}</option>
          </select>
        </div>
        <input ref={inputRef} type="file" className="hidden" multiple onChange={(e) => onFiles(e.target.files)} />
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
          <Upload className="size-4 mr-1" />
          {uploading ? t('common.loading', 'Loading…') : t('insurance_desk.policies.attachments.upload', 'Upload')}
        </Button>
      </div>
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
              <span className="text-xs text-muted-foreground">
                [
                {t(
                  `insurance_desk.policies.attachments.cat.${categoryFromTags(item.tags)}`,
                  categoryFromTags(item.tags),
                )}
                ]
              </span>
            </div>
            <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => onDelete(item.id)}>
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default PolicyAttachmentsPanel
