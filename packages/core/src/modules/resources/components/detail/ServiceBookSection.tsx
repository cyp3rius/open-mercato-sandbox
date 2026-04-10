"use client"

import * as React from 'react'
import { LogIn, LogOut, Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@open-mercato/ui/primitives/badge'
import { Button } from '@open-mercato/ui/primitives/button'
import { cn } from '@open-mercato/shared/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@open-mercato/ui/primitives/dialog'
import { createCrudFormError } from '@open-mercato/ui/backend/utils/serverErrors'
import { createCrud, updateCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { apiCall, readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { transferDraftAttachmentsToRecord } from '@open-mercato/ui/backend/utils/transferDraftAttachments'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { DictionaryEntrySelect, type DictionarySelectLabels } from '@open-mercato/core/modules/dictionaries/components/DictionaryEntrySelect'
import { formatDateTime } from '@open-mercato/shared/lib/time'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { createTranslatorWithFallback } from '@open-mercato/shared/lib/i18n/translate'
import {
  AttachmentItemsGrid,
  DraftRecordAttachmentsSection,
  LoadingMessage,
  TabEmptyState,
} from '@open-mercato/ui/backend/detail'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { SwitchableMarkdownInput } from '@open-mercato/ui/backend/inputs/SwitchableMarkdownInput'
import { MarkdownContent } from '@open-mercato/ui/backend/markdown/MarkdownContent'
import type { AttachmentItem } from '@open-mercato/ui/backend/detail/AttachmentMetadataDialog'
import { renderDictionaryColor } from '@open-mercato/core/modules/dictionaries/components/dictionaryAppearance'
import { E } from '#generated/entities.ids.generated'
import {
  createResourceDictionaryEntry,
  loadResourceDictionary,
  type DictionaryEntryOption,
} from './dictionaries'

type Translator = (key: string, fallback?: string, params?: Record<string, string | number>) => string

export type ServiceBookEntrySummary = {
  id: string
  serviceType: string
  serviceActivity: string
  serviceInAt: string | null
  serviceOutAt?: string | null
  description?: string | null
}

type ServiceBookSectionProps = {
  entityId: string | null
  labelPrefix?: string
}

function toLocalDateTimeInput(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (input: number) => `${input}`.padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`
}

function fromLocalDateTimeInput(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed.length) return null
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function mapRow(raw: Record<string, unknown>): ServiceBookEntrySummary | null {
  const id = typeof raw.id === 'string' ? raw.id : null
  if (!id) return null
  const serviceType = typeof raw.serviceType === 'string' ? raw.serviceType : ''
  const serviceActivity = typeof raw.serviceActivity === 'string' ? raw.serviceActivity : ''
  const serviceInAt = typeof raw.serviceInAt === 'string' ? raw.serviceInAt : null
  const serviceOutAt = typeof raw.serviceOutAt === 'string' ? raw.serviceOutAt : null
  const description = typeof raw.description === 'string' ? raw.description : null
  return { id, serviceType, serviceActivity, serviceInAt, serviceOutAt, description }
}

function serviceInAtSortKey(iso: string | null | undefined): number {
  if (!iso?.trim().length) return Number.NEGATIVE_INFINITY
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t
}

function sortServiceBookEntriesByServiceInDesc(entries: ServiceBookEntrySummary[]): ServiceBookEntrySummary[] {
  return [...entries].sort(
    (a, b) => serviceInAtSortKey(b.serviceInAt) - serviceInAtSortKey(a.serviceInAt),
  )
}

export function ServiceBookSection({
  entityId,
  labelPrefix = 'resources.resources.detail.serviceBook',
}: ServiceBookSectionProps) {
  const tHook = useT()
  const t = React.useMemo<Translator>(() => createTranslatorWithFallback(tHook), [tHook])
  const translate = React.useCallback(
    (suffix: string, fallback?: string) => t(`${labelPrefix}.${suffix}`, fallback ?? ''),
    [labelPrefix, t],
  )

  const [rows, setRows] = React.useState<ServiceBookEntrySummary[]>([])
  const [loading, setLoading] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [dialogMode, setDialogMode] = React.useState<'create' | 'edit'>('create')
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [attachmentDraftRecordId, setAttachmentDraftRecordId] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  const [serviceTypeDictId, setServiceTypeDictId] = React.useState<string | null>(null)
  const [serviceActivityDictId, setServiceActivityDictId] = React.useState<string | null>(null)
  const [serviceTypeEntries, setServiceTypeEntries] = React.useState<DictionaryEntryOption[]>([])
  const [serviceActivityEntries, setServiceActivityEntries] = React.useState<DictionaryEntryOption[]>([])

  const [formServiceType, setFormServiceType] = React.useState('')
  const [formServiceActivity, setFormServiceActivity] = React.useState('')
  const [formServiceInAt, setFormServiceInAt] = React.useState('')
  const [formServiceOutAt, setFormServiceOutAt] = React.useState('')
  const [formDescription, setFormDescription] = React.useState('')

  const [filterServiceType, setFilterServiceType] = React.useState('')
  const [filterServiceActivity, setFilterServiceActivity] = React.useState('')
  const [filterServiceInFrom, setFilterServiceInFrom] = React.useState('')
  const [filterServiceInTo, setFilterServiceInTo] = React.useState('')
  const [filterServiceOutFrom, setFilterServiceOutFrom] = React.useState('')
  const [filterServiceOutTo, setFilterServiceOutTo] = React.useState('')

  const [attachmentsByEntryId, setAttachmentsByEntryId] = React.useState<Record<string, AttachmentItem[]>>({})
  const [attachmentsRefreshKey, setAttachmentsRefreshKey] = React.useState(0)

  const { confirm, ConfirmDialogElement } = useConfirmDialog()

  const serviceBookAttachmentEntityId = E.resources.resources_resource_service_book_entry

  const hasActiveFilters = Boolean(
    filterServiceType.trim() ||
      filterServiceActivity.trim() ||
      filterServiceInFrom.trim() ||
      filterServiceInTo.trim() ||
      filterServiceOutFrom.trim() ||
      filterServiceOutTo.trim(),
  )

  const loadDictionaries = React.useCallback(async () => {
    const [typeRes, activityRes] = await Promise.all([
      loadResourceDictionary('serviceTypes'),
      loadResourceDictionary('serviceActivities'),
    ])
    setServiceTypeDictId(typeRes.dictionary?.id ?? null)
    setServiceActivityDictId(activityRes.dictionary?.id ?? null)
    setServiceTypeEntries(typeRes.entries)
    setServiceActivityEntries(activityRes.entries)
  }, [])

  React.useEffect(() => {
    loadDictionaries().catch(() => {})
  }, [loadDictionaries])

  const fetchServiceTypeOptions = React.useCallback(async () => {
    const { entries } = await loadResourceDictionary('serviceTypes')
    setServiceTypeEntries(entries)
    return entries
  }, [])

  const fetchServiceActivityOptions = React.useCallback(async () => {
    const { entries } = await loadResourceDictionary('serviceActivities')
    setServiceActivityEntries(entries)
    return entries
  }, [])

  const createServiceTypeOption = React.useCallback(
    (input: { value: string; label?: string; color?: string | null; icon?: string | null }) =>
      createResourceDictionaryEntry('serviceTypes', input),
    [],
  )

  const createServiceActivityOption = React.useCallback(
    (input: { value: string; label?: string; color?: string | null; icon?: string | null }) =>
      createResourceDictionaryEntry('serviceActivities', input),
    [],
  )

  const serviceTypeLabels = React.useMemo<DictionarySelectLabels>(
    () => ({
      placeholder: translate('dictionary.serviceType.placeholder', 'Select service type'),
      addLabel: translate('dictionary.add', 'Add'),
      addPrompt: translate('dictionary.prompt', 'Name'),
      dialogTitle: translate('dictionary.serviceType.dialogTitle', 'Add service type'),
      valueLabel: translate('dictionary.valueLabel', 'Name'),
      valuePlaceholder: translate('dictionary.valuePlaceholder', 'Name'),
      labelLabel: translate('dictionary.labelLabel', 'Label'),
      labelPlaceholder: translate('dictionary.labelPlaceholder', 'Display name'),
      emptyError: translate('dictionary.emptyError', 'Please enter a name'),
      cancelLabel: translate('dictionary.cancel', 'Cancel'),
      saveLabel: translate('dictionary.save', 'Save'),
      saveShortcutHint: translate('dictionary.saveShortcut', '\u2318/Ctrl + Enter'),
      errorLoad: translate('dictionary.errorLoad', 'Failed to load options'),
      errorSave: translate('dictionary.errorSave', 'Failed to save option'),
      loadingLabel: translate('dictionary.loading', 'Loading…'),
      manageTitle: translate('dictionary.manage', 'Manage dictionary'),
    }),
    [translate],
  )

  const serviceActivityLabels = React.useMemo<DictionarySelectLabels>(
    () => ({
      placeholder: translate('dictionary.serviceActivity.placeholder', 'Select activity'),
      addLabel: translate('dictionary.add', 'Add'),
      addPrompt: translate('dictionary.prompt', 'Name'),
      dialogTitle: translate('dictionary.serviceActivity.dialogTitle', 'Add service activity'),
      valueLabel: translate('dictionary.valueLabel', 'Name'),
      valuePlaceholder: translate('dictionary.valuePlaceholder', 'Name'),
      labelLabel: translate('dictionary.labelLabel', 'Label'),
      labelPlaceholder: translate('dictionary.labelPlaceholder', 'Display name'),
      emptyError: translate('dictionary.emptyError', 'Please enter a name'),
      cancelLabel: translate('dictionary.cancel', 'Cancel'),
      saveLabel: translate('dictionary.save', 'Save'),
      saveShortcutHint: translate('dictionary.saveShortcut', '\u2318/Ctrl + Enter'),
      errorLoad: translate('dictionary.errorLoad', 'Failed to load options'),
      errorSave: translate('dictionary.errorSave', 'Failed to save option'),
      loadingLabel: translate('dictionary.loading', 'Loading…'),
      manageTitle: translate('dictionary.manage', 'Manage dictionary'),
    }),
    [translate],
  )

  const loadRows = React.useCallback(async () => {
    if (!entityId) {
      setRows([])
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams({
        pageSize: '100',
        sortField: 'serviceInAt',
        sortDir: 'desc',
        entityId,
      })
      if (filterServiceType.trim()) params.set('filterServiceType', filterServiceType.trim())
      if (filterServiceActivity.trim()) params.set('filterServiceActivity', filterServiceActivity.trim())
      if (filterServiceInFrom.trim()) params.set('filterServiceInFrom', filterServiceInFrom.trim())
      if (filterServiceInTo.trim()) params.set('filterServiceInTo', filterServiceInTo.trim())
      if (filterServiceOutFrom.trim()) params.set('filterServiceOutFrom', filterServiceOutFrom.trim())
      if (filterServiceOutTo.trim()) params.set('filterServiceOutTo', filterServiceOutTo.trim())
      const payload = await readApiResultOrThrow<Record<string, unknown>>(
        `/api/resources/service-book?${params.toString()}`,
        undefined,
        { errorMessage: translate('loadError', 'Failed to load service book.') },
      )
      const items = Array.isArray(payload?.items) ? payload.items : []
      const next = sortServiceBookEntriesByServiceInDesc(
        items
          .map((item) => (item && typeof item === 'object' ? mapRow(item as Record<string, unknown>) : null))
          .filter((entry): entry is ServiceBookEntrySummary => !!entry),
      )
      setRows(next)
    } finally {
      setLoading(false)
    }
  }, [
    entityId,
    filterServiceActivity,
    filterServiceInFrom,
    filterServiceInTo,
    filterServiceOutFrom,
    filterServiceOutTo,
    filterServiceType,
    translate,
  ])

  React.useEffect(() => {
    loadRows().catch(() => {})
  }, [loadRows])

  React.useEffect(() => {
    if (!entityId || rows.length === 0) {
      setAttachmentsByEntryId({})
      return
    }
    let cancelled = false
    const run = async () => {
      const next: Record<string, AttachmentItem[]> = {}
      const chunkSize = 10
      for (let offset = 0; offset < rows.length; offset += chunkSize) {
        if (cancelled) return
        const chunk = rows.slice(offset, offset + chunkSize)
        const pairs = await Promise.all(
          chunk.map(async (row) => {
            const call = await apiCall<{ items?: AttachmentItem[] }>(
              `/api/attachments?entityId=${encodeURIComponent(serviceBookAttachmentEntityId)}&recordId=${encodeURIComponent(row.id)}`,
              undefined,
              { fallback: { items: [] } },
            )
            const items = Array.isArray(call.result?.items) ? call.result.items : []
            return [row.id, items] as const
          }),
        )
        for (const [id, items] of pairs) {
          next[id] = items
        }
      }
      if (!cancelled) setAttachmentsByEntryId(next)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [entityId, rows, serviceBookAttachmentEntityId, attachmentsRefreshKey])

  const serviceBookDateOrderError = React.useMemo(() => {
    if (!formServiceOutAt.trim().length) return null
    const serviceInAt = fromLocalDateTimeInput(formServiceInAt)
    const serviceOutAt = fromLocalDateTimeInput(formServiceOutAt)
    if (!serviceInAt || !serviceOutAt) return null
    if (new Date(serviceOutAt) < new Date(serviceInAt)) {
      return translate(
        'errors.serviceOutBeforeIn',
        'Service exit cannot be earlier than service entry.',
      )
    }
    return null
  }, [formServiceInAt, formServiceOutAt, translate])

  const serviceTypeMap = React.useMemo(
    () => new Map(serviceTypeEntries.map((entry) => [entry.value, entry])),
    [serviceTypeEntries],
  )
  const serviceActivityMap = React.useMemo(
    () => new Map(serviceActivityEntries.map((entry) => [entry.value, entry])),
    [serviceActivityEntries],
  )

  const manageServiceTypeHref = React.useMemo(() => {
    if (!serviceTypeDictId) return '/backend/config/dictionaries'
    return `/backend/config/dictionaries?dictionaryId=${encodeURIComponent(serviceTypeDictId)}`
  }, [serviceTypeDictId])

  const manageServiceActivityHref = React.useMemo(() => {
    if (!serviceActivityDictId) return '/backend/config/dictionaries'
    return `/backend/config/dictionaries?dictionaryId=${encodeURIComponent(serviceActivityDictId)}`
  }, [serviceActivityDictId])

  const clearFilters = React.useCallback(() => {
    setFilterServiceType('')
    setFilterServiceActivity('')
    setFilterServiceInFrom('')
    setFilterServiceInTo('')
    setFilterServiceOutFrom('')
    setFilterServiceOutTo('')
  }, [])

  const resetDialogForm = React.useCallback(() => {
    setAttachmentDraftRecordId(null)
    setEditingId(null)
    setDialogMode('create')
    setFormServiceType('')
    setFormServiceActivity('')
    setFormServiceInAt('')
    setFormServiceOutAt('')
    setFormDescription('')
  }, [])

  const openCreate = React.useCallback(() => {
    setDialogMode('create')
    setEditingId(null)
    setAttachmentDraftRecordId(crypto.randomUUID())
    setFormServiceType('')
    setFormServiceActivity('')
    setFormServiceInAt('')
    setFormServiceOutAt('')
    setFormDescription('')
    setDialogOpen(true)
  }, [])

  const openEdit = React.useCallback((row: ServiceBookEntrySummary) => {
    setDialogMode('edit')
    setAttachmentDraftRecordId(null)
    setEditingId(row.id)
    setFormServiceType(row.serviceType)
    setFormServiceActivity(row.serviceActivity)
    setFormServiceInAt(toLocalDateTimeInput(row.serviceInAt))
    setFormServiceOutAt(toLocalDateTimeInput(row.serviceOutAt ?? null))
    setFormDescription(row.description ?? '')
    setDialogOpen(true)
  }, [])

  const validateForm = React.useCallback(() => {
    if (!formServiceType.trim()) {
      throw createCrudFormError(translate('errors.serviceType', 'Service type is required.'))
    }
    if (!formServiceActivity.trim()) {
      throw createCrudFormError(translate('errors.serviceActivity', 'Service activity is required.'))
    }
    const serviceInAt = fromLocalDateTimeInput(formServiceInAt)
    if (!serviceInAt) {
      throw createCrudFormError(translate('errors.serviceInAt', 'Service entry date is required.'))
    }
    let serviceOutAt: string | null = null
    if (formServiceOutAt.trim().length) {
      serviceOutAt = fromLocalDateTimeInput(formServiceOutAt)
      if (!serviceOutAt) {
        throw createCrudFormError(translate('errors.serviceOutAt', 'Invalid exit date.'))
      }
      if (new Date(serviceOutAt) < new Date(serviceInAt)) {
        throw createCrudFormError(
          translate(
            'errors.serviceOutBeforeIn',
            'Service exit cannot be earlier than service entry.',
          ),
        )
      }
    }
    return { serviceInAt, serviceOutAt }
  }, [formServiceActivity, formServiceInAt, formServiceOutAt, formServiceType, translate])

  const handleSubmit = React.useCallback(async () => {
    if (!entityId) return
    setPending(true)
    try {
      const { serviceInAt, serviceOutAt } = validateForm()
      const descriptionPayload = formDescription.trim().length ? formDescription.trim() : null
      if (dialogMode === 'create') {
        const draftId = attachmentDraftRecordId
        const call = await createCrud<{ id: string | null }>(
          'resources/service-book',
          {
            entityId,
            serviceType: formServiceType.trim(),
            serviceActivity: formServiceActivity.trim(),
            serviceInAt,
            serviceOutAt: serviceOutAt ?? undefined,
            description: descriptionPayload,
          },
          { errorMessage: translate('saveError', 'Failed to save entry.') },
        )
        const newId = call.result && typeof call.result.id === 'string' ? call.result.id : null
        if (!newId) {
          flash(translate('saveError', 'Failed to save entry.'), 'error')
          return
        }
        if (draftId) {
          try {
            await transferDraftAttachmentsToRecord(
              E.resources.resources_resource_service_book_entry,
              draftId,
              newId,
            )
          } catch {
            flash(
              translate(
                'attachments.transferWarning',
                'The entry was saved but some draft files could not be linked. Upload them again in this dialog.',
              ),
              'warning',
            )
          }
        }
        setAttachmentDraftRecordId(null)
        setEditingId(null)
        setDialogMode('create')
        setDialogOpen(false)
        flash(translate('flash.saved', 'Entry saved.'), 'success')
      } else if (editingId) {
        await updateCrud(
          'resources/service-book',
          {
            id: editingId,
            entityId,
            serviceType: formServiceType.trim(),
            serviceActivity: formServiceActivity.trim(),
            serviceInAt,
            serviceOutAt: serviceOutAt ?? null,
            description: descriptionPayload,
          },
          { errorMessage: translate('saveError', 'Failed to save entry.') },
        )
        flash(translate('flash.updated', 'Entry updated.'), 'success')
        setDialogOpen(false)
      }
      await loadRows()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : translate('saveError', 'Failed to save entry.')
      flash(message, 'error')
    } finally {
      setPending(false)
    }
  }, [
    attachmentDraftRecordId,
    dialogMode,
    editingId,
    entityId,
    formDescription,
    formServiceActivity,
    formServiceInAt,
    formServiceOutAt,
    formServiceType,
    loadRows,
    validateForm,
    translate,
  ])

  const handleDelete = React.useCallback(
    async (row: ServiceBookEntrySummary) => {
      const ok = await confirm({
        title: translate('delete.title', 'Delete entry?'),
        text: translate('delete.description', 'This service book entry will be removed.'),
        confirmText: translate('delete.confirm', 'Delete'),
        cancelText: translate('delete.cancel', 'Cancel'),
        variant: 'destructive',
      })
      if (!ok) return
      try {
        await deleteCrud('resources/service-book', row.id, {
          errorMessage: translate('deleteError', 'Failed to delete entry.'),
        })
        await loadRows()
      } catch (err) {
        const message =
          err instanceof Error ? err.message : translate('deleteError', 'Failed to delete entry.')
        flash(message, 'error')
      }
    },
    [confirm, loadRows, translate],
  )

  return (
    <div className="mt-3 space-y-4">
      {entityId ? (
        <div className="space-y-2 rounded-lg border border-border/50 bg-muted/5 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {translate('filters.heading', 'Filters')}
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0 space-y-1">
              <div className="text-[10px] font-medium text-muted-foreground">
                {translate('filters.serviceType', 'Service type')}
              </div>
              <DictionaryEntrySelect
                value={filterServiceType || undefined}
                onChange={(next) => setFilterServiceType(next ?? '')}
                fetchOptions={fetchServiceTypeOptions}
                createOption={createServiceTypeOption}
                labels={serviceTypeLabels}
                allowInlineCreate={false}
                selectClassName="w-full"
                manageHref={manageServiceTypeHref}
              />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="text-[10px] font-medium text-muted-foreground">
                {translate('filters.serviceActivity', 'Service activity')}
              </div>
              <DictionaryEntrySelect
                value={filterServiceActivity || undefined}
                onChange={(next) => setFilterServiceActivity(next ?? '')}
                fetchOptions={fetchServiceActivityOptions}
                createOption={createServiceActivityOption}
                labels={serviceActivityLabels}
                allowInlineCreate={false}
                selectClassName="w-full"
                manageHref={manageServiceActivityHref}
              />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="text-[10px] font-medium text-muted-foreground">
                {translate('filters.serviceInRange', 'Entry date range')}
              </div>
              <div className="flex min-w-0 gap-1">
                <input
                  type="datetime-local"
                  aria-label={translate('filters.serviceInFrom', 'Entry from')}
                  className="h-9 min-w-0 flex-1 rounded border border-muted-foreground/40 bg-background px-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  value={filterServiceInFrom}
                  onChange={(event) => setFilterServiceInFrom(event.target.value)}
                />
                <input
                  type="datetime-local"
                  aria-label={translate('filters.serviceInTo', 'Entry to')}
                  className="h-9 min-w-0 flex-1 rounded border border-muted-foreground/40 bg-background px-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  value={filterServiceInTo}
                  onChange={(event) => setFilterServiceInTo(event.target.value)}
                />
              </div>
            </div>
            <div className="min-w-0 space-y-1">
              <div className="text-[10px] font-medium text-muted-foreground">
                {translate('filters.serviceOutRange', 'Exit date range')}
              </div>
              <div className="flex min-w-0 gap-1">
                <input
                  type="datetime-local"
                  aria-label={translate('filters.serviceOutFrom', 'Exit from')}
                  className="h-9 min-w-0 flex-1 rounded border border-muted-foreground/40 bg-background px-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  value={filterServiceOutFrom}
                  onChange={(event) => setFilterServiceOutFrom(event.target.value)}
                />
                <input
                  type="datetime-local"
                  aria-label={translate('filters.serviceOutTo', 'Exit to')}
                  className="h-9 min-w-0 flex-1 rounded border border-muted-foreground/40 bg-background px-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  value={filterServiceOutTo}
                  onChange={(event) => setFilterServiceOutTo(event.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={!hasActiveFilters || pending}
              onClick={() => clearFilters()}
            >
              {translate('filters.clear', 'Clear filters')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!entityId || pending}
              onClick={() => openCreate()}
            >
              {translate('add', 'Add entry')}
            </Button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <LoadingMessage
          label={translate('loading', 'Loading…')}
          className="border-0 bg-transparent p-0 py-8 justify-center"
        />
      ) : null}

      {!loading && rows.length === 0 && !hasActiveFilters ? (
        <TabEmptyState
          title={translate('emptyTitle', 'No service visits yet')}
          action={{
            label: translate('emptyAction', 'Add entry'),
            onClick: openCreate,
            disabled: !entityId || pending,
          }}
        />
      ) : null}

      {!loading && rows.length === 0 && hasActiveFilters ? (
        <div className="rounded-lg border border-dashed border-border/70 bg-muted/5 px-4 py-8 text-center">
          <p className="text-sm font-medium text-foreground">
            {translate('emptyFilteredTitle', 'No entries match the filters.')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {translate('emptyFilteredHint', 'Adjust filters or clear them to see all entries.')}
          </p>
          <Button type="button" size="sm" variant="outline" className="mt-4" onClick={() => clearFilters()}>
            {translate('filters.clear', 'Clear filters')}
          </Button>
        </div>
      ) : null}

      {!loading && rows.length > 0 ? (
        <ul className="space-y-3">
          {rows.map((row) => {
            const typeEntry = serviceTypeMap.get(row.serviceType)
            const typeLabel = typeEntry?.label ?? row.serviceType
            const activityEntry = serviceActivityMap.get(row.serviceActivity)
            const activityLabel = activityEntry?.label ?? row.serviceActivity
            const inLabel = row.serviceInAt ? formatDateTime(row.serviceInAt) : '—'
            const outLabel = row.serviceOutAt ? formatDateTime(row.serviceOutAt) : '—'
            const rowAttachments = attachmentsByEntryId[row.id] ?? []
            return (
              <li
                key={row.id}
                className="rounded-lg border border-border/60 bg-muted/10 px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <span className="inline-flex min-w-0 items-center gap-2">
                        {renderDictionaryColor(typeEntry?.color)}
                        <span className="truncate font-semibold text-foreground">{typeLabel}</span>
                      </span>
                      <span className="text-muted-foreground" aria-hidden>
                        ·
                      </span>
                      <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-muted-foreground">
                        <span className="inline-flex items-center gap-1 whitespace-nowrap">
                          <LogIn className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                          <span>{inLabel}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 whitespace-nowrap">
                          <LogOut className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                          <span>{outLabel}</span>
                        </span>
                      </span>
                    </div>
                    {row.serviceActivity.trim().length ? (
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="secondary" className="font-normal">
                          {activityLabel}
                        </Badge>
                      </div>
                    ) : null}
                    {row.description?.trim().length ? (
                      <div className="text-sm text-foreground/90 [&_.wmde-markdown]:text-sm">
                        <MarkdownContent body={row.description} format="markdown" className="break-words" />
                      </div>
                    ) : null}
                    {rowAttachments.length ? (
                      <AttachmentItemsGrid
                        items={rowAttachments}
                        compact
                        className="border-t border-border/50 pt-2"
                        onManagedChange={() => setAttachmentsRefreshKey((key) => key + 1)}
                      />
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label={translate('edit', 'Edit')}
                      onClick={() => openEdit(row)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      aria-label={translate('delete', 'Delete')}
                      onClick={() => handleDelete(row)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetDialogForm()
        }}
      >
        <DialogContent className="flex max-h-[min(90vh,48rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 px-6 pt-6">
            <DialogTitle>
              {dialogMode === 'create'
                ? translate('dialog.createTitle', 'New service book entry')
                : translate('dialog.editTitle', 'Edit service book entry')}
            </DialogTitle>
          </DialogHeader>
          <form
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            onSubmit={(event) => {
              event.preventDefault()
              handleSubmit().catch(() => {})
            }}
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-2 pt-4">
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">
                {translate('fields.serviceType', 'Service type')}
              </div>
              <DictionaryEntrySelect
                value={formServiceType || undefined}
                onChange={(next) => setFormServiceType(next ?? '')}
                fetchOptions={fetchServiceTypeOptions}
                createOption={createServiceTypeOption}
                labels={serviceTypeLabels}
                allowInlineCreate
                selectClassName="w-full"
                manageHref={manageServiceTypeHref}
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">
                {translate('fields.serviceActivity', 'Service activity')}
              </div>
              <DictionaryEntrySelect
                value={formServiceActivity || undefined}
                onChange={(next) => setFormServiceActivity(next ?? '')}
                fetchOptions={fetchServiceActivityOptions}
                createOption={createServiceActivityOption}
                labels={serviceActivityLabels}
                allowInlineCreate
                selectClassName="w-full"
                manageHref={manageServiceActivityHref}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="service-book-in">
                  {translate('fields.serviceInAt', 'Service entry (in)')}
                </label>
                <input
                  id="service-book-in"
                  type="datetime-local"
                  className="h-9 w-full rounded border border-muted-foreground/40 bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  value={formServiceInAt}
                  onChange={(event) => setFormServiceInAt(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="service-book-out">
                  {translate('fields.serviceOutAt', 'Service exit (out)')}
                </label>
                <input
                  id="service-book-out"
                  type="datetime-local"
                  min={formServiceInAt.trim().length ? formServiceInAt : undefined}
                  className={cn(
                    'h-9 w-full rounded border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    serviceBookDateOrderError
                      ? 'border-destructive focus-visible:ring-destructive'
                      : 'border-muted-foreground/40',
                  )}
                  value={formServiceOutAt}
                  onChange={(event) => setFormServiceOutAt(event.target.value)}
                />
                {serviceBookDateOrderError ? (
                  <p className="text-xs text-destructive">{serviceBookDateOrderError}</p>
                ) : null}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">
                {translate('fields.description', 'Description')}
              </div>
              <SwitchableMarkdownInput
                value={formDescription}
                onChange={setFormDescription}
                isMarkdownEnabled
                height={220}
                disabled={pending}
                placeholder={translate('descriptionPlaceholder', 'Notes, mileage, work performed…')}
              />
            </div>
            <div className="space-y-2 border-t border-border/60 pt-4">
              <div className="text-sm font-medium text-foreground">
                {translate('attachments.title', 'Attachments')}
              </div>
              <p className="text-xs text-muted-foreground">
                {translate(
                  'attachments.hint',
                  'Files are stored as a draft and linked to this entry automatically when you save.',
                )}
              </p>
              <DraftRecordAttachmentsSection
                entityId={E.resources.resources_resource_service_book_entry}
                persistedRecordId={editingId}
                draftRecordId={attachmentDraftRecordId}
                showHeader={false}
                compact
                className="space-y-3"
              />
            </div>
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-border/60 bg-background px-6 py-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {translate('dialog.cancel', 'Cancel')}
              </Button>
              <Button type="submit" disabled={pending || Boolean(serviceBookDateOrderError)}>
                {dialogMode === 'create'
                  ? translate('dialog.save', 'Save')
                  : translate('dialog.update', 'Update')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {ConfirmDialogElement}
    </div>
  )
}
