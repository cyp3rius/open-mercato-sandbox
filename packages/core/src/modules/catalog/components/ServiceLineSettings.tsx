"use client"

import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { Textarea } from '@open-mercato/ui/primitives/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@open-mercato/ui/primitives/dialog'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { apiCall, readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { raiseCrudError } from '@open-mercato/ui/backend/utils/serverErrors'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'

type ServiceLine = {
  id: string
  code: string
  title: string
  description: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type ServiceLineApiPayload = Partial<ServiceLine> & {
  sort_order?: number
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

type DialogState =
  | { mode: 'create' }
  | { mode: 'edit'; entry: ServiceLine }

const PAGE_SIZE = 100

type ServiceLineFormState = {
  code: string
  title: string
  description: string
  sortOrder: string
  isActive: boolean
}

const DEFAULT_FORM: ServiceLineFormState = {
  code: '',
  title: '',
  description: '',
  sortOrder: '0',
  isActive: true,
}

const normalizeServiceLine = (input: ServiceLineApiPayload | null | undefined): ServiceLine => {
  const raw = input ?? {}
  const toStringValue = (value: unknown): string | null => {
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'bigint') return String(value)
    return null
  }
  const toNumber = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim().length) {
      const n = Number(value)
      return Number.isFinite(n) ? n : 0
    }
    return 0
  }
  const toBooleanValue = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null)

  return {
    id: toStringValue(raw.id) ?? '',
    code: toStringValue(raw.code) ?? '',
    title: toStringValue(raw.title) ?? '',
    description: toStringValue(raw.description) ?? null,
    sortOrder: toNumber(raw.sortOrder ?? raw.sort_order),
    isActive: toBooleanValue(raw.isActive) ?? toBooleanValue(raw.is_active) ?? true,
    createdAt: toStringValue(raw.createdAt) ?? toStringValue(raw.created_at) ?? '',
    updatedAt: toStringValue(raw.updatedAt) ?? toStringValue(raw.updated_at) ?? '',
  }
}

export function ServiceLineSettings() {
  const t = useT()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const scopeVersion = useOrganizationScopeVersion()
  const [items, setItems] = React.useState<ServiceLine[]>([])
  const [loading, setLoading] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [dialog, setDialog] = React.useState<DialogState | null>(null)
  const [form, setForm] = React.useState<ServiceLineFormState>(DEFAULT_FORM)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const loadItems = React.useCallback(async () => {
    setLoading(true)
    const loadErrorMessage = t('catalog.serviceLines.errors.load', 'Failed to load service lines.')
    try {
      const payload = await readApiResultOrThrow<{ items?: ServiceLineApiPayload[] }>(
        `/api/catalog/service-lines?pageSize=${PAGE_SIZE}`,
        undefined,
        { errorMessage: loadErrorMessage },
      )
      const normalized = Array.isArray(payload.items) ? payload.items.map((item) => normalizeServiceLine(item)) : []
      setItems(normalized)
    } catch (err) {
      console.error('catalog.service-lines.list failed', err)
      flash(loadErrorMessage, 'error')
    } finally {
      setLoading(false)
    }
  }, [t])

  React.useEffect(() => {
    loadItems().catch(() => {})
  }, [loadItems, scopeVersion])

  const openDialog = React.useCallback((state: DialogState) => {
    if (state.mode === 'edit') {
      setForm({
        code: state.entry.code,
        title: state.entry.title,
        description: state.entry.description ?? '',
        sortOrder: String(state.entry.sortOrder ?? 0),
        isActive: state.entry.isActive,
      })
    } else {
      setForm(DEFAULT_FORM)
    }
    setError(null)
    setDialog(state)
  }, [])

  const closeDialog = React.useCallback(() => {
    setDialog(null)
    setError(null)
    setSubmitting(false)
    setForm(DEFAULT_FORM)
  }, [])

  const handleSubmit = React.useCallback(async () => {
    if (!dialog) return
    const trimmedCode = form.code.trim().toLowerCase()
    const trimmedTitle = form.title.trim()
    if (!trimmedCode || !trimmedTitle) {
      setError(t('catalog.serviceLines.errors.required', 'Code and title are required.'))
      return
    }
    const sortOrder = Number.parseInt(form.sortOrder.trim(), 10)
    if (!Number.isFinite(sortOrder) || sortOrder < 0) {
      setError(t('catalog.serviceLines.errors.sortOrder', 'Sort order must be a non-negative integer.'))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        code: trimmedCode,
        title: trimmedTitle,
        description: form.description.trim() || undefined,
        sortOrder,
        isActive: form.isActive,
      }
      const path = '/api/catalog/service-lines'
      const method = dialog.mode === 'create' ? 'POST' : 'PUT'
      const body =
        dialog.mode === 'edit'
          ? JSON.stringify({ id: dialog.entry.id, ...payload })
          : JSON.stringify(payload)
      const call = await apiCall(path, {
        method,
        headers: { 'content-type': 'application/json' },
        body,
      })
      if (!call.ok) {
        await raiseCrudError(call.response, t('catalog.serviceLines.errors.save', 'Failed to save service line.'))
      }
      flash(
        dialog.mode === 'create'
          ? t('catalog.serviceLines.messages.created', 'Service line created.')
          : t('catalog.serviceLines.messages.updated', 'Service line updated.'),
        'success',
      )
      closeDialog()
      await loadItems()
    } catch (err) {
      console.error('catalog.service-lines.save failed', err)
      const message =
        err instanceof Error ? err.message : t('catalog.serviceLines.errors.save', 'Failed to save service line.')
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }, [dialog, form, t, closeDialog, loadItems])

  const handleDelete = React.useCallback(
    async (entry: ServiceLine) => {
      const confirmMessage = t('catalog.serviceLines.confirm.delete', 'Delete service line "{{code}}"?').replace('{{code}}', entry.code)
      const confirmed = await confirm({
        title: confirmMessage,
        variant: 'destructive',
      })
      if (!confirmed) return
      try {
        const call = await apiCall('/api/catalog/service-lines', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: entry.id }),
        })
        if (!call.ok) {
          await raiseCrudError(call.response, t('catalog.serviceLines.errors.delete', 'Failed to delete service line.'))
        }
        flash(t('catalog.serviceLines.messages.deleted', 'Service line deleted.'), 'success')
        await loadItems()
      } catch (err) {
        console.error('catalog.service-lines.delete failed', err)
        const message =
          err instanceof Error ? err.message : t('catalog.serviceLines.errors.delete', 'Failed to delete service line.')
        flash(message, 'error')
      }
    },
    [confirm, loadItems, t],
  )

  const formKeyHandler = React.useCallback(
    (event: React.KeyboardEvent<HTMLFormElement>) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        void handleSubmit()
      }
    },
    [handleSubmit],
  )

  const tableLabels = React.useMemo(() => ({
    code: t('catalog.serviceLines.table.code', 'Code'),
    title: t('catalog.serviceLines.table.title', 'Title'),
    sortOrder: t('catalog.serviceLines.table.sortOrder', 'Sort'),
    active: t('catalog.serviceLines.table.active', 'Active'),
    activeYes: t('catalog.serviceLines.table.activeYes', 'Active'),
    activeNo: t('catalog.serviceLines.table.activeNo', 'Inactive'),
    search: t('catalog.serviceLines.search.placeholder', 'Search by code or title…'),
    empty: t('catalog.serviceLines.table.empty', 'No service lines yet.'),
  }), [t])

  const columns = React.useMemo<ColumnDef<ServiceLine>[]>(() => [
    {
      accessorKey: 'code',
      header: tableLabels.code,
      cell: ({ row }) => <span className="font-mono lowercase">{row.original.code}</span>,
    },
    {
      accessorKey: 'title',
      header: tableLabels.title,
      cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
    },
    {
      accessorKey: 'sortOrder',
      header: tableLabels.sortOrder,
      cell: ({ row }) => <span className="tabular-nums">{row.original.sortOrder}</span>,
    },
    {
      id: 'active',
      header: tableLabels.active,
      cell: ({ row }) =>
        row.original.isActive ? (
          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-100">
            {tableLabels.activeYes}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium">
            {tableLabels.activeNo}
          </span>
        ),
    },
  ], [tableLabels])

  const filteredItems = React.useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return items
    return items.filter((item) => {
      return (
        item.code.toLowerCase().includes(term) ||
        item.title.toLowerCase().includes(term) ||
        (item.description ?? '').toLowerCase().includes(term)
      )
    })
  }, [items, search])

  const handleRowClick = React.useCallback((entry: ServiceLine) => {
    openDialog({ mode: 'edit', entry })
  }, [openDialog])

  return (
    <>
      <section className="border bg-card text-card-foreground shadow-sm">
        <div className="border-b px-6 py-4 space-y-1">
          <h2 className="text-lg font-semibold">{t('catalog.serviceLines.title', 'Service lines')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('catalog.serviceLines.description', 'Define business lines for products and services (e.g. financing, insurance). Assign them on each product.')}
          </p>
        </div>
        <div className="px-2 py-4 sm:px-4">
          <DataTable<ServiceLine>
            data={filteredItems}
            columns={columns}
            embedded
            isLoading={loading}
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder={tableLabels.search}
            emptyState={<p className="py-8 text-center text-sm text-muted-foreground">{tableLabels.empty}</p>}
            actions={(
              <Button size="sm" onClick={() => openDialog({ mode: 'create' })}>
                {t('catalog.serviceLines.actions.add', 'Add service line')}
              </Button>
            )}
            refreshButton={{
              label: t('catalog.serviceLines.actions.refresh', 'Refresh'),
              onRefresh: () => { void loadItems() },
              isRefreshing: loading,
            }}
            rowActions={(entry) => (
              <RowActions
                items={[
                  {
                    id: 'edit',
                    label: t('catalog.serviceLines.actions.edit', 'Edit'),
                    onSelect: () => openDialog({ mode: 'edit', entry }),
                  },
                  {
                    id: 'delete',
                    label: t('catalog.serviceLines.actions.delete', 'Delete'),
                    destructive: true,
                    onSelect: () => { void handleDelete(entry) },
                  },
                ]}
              />
            )}
            onRowClick={handleRowClick}
          />
        </div>
        <Dialog open={dialog !== null} onOpenChange={(open) => { if (!open) closeDialog(); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {dialog?.mode === 'edit'
                  ? t('catalog.serviceLines.dialog.editTitle', 'Edit service line')
                  : t('catalog.serviceLines.dialog.createTitle', 'Create service line')}
              </DialogTitle>
              <DialogDescription>
                {dialog?.mode === 'edit'
                  ? t('catalog.serviceLines.dialog.editDescription', 'Update labels or sort order for this service line.')
                  : t('catalog.serviceLines.dialog.createDescription', 'Define a reusable service line for classifying products.')}
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onKeyDown={formKeyHandler} onSubmit={(event) => { event.preventDefault(); void handleSubmit() }}>
              <div className="space-y-2">
                <Label htmlFor="service-line-code">{t('catalog.serviceLines.form.codeLabel', 'Code')}</Label>
                <Input
                  id="service-line-code"
                  value={form.code}
                  onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                  placeholder={t('catalog.serviceLines.form.codePlaceholder', 'e.g. financing')}
                  className="font-mono lowercase"
                  disabled={dialog?.mode === 'edit'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-line-title">{t('catalog.serviceLines.form.titleLabel', 'Title')}</Label>
                <Input
                  id="service-line-title"
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder={t('catalog.serviceLines.form.titlePlaceholder', 'e.g. Financing')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-line-description">{t('catalog.serviceLines.form.descriptionLabel', 'Description')}</Label>
                <Textarea
                  id="service-line-description"
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder={t('catalog.serviceLines.form.descriptionPlaceholder', 'Optional details shown internally.')}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-line-sort">{t('catalog.serviceLines.form.sortOrderLabel', 'Sort order')}</Label>
                <Input
                  id="service-line-sort"
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: event.target.value }))}
                />
              </div>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border"
                  checked={form.isActive}
                  onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                />
                {t('catalog.serviceLines.form.activeLabel', 'Active')}
              </label>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </form>
            <DialogFooter>
              <Button variant="ghost" onClick={closeDialog}>
                {t('catalog.serviceLines.actions.cancel', 'Cancel')}
              </Button>
              <Button onClick={() => void handleSubmit()} disabled={submitting}>
                {dialog?.mode === 'edit'
                  ? t('catalog.serviceLines.actions.saveChanges', 'Save changes')
                  : t('catalog.serviceLines.actions.create', 'Create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
      {ConfirmDialogElement}
    </>
  )
}
