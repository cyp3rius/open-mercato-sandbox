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
import { RowActions, type RowActionItem } from '@open-mercato/ui/backend/RowActions'
import { Button } from '@open-mercato/ui/primitives/button'
import { Label } from '@open-mercato/ui/primitives/label'
import { cn } from '@open-mercato/shared/lib/utils'
import {
  CRUD_FORM_SELECT_CLASS,
  CRUD_FORM_TEXT_INPUT_CLASS,
  CRUD_FORM_TEXTAREA_CLASS,
} from '@open-mercato/ui/backend/CrudForm'
import { Checkbox } from '@open-mercato/ui/primitives/checkbox'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { apiCallOrThrow, readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { Separator } from '@open-mercato/ui/primitives/separator'
import {
  AppearanceSelector,
  type AppearanceSelectorLabels,
} from '@open-mercato/core/modules/dictionaries/components/AppearanceSelector'
import { ProtectionCatalogLucideIcon } from '../../lib/catalogLucideIcon'

type CatalogAdditional = { value: string; name: string }

type CatalogField = {
  id: string
  label: string
  propertyKey: string
  type: 'text' | 'number' | 'currency' | 'checkbox'
  required?: boolean
}

export type CatalogEntry = {
  value: string
  label: string
  description: string
  icon?: string
  mapsToCoverageKey?: string
  additionalOptionsLabel?: string
  additionalOptions: CatalogAdditional[]
  fields: CatalogField[]
}

type CatalogPayload = { options: CatalogEntry[] }

type ScopeDialogState =
  | { mode: 'create'; draft: CatalogEntry }
  | { mode: 'edit'; originalValue: string; draft: CatalogEntry }

type ScopeTableRow = {
  id: string
  icon?: string
  value: string
  label: string
  description: string
  mapsToCoverageKey: string
}

function emptyEntry(): CatalogEntry {
  return {
    value: '',
    label: '',
    description: '',
    icon: '',
    mapsToCoverageKey: '',
    additionalOptionsLabel: '',
    additionalOptions: [],
    fields: [],
  }
}

function normalizeCatalog(raw: unknown): CatalogPayload {
  if (!raw || typeof raw !== 'object') return { options: [] }
  const o = raw as Record<string, unknown>
  const opts = o.options
  if (!Array.isArray(opts)) return { options: [] }
  return { options: opts.filter((x) => x && typeof x === 'object') as CatalogEntry[] }
}

export function ProtectionScopeDictionarySection() {
  const t = useT()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [catalog, setCatalog] = React.useState<CatalogPayload>({ options: [] })
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [dialog, setDialog] = React.useState<ScopeDialogState | null>(null)

  const errorLoad = t('insurance_desk.config.dictionaries.error.load', 'Failed to load catalog.')
  const errorSave = t('insurance_desk.config.dictionaries.error.save', 'Failed to save catalog.')
  const successSave = t('insurance_desk.config.dictionaries.success.save', 'Saved.')
  const deleteConfirm = t('insurance_desk.config.dictionaries.deleteConfirm', 'Delete "{{value}}"?')

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const data = await readApiResultOrThrow<CatalogPayload>(
        '/api/insurance/config-protection-catalog',
        undefined,
        { errorMessage: errorLoad },
      )
      setCatalog(normalizeCatalog(data))
    } catch (err) {
      console.error('protection catalog load', err)
      flash(errorLoad, 'error')
    } finally {
      setLoading(false)
    }
  }, [errorLoad])

  React.useEffect(() => {
    void load()
  }, [load])

  const persist = React.useCallback(
    async (next: CatalogPayload) => {
      setSaving(true)
      try {
        const call = await apiCallOrThrow<CatalogPayload>(
          '/api/insurance/config-protection-catalog',
          {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(next),
          },
          { errorMessage: errorSave },
        )
        if (call.result) {
          setCatalog(normalizeCatalog(call.result))
        } else {
          setCatalog(next)
        }
        flash(successSave, 'success')
      } catch (err) {
        console.error('protection catalog save', err)
        const msg = err instanceof Error ? err.message : errorSave
        flash(msg, 'error')
      } finally {
        setSaving(false)
      }
    },
    [errorSave, successSave],
  )

  const rows: ScopeTableRow[] = React.useMemo(
    () =>
      catalog.options.map((o) => ({
        id: o.value,
        icon: o.icon,
        value: o.value,
        label: o.label,
        description: o.description,
        mapsToCoverageKey: o.mapsToCoverageKey ?? '',
      })),
    [catalog.options],
  )

  const [search, setSearch] = React.useState('')
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'value', desc: false }])
  const [page, setPage] = React.useState(1)
  const pageSize = 50

  const filtered = React.useMemo(() => {
    if (!search.trim()) return rows
    const term = search.trim().toLowerCase()
    return rows.filter(
      (r) =>
        r.value.toLowerCase().includes(term) ||
        r.label.toLowerCase().includes(term) ||
        r.description.toLowerCase().includes(term) ||
        r.mapsToCoverageKey.toLowerCase().includes(term),
    )
  }, [rows, search])

  const paginated = React.useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))

  const columns = React.useMemo<ColumnDef<ScopeTableRow>[]>(
    () => [
      {
        id: 'icon',
        header: () => (
          <span className="sr-only">
            {t('insurance_desk.config.dictionaries.coverageScope.columns.icon', 'Icon')}
          </span>
        ),
        enableSorting: false,
        meta: {
          priority: 0,
          className: 'w-10 min-w-10 max-w-10 px-1.5 text-center',
        },
        cell: ({ row }) => (
          <div className="flex justify-center">
            <ProtectionCatalogLucideIcon name={row.original.icon} className="size-5 text-muted-foreground" />
          </div>
        ),
      },
      {
        accessorKey: 'value',
        header: t('insurance_desk.config.dictionaries.coverageScope.columns.value', 'Value'),
        meta: { priority: 1 },
        cell: ({ getValue }) => <span className="font-medium">{String(getValue() ?? '')}</span>,
      },
      {
        accessorKey: 'label',
        header: t('insurance_desk.config.dictionaries.coverageScope.columns.label', 'Label'),
        meta: { priority: 2 },
      },
      {
        accessorKey: 'mapsToCoverageKey',
        header: t('insurance_desk.config.dictionaries.coverageScope.columns.mapsTo', 'Maps to key'),
        meta: { priority: 3 },
        cell: ({ getValue }) => {
          const v = String(getValue() ?? '')
          return v.length ? <span className="font-mono text-xs">{v}</span> : <span className="text-muted-foreground">—</span>
        },
      },
      {
        accessorKey: 'description',
        header: t('insurance_desk.config.dictionaries.coverageScope.columns.description', 'Description'),
        meta: { priority: 4 },
        cell: ({ getValue }) => (
          <span className="line-clamp-2 text-sm text-muted-foreground">{String(getValue() ?? '')}</span>
        ),
      },
    ],
    [t],
  )

  const tableTitle = t('insurance_desk.config.dictionaries.coverageScope.title', 'Coverage scope')
  const searchPlaceholder = t('insurance_desk.config.dictionaries.searchPlaceholder', 'Search entries…')
  const emptyLabel = t('insurance_desk.config.dictionaries.empty', 'No entries yet.')
  const addLabel = t('insurance_desk.config.dictionaries.actions.add', 'Add entry')
  const editLabel = t('insurance_desk.config.dictionaries.actions.edit', 'Edit')
  const deleteLabel = t('insurance_desk.config.dictionaries.actions.delete', 'Delete')
  const refreshLabel = t('insurance_desk.config.dictionaries.actions.refresh', 'Refresh')

  const openCreate = React.useCallback(() => {
    setDialog({ mode: 'create', draft: emptyEntry() })
  }, [])

  const openEdit = React.useCallback((row: ScopeTableRow) => {
    const full = catalog.options.find((o) => o.value === row.value)
    if (!full) return
    setDialog({
      mode: 'edit',
      originalValue: full.value,
      draft: {
        value: full.value,
        label: full.label,
        description: full.description,
        icon: full.icon ?? '',
        mapsToCoverageKey: full.mapsToCoverageKey ?? '',
        additionalOptionsLabel: full.additionalOptionsLabel ?? '',
        additionalOptions: full.additionalOptions?.length ? [...full.additionalOptions] : [],
        fields: full.fields?.length ? [...full.fields] : [],
      },
    })
  }, [catalog.options])

  const closeDialog = React.useCallback(() => setDialog(null), [])

  const handleDelete = React.useCallback(
    async (row: ScopeTableRow) => {
      const message = deleteConfirm.replace('{{value}}', row.label || row.value)
      const confirmed = await confirm({ title: message, variant: 'destructive' })
      if (!confirmed) return
      const nextOptions = catalog.options.filter((o) => o.value !== row.value)
      await persist({ options: nextOptions })
    },
    [catalog.options, confirm, deleteConfirm, persist],
  )

  const submitDialog = React.useCallback(async () => {
    if (!dialog || !('draft' in dialog)) return
    const { draft } = dialog

    const valueTrim = draft.value.trim()
    const labelTrim = draft.label.trim()
    const descriptionTrim = draft.description.trim()
    if (!valueTrim.length || !labelTrim.length || !descriptionTrim.length) {
      flash(
        t(
          'insurance_desk.config.dictionaries.coverageScope.errors.requiredCore',
          'Value, label, and description are required.',
        ),
        'error',
      )
      return
    }

    const iconTrim = draft.icon?.trim() ?? ''
    const normalized: CatalogEntry = {
      value: valueTrim,
      label: labelTrim,
      description: descriptionTrim,
      icon: iconTrim.length ? iconTrim : undefined,
      mapsToCoverageKey: draft.mapsToCoverageKey?.trim().length ? draft.mapsToCoverageKey.trim() : undefined,
      additionalOptionsLabel: draft.additionalOptionsLabel?.trim().length
        ? draft.additionalOptionsLabel.trim()
        : undefined,
      additionalOptions: (draft.additionalOptions ?? [])
        .filter((a) => a.value.trim().length && a.name.trim().length)
        .map((a) => ({ value: a.value.trim(), name: a.name.trim() })),
      fields: (draft.fields ?? [])
        .filter((f) => f.id.trim().length && f.label.trim().length && f.propertyKey.trim().length)
        .map((f) => ({
          id: f.id.trim(),
          label: f.label.trim(),
          propertyKey: f.propertyKey.trim(),
          type: f.type,
          required: f.required === true,
        })),
    }

    let nextOptions: CatalogEntry[]
    if (dialog.mode === 'create') {
      if (catalog.options.some((o) => o.value === normalized.value)) {
        flash(
          t('insurance_desk.config.dictionaries.coverageScope.errors.duplicate', 'An entry with this value already exists.'),
          'error',
        )
        return
      }
      nextOptions = [...catalog.options, normalized]
    } else {
      const orig = dialog.originalValue
      if (normalized.value !== orig && catalog.options.some((o) => o.value === normalized.value)) {
        flash(
          t('insurance_desk.config.dictionaries.coverageScope.errors.duplicate', 'An entry with this value already exists.'),
          'error',
        )
        return
      }
      nextOptions = catalog.options.map((o) => (o.value === orig ? normalized : o))
    }

    await persist({ options: nextOptions })
    closeDialog()
  }, [catalog.options, closeDialog, dialog, persist, t])

  const draft =
    dialog && 'draft' in dialog
      ? dialog.draft
      : null

  const dictionaryAppearanceLabels = React.useMemo<AppearanceSelectorLabels>(
    () => ({
      colorLabel: t('dictionaries.config.entries.dialog.colorLabel', 'Color'),
      colorHelp: t('dictionaries.config.entries.dialog.colorHelp', 'Pick a highlight color for this entry.'),
      colorClearLabel: t('dictionaries.config.entries.dialog.colorClear', 'Remove color'),
      iconLabel: t('dictionaries.config.entries.dialog.iconLabel', 'Icon or emoji'),
      iconPlaceholder: t('dictionaries.config.entries.dialog.iconPlaceholder', 'Type an emoji or icon token.'),
      iconPickerTriggerLabel: t('dictionaries.config.entries.dialog.iconBrowse', 'Browse icons and emoji'),
      iconSearchPlaceholder: t(
        'dictionaries.config.entries.dialog.iconSearchPlaceholder',
        'Search icons or emojis…',
      ),
      iconSearchEmptyLabel: t('dictionaries.config.entries.dialog.iconSearchEmpty', 'No icons match your search.'),
      iconSuggestionsLabel: t('dictionaries.config.entries.dialog.iconSuggestions', 'Suggestions'),
      iconClearLabel: t('dictionaries.config.entries.dialog.iconClear', 'Remove icon'),
      previewEmptyLabel: t('dictionaries.config.entries.dialog.previewEmpty', 'No appearance selected'),
    }),
    [t],
  )

  const setDraft = React.useCallback(
    (patch: Partial<CatalogEntry> | ((prev: CatalogEntry) => CatalogEntry)) => {
      setDialog((d) => {
        if (!d || !('draft' in d)) return d
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
          {t('insurance_desk.config.dictionaries.coverageScope.heading', 'Coverage scope')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(
            'insurance_desk.config.dictionaries.coverageScope.description',
            'Defines inquiry coverage types shown in leads (labels, descriptions, optional sub-options and dynamic fields).',
          )}
        </p>
      </div>
      <div className="px-2 py-4 sm:px-4">
        <DataTable<ScopeTableRow>
          title={tableTitle}
          actions={
            <Button size="sm" onClick={openCreate} disabled={saving}>
              {addLabel}
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
          searchPlaceholder={searchPlaceholder}
          isLoading={loading}
          emptyState={<p className="py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>}
          pagination={{
            page,
            pageSize,
            total: filtered.length,
            totalPages,
            onPageChange: setPage,
          }}
          refreshButton={{
            label: refreshLabel,
            onRefresh: () => void load(),
            isRefreshing: loading,
          }}
          onRowClick={(entry) => openEdit(entry)}
          rowActions={(entry) => {
            if (!entry) return null
            const items: RowActionItem[] = [
              { id: 'edit', label: editLabel, onSelect: () => openEdit(entry) },
              {
                id: 'delete',
                label: deleteLabel,
                onSelect: () => void handleDelete(entry),
                destructive: true,
              },
            ]
            return <RowActions items={items} />
          }}
        />
      </div>

      <Dialog open={dialog !== null} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === 'edit'
                ? t('insurance_desk.config.dictionaries.dialog.editTitle', 'Edit entry')
                : t('insurance_desk.config.dictionaries.dialog.addTitle', 'Add entry')}
            </DialogTitle>
          </DialogHeader>
          {draft ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="psc-value">
                    {t('insurance_desk.config.dictionaries.coverageScope.form.valueRequired', 'Value *')}
                  </Label>
                  <input
                    id="psc-value"
                    className={cn(CRUD_FORM_TEXT_INPUT_CLASS, 'font-mono')}
                    value={draft.value}
                    onChange={(e) => setDraft({ value: e.target.value })}
                    disabled={dialog?.mode === 'edit'}
                    data-crud-focus-target=""
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="psc-label">
                    {t('insurance_desk.config.dictionaries.coverageScope.form.labelRequired', 'Label *')}
                  </Label>
                  <input
                    id="psc-label"
                    className={CRUD_FORM_TEXT_INPUT_CLASS}
                    value={draft.label}
                    onChange={(e) => setDraft({ label: e.target.value })}
                    data-crud-focus-target=""
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="psc-desc">
                  {t('insurance_desk.config.dictionaries.coverageScope.form.descriptionRequired', 'Description *')}
                </Label>
                <textarea
                  id="psc-desc"
                  className={cn(CRUD_FORM_TEXTAREA_CLASS, 'min-h-20')}
                  value={draft.description}
                  onChange={(e) => setDraft({ description: e.target.value })}
                  required
                  data-crud-focus-target=""
                />
              </div>
              <div className="space-y-2">
                <AppearanceSelector
                  className="space-y-3"
                  icon={draft.icon?.trim() ? draft.icon : null}
                  color={null}
                  iconOnly
                  onIconChange={(next) => setDraft({ icon: next ?? '' })}
                  onColorChange={() => {}}
                  labels={dictionaryAppearanceLabels}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="psc-map">
                  {t('insurance_desk.config.dictionaries.coverageScope.form.mapsTo', 'Maps to coverage key')}
                </Label>
                <input
                  id="psc-map"
                  className={cn(CRUD_FORM_TEXT_INPUT_CLASS, 'font-mono')}
                  value={draft.mapsToCoverageKey ?? ''}
                  onChange={(e) => setDraft({ mapsToCoverageKey: e.target.value })}
                  placeholder="OC, AC, GLASS…"
                  data-crud-focus-target=""
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="psc-aol">
                  {t(
                    'insurance_desk.config.dictionaries.coverageScope.form.subOptionsSectionHeadingLabel',
                    'Section heading for additional options',
                  )}
                </Label>
                <input
                  id="psc-aol"
                  className={CRUD_FORM_TEXT_INPUT_CLASS}
                  value={draft.additionalOptionsLabel ?? ''}
                  onChange={(e) => setDraft({ additionalOptionsLabel: e.target.value })}
                  data-crud-focus-target=""
                />
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">
                  {t('insurance_desk.config.dictionaries.coverageScope.form.subOptionsSection', 'Additional options')}
                </h3>
                {(draft.additionalOptions ?? []).map((row, idx) => (
                  <div key={idx} className="flex flex-wrap gap-2">
                    <input
                      className={cn(CRUD_FORM_TEXT_INPUT_CLASS, 'max-w-40 font-mono')}
                      placeholder={t('insurance_desk.config.dictionaries.coverageScope.form.optValue', 'Value')}
                      value={row.value}
                      onChange={(e) => {
                        const next = [...(draft.additionalOptions ?? [])]
                        next[idx] = { ...next[idx], value: e.target.value }
                        setDraft({ additionalOptions: next })
                      }}
                      data-crud-focus-target=""
                    />
                    <input
                      className={cn(CRUD_FORM_TEXT_INPUT_CLASS, 'min-w-32 flex-1')}
                      placeholder={t('insurance_desk.config.dictionaries.coverageScope.form.optName', 'Name')}
                      value={row.name}
                      onChange={(e) => {
                        const next = [...(draft.additionalOptions ?? [])]
                        next[idx] = { ...next[idx], name: e.target.value }
                        setDraft({ additionalOptions: next })
                      }}
                      data-crud-focus-target=""
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const next = (draft.additionalOptions ?? []).filter((_, i) => i !== idx)
                        setDraft({ additionalOptions: next })
                      }}
                    >
                      {t('insurance_desk.config.dictionaries.coverageScope.form.removeRow', 'Remove')}
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setDraft({ additionalOptions: [...(draft.additionalOptions ?? []), { value: '', name: '' }] })
                  }
                >
                  {t('insurance_desk.config.dictionaries.coverageScope.form.addOption', 'Add option')}
                </Button>
              </div>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">
                  {t('insurance_desk.config.dictionaries.coverageScope.form.fieldsSection', 'Dynamic fields')}
                </h3>
                {(draft.fields ?? []).map((field, idx) => (
                  <div
                    key={idx}
                    className="grid gap-2 rounded-md border border-border/60 p-3 sm:grid-cols-2 lg:grid-cols-12"
                  >
                    <div className="space-y-1 lg:col-span-2">
                      <Label className="text-xs">{t('insurance_desk.config.dictionaries.coverageScope.form.fieldId', 'Id')}</Label>
                      <input
                        className={cn(CRUD_FORM_TEXT_INPUT_CLASS, 'font-mono')}
                        value={field.id}
                        onChange={(e) => {
                          const next = [...(draft.fields ?? [])]
                          next[idx] = { ...next[idx], id: e.target.value }
                          setDraft({ fields: next })
                        }}
                        data-crud-focus-target=""
                      />
                    </div>
                    <div className="space-y-1 lg:col-span-3">
                      <Label className="text-xs">{t('insurance_desk.config.dictionaries.coverageScope.form.fieldLabel', 'Label')}</Label>
                      <input
                        className={CRUD_FORM_TEXT_INPUT_CLASS}
                        value={field.label}
                        onChange={(e) => {
                          const next = [...(draft.fields ?? [])]
                          next[idx] = { ...next[idx], label: e.target.value }
                          setDraft({ fields: next })
                        }}
                        data-crud-focus-target=""
                      />
                    </div>
                    <div className="space-y-1 lg:col-span-3">
                      <Label className="text-xs">{t('insurance_desk.config.dictionaries.coverageScope.form.fieldKey', 'Property key')}</Label>
                      <input
                        className={cn(CRUD_FORM_TEXT_INPUT_CLASS, 'font-mono')}
                        value={field.propertyKey}
                        onChange={(e) => {
                          const next = [...(draft.fields ?? [])]
                          next[idx] = { ...next[idx], propertyKey: e.target.value }
                          setDraft({ fields: next })
                        }}
                        data-crud-focus-target=""
                      />
                    </div>
                    <div className="space-y-1 lg:col-span-2">
                      <Label className="text-xs">{t('insurance_desk.config.dictionaries.coverageScope.form.fieldType', 'Type')}</Label>
                      <select
                        className={CRUD_FORM_SELECT_CLASS}
                        value={field.type}
                        onChange={(e) => {
                          const next = [...(draft.fields ?? [])]
                          next[idx] = {
                            ...next[idx],
                            type: e.target.value as CatalogField['type'],
                          }
                          setDraft({ fields: next })
                        }}
                      >
                        <option value="text">text</option>
                        <option value="number">number</option>
                        <option value="currency">currency</option>
                        <option value="checkbox">checkbox</option>
                      </select>
                    </div>
                    <div className="flex items-end gap-2 lg:col-span-2">
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={field.required === true}
                          onCheckedChange={(c) => {
                            const next = [...(draft.fields ?? [])]
                            next[idx] = { ...next[idx], required: c === true }
                            setDraft({ fields: next })
                          }}
                        />
                        {t('insurance_desk.config.dictionaries.coverageScope.form.required', 'Required')}
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const next = (draft.fields ?? []).filter((_, i) => i !== idx)
                          setDraft({ fields: next })
                        }}
                      >
                        {t('insurance_desk.config.dictionaries.coverageScope.form.removeRow', 'Remove')}
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setDraft({
                      fields: [
                        ...(draft.fields ?? []),
                        { id: '', label: '', propertyKey: '', type: 'text', required: false },
                      ],
                    })
                  }
                >
                  {t('insurance_desk.config.dictionaries.coverageScope.form.addField', 'Add field')}
                </Button>
              </div>
              <Separator />
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
