"use client"

import * as React from 'react'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@open-mercato/ui/primitives/dialog'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { Button } from '@open-mercato/ui/primitives/button'
import { Label } from '@open-mercato/ui/primitives/label'
import { cn } from '@open-mercato/shared/lib/utils'
import { CRUD_FORM_TEXT_INPUT_CLASS } from '@open-mercato/ui/backend/CrudForm'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { apiCallOrThrow, readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import {
  AppearanceSelector,
  type AppearanceSelectorLabels,
} from '@open-mercato/core/modules/dictionaries/components/AppearanceSelector'
import { ProtectionCatalogLucideIcon } from '../../lib/catalogLucideIcon'

type StatusEntry = {
  value: string
  label: string
  icon?: string
  color?: string
}

type StatusPayload = { entries: StatusEntry[] }

type DialogState =
  | { mode: 'create'; draft: StatusEntry }
  | { mode: 'edit'; originalValue: string; draft: StatusEntry }

type StatusRow = {
  id: string
  value: string
  label: string
  icon?: string
  color?: string
}

function emptyEntry(): StatusEntry {
  return { value: '', label: '', icon: '', color: '' }
}

function normalizePayload(raw: unknown): StatusPayload {
  if (!raw || typeof raw !== 'object') return { entries: [] }
  const o = raw as Record<string, unknown>
  const entries = o.entries
  if (!Array.isArray(entries)) return { entries: [] }
  return {
    entries: entries.filter((x) => x && typeof x === 'object') as StatusEntry[],
  }
}

export function InsurerStatusDictionarySection() {
  const t = useT()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [payload, setPayload] = React.useState<StatusPayload>({ entries: [] })
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [dialog, setDialog] = React.useState<DialogState | null>(null)

  const errorLoad = t('insurance_desk.config.insurerStatus.error.load', 'Failed to load insurer status dictionary.')
  const errorSave = t('insurance_desk.config.insurerStatus.error.save', 'Failed to save.')
  const successSave = t('insurance_desk.config.insurerStatus.success.save', 'Saved.')

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const data = await readApiResultOrThrow<StatusPayload>(
        '/api/insurance/config-insurer-status',
        undefined,
        { errorMessage: errorLoad },
      )
      setPayload(normalizePayload(data))
    } catch (err) {
      console.error('insurer status dictionary load', err)
      flash(errorLoad, 'error')
    } finally {
      setLoading(false)
    }
  }, [errorLoad])

  React.useEffect(() => {
    void load()
  }, [load])

  const persist = React.useCallback(
    async (next: StatusPayload) => {
      setSaving(true)
      try {
        const call = await apiCallOrThrow<StatusPayload>(
          '/api/insurance/config-insurer-status',
          {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(next),
          },
          { errorMessage: errorSave },
        )
        if (call.result) {
          setPayload(normalizePayload(call.result))
        } else {
          setPayload(next)
        }
        flash(successSave, 'success')
      } catch (err) {
        console.error('insurer status dictionary save', err)
        const msg = err instanceof Error ? err.message : errorSave
        flash(msg, 'error')
      } finally {
        setSaving(false)
      }
    },
    [errorSave, successSave],
  )

  const rows: StatusRow[] = React.useMemo(
    () =>
      payload.entries.map((e) => ({
        id: e.value,
        value: e.value,
        label: e.label,
        icon: e.icon,
        color: e.color,
      })),
    [payload.entries],
  )

  const [search, setSearch] = React.useState('')
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'label', desc: false }])
  const [page, setPage] = React.useState(1)
  const pageSize = 50

  const filtered = React.useMemo(() => {
    if (!search.trim()) return rows
    const term = search.trim().toLowerCase()
    return rows.filter(
      (r) =>
        r.value.toLowerCase().includes(term) ||
        r.label.toLowerCase().includes(term),
    )
  }, [rows, search])

  const paginated = React.useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))

  const columns = React.useMemo<ColumnDef<StatusRow>[]>(
    () => [
      {
        id: 'icon',
        header: () => <span className="sr-only">{t('insurance_desk.config.insurerStatus.columns.icon', 'Icon')}</span>,
        enableSorting: false,
        meta: { className: 'w-10 text-center' },
        cell: ({ row }) => (
          <div className="flex justify-center">
            <ProtectionCatalogLucideIcon name={row.original.icon} className="size-5 text-muted-foreground" />
          </div>
        ),
      },
      {
        accessorKey: 'value',
        header: t('insurance_desk.config.insurerStatus.columns.value', 'Value'),
        cell: ({ getValue }) => <span className="font-mono text-sm">{String(getValue() ?? '')}</span>,
      },
      {
        accessorKey: 'label',
        header: t('insurance_desk.config.insurerStatus.columns.name', 'Name'),
      },
      {
        id: 'color',
        header: t('insurance_desk.config.insurerStatus.columns.color', 'Color'),
        enableSorting: false,
        cell: ({ row }) => {
          const c = row.original.color?.trim()
          if (!c?.length) return <span className="text-muted-foreground">—</span>
          return (
            <span className="inline-flex items-center gap-2">
              <span className="inline-block size-4 rounded border border-border" style={{ backgroundColor: c }} />
              <span className="font-mono text-xs">{c}</span>
            </span>
          )
        },
      },
    ],
    [t],
  )

  const appearanceLabels = React.useMemo<AppearanceSelectorLabels>(
    () => ({
      colorLabel: t('dictionaries.config.entries.dialog.colorLabel', 'Color'),
      colorHelp: t('dictionaries.config.entries.dialog.colorHelp', 'Pick a highlight color for this entry.'),
      colorClearLabel: t('dictionaries.config.entries.dialog.colorClear', 'Remove color'),
      iconLabel: t('dictionaries.config.entries.dialog.iconLabel', 'Icon or emoji'),
      iconPlaceholder: t('dictionaries.config.entries.dialog.iconPlaceholder', 'Type an emoji or icon token.'),
      iconPickerTriggerLabel: t('dictionaries.config.entries.dialog.iconBrowse', 'Browse icons and emoji'),
      iconSearchPlaceholder: t('dictionaries.config.entries.dialog.iconSearchPlaceholder', 'Search icons or emojis…'),
      iconSearchEmptyLabel: t('dictionaries.config.entries.dialog.iconSearchEmpty', 'No icons match your search.'),
      iconSuggestionsLabel: t('dictionaries.config.entries.dialog.iconSuggestions', 'Suggestions'),
      iconClearLabel: t('dictionaries.config.entries.dialog.iconClear', 'Remove icon'),
      previewEmptyLabel: t('dictionaries.config.entries.dialog.previewEmpty', 'No appearance selected'),
    }),
    [t],
  )

  const openCreate = React.useCallback(() => {
    setDialog({ mode: 'create', draft: emptyEntry() })
  }, [])

  const openEdit = React.useCallback((row: StatusRow) => {
    const full = payload.entries.find((e) => e.value === row.value)
    if (!full) return
    setDialog({
      mode: 'edit',
      originalValue: full.value,
      draft: {
        value: full.value,
        label: full.label,
        icon: full.icon ?? '',
        color: full.color ?? '',
      },
    })
  }, [payload.entries])

  const closeDialog = React.useCallback(() => setDialog(null), [])

  const deleteConfirm = t('insurance_desk.config.insurerStatus.deleteConfirm', 'Delete status "{{label}}"?')

  const handleDelete = React.useCallback(
    async (row: StatusRow) => {
      const message = deleteConfirm.replace('{{label}}', row.label || row.value)
      const confirmed = await confirm({ title: message, variant: 'destructive' })
      if (!confirmed) return
      const nextEntries = payload.entries.filter((e) => e.value !== row.value)
      await persist({ entries: nextEntries })
    },
    [confirm, deleteConfirm, payload.entries, persist],
  )

  const submitDialog = React.useCallback(async () => {
    if (!dialog) return
    const { draft } = dialog
    const valueTrim = draft.value.trim()
    const labelTrim = draft.label.trim()
    if (!valueTrim.length || !labelTrim.length) {
      flash(t('insurance_desk.config.insurerStatus.errors.required', 'Value and name are required.'), 'error')
      return
    }
    const iconTrim = draft.icon?.trim() ?? ''
    const colorTrim = draft.color?.trim() ?? ''
    const normalized: StatusEntry = {
      value: valueTrim,
      label: labelTrim,
      icon: iconTrim.length ? iconTrim : undefined,
      color: colorTrim.length ? colorTrim : undefined,
    }
    let nextEntries: StatusEntry[]
    if (dialog.mode === 'create') {
      if (payload.entries.some((e) => e.value === normalized.value)) {
        flash(t('insurance_desk.config.insurerStatus.errors.duplicate', 'This value already exists.'), 'error')
        return
      }
      nextEntries = [...payload.entries, normalized]
    } else {
      const orig = dialog.originalValue
      if (normalized.value !== orig && payload.entries.some((e) => e.value === normalized.value)) {
        flash(t('insurance_desk.config.insurerStatus.errors.duplicate', 'This value already exists.'), 'error')
        return
      }
      nextEntries = payload.entries.map((e) => (e.value === orig ? normalized : e))
    }
    await persist({ entries: nextEntries })
    closeDialog()
  }, [closeDialog, dialog, payload.entries, persist, t])

  const draft = dialog?.draft ?? null

  const setDraft = React.useCallback(
    (patch: Partial<StatusEntry> | ((prev: StatusEntry) => StatusEntry)) => {
      setDialog((d) => {
        if (!d) return d
        const prev = d.draft
        const nextDraft = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }
        return { ...d, draft: nextDraft }
      })
    },
    [],
  )

  return (
    <section className="rounded border bg-card text-card-foreground shadow-sm">
      <div className="space-y-1 border-b px-6 py-4">
        <h2 className="text-lg font-medium">
          {t('insurance_desk.config.insurerStatus.heading', 'Insurer status')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(
            'insurance_desk.config.insurerStatus.description',
            'Defines insurer (company) statuses for lists and forms (stored value, display name, icon, and color).',
          )}
        </p>
      </div>
      <div className="px-2 py-4 sm:px-4">
        <DataTable<StatusRow>
          title={t('insurance_desk.config.insurerStatus.tableTitle', 'Insurer status dictionary')}
          actions={
            <Button size="sm" onClick={openCreate} disabled={saving}>
              {t('insurance_desk.config.dictionaries.actions.add', 'Add entry')}
            </Button>
          }
          columns={columns}
          data={paginated}
          embedded
          sortable
          sorting={sorting}
          onSortingChange={setSorting}
          searchValue={search}
          onSearchChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          searchPlaceholder={t('insurance_desk.config.dictionaries.searchPlaceholder', 'Search entries…')}
          isLoading={loading}
          emptyState={
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t('insurance_desk.config.insurerStatus.empty', 'No status entries yet.')}
            </p>
          }
          pagination={{
            page,
            pageSize,
            total: filtered.length,
            totalPages,
            onPageChange: setPage,
          }}
          refreshButton={{
            label: t('insurance_desk.config.dictionaries.actions.refresh', 'Refresh'),
            onRefresh: () => void load(),
            isRefreshing: loading,
          }}
          onRowClick={(entry) => openEdit(entry)}
          rowActions={(entry) => (
            <RowActions
              items={[
                {
                  id: 'edit',
                  label: t('insurance_desk.config.dictionaries.actions.edit', 'Edit'),
                  onSelect: () => openEdit(entry),
                },
                {
                  id: 'delete',
                  label: t('insurance_desk.config.dictionaries.actions.delete', 'Delete'),
                  onSelect: () => void handleDelete(entry),
                  destructive: true,
                },
              ]}
            />
          )}
        />
      </div>

      <Dialog open={dialog !== null} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === 'edit'
                ? t('insurance_desk.config.dictionaries.dialog.editTitle', 'Edit entry')
                : t('insurance_desk.config.dictionaries.dialog.addTitle', 'Add entry')}
            </DialogTitle>
          </DialogHeader>
          {draft ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="is-value">{t('insurance_desk.config.insurerStatus.form.value', 'Value *')}</Label>
                <input
                  id="is-value"
                  className={cn(CRUD_FORM_TEXT_INPUT_CLASS, 'font-mono')}
                  value={draft.value}
                  onChange={(e) => setDraft({ value: e.target.value })}
                  disabled={dialog?.mode === 'edit'}
                  data-crud-focus-target=""
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="is-label">{t('insurance_desk.config.insurerStatus.form.name', 'Name *')}</Label>
                <input
                  id="is-label"
                  className={CRUD_FORM_TEXT_INPUT_CLASS}
                  value={draft.label}
                  onChange={(e) => setDraft({ label: e.target.value })}
                  data-crud-focus-target=""
                />
              </div>
              <AppearanceSelector
                className="space-y-3"
                icon={draft.icon?.trim() ? draft.icon : null}
                color={draft.color?.trim() ? draft.color : null}
                onIconChange={(next) => setDraft({ icon: next ?? '' })}
                onColorChange={(next) => setDraft({ color: next ?? '' })}
                labels={appearanceLabels}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={closeDialog}>
                  {t('insurance_desk.config.dictionaries.dialog.cancel', 'Cancel')}
                </Button>
                <Button type="button" onClick={() => void submitDialog()} disabled={saving}>
                  {t('insurance_desk.config.dictionaries.dialog.save', 'Save')}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      {ConfirmDialogElement}
    </section>
  )
}
