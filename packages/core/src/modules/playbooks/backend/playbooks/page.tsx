'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Download, Plus, Upload } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import type { FilterDef, FilterValues } from '@open-mercato/ui/backend/FilterBar'
import { Button } from '@open-mercato/ui/primitives/button'
import { IconButton } from '@open-mercato/ui/primitives/icon-button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { parsePlaybookBooleanField } from '../../lib/playbookFields'
import { exportPlaybooksMarkdownByIds } from '../../lib/playbookMarkdownClientExport'

const PAGE_SIZE = 20

const PLAYBOOK_ACTIVE_FILTER_ID = 'playbookActive' as const

type PlaybookActiveFilterValue = 'all' | 'active' | 'inactive'

type PlaybookRow = {
  id: string
  slug: string
  title: string
  audience?: string
  version?: number
  isActive?: boolean
  updatedAt?: string | null
}

type FromMarkdownBatchResponse = {
  ok?: boolean
  results?: Array<{ ok?: boolean; action?: string; slug?: string | null; error?: string }>
  summary?: { total?: number; succeeded?: number; failed?: number }
  action?: string
  slug?: string
  error?: string
}

function normalizePlaybookListItem(raw: Record<string, unknown>): PlaybookRow {
  const active = parsePlaybookBooleanField(raw.isActive, raw.is_active)
  return {
    id: typeof raw.id === 'string' ? raw.id : '',
    slug: typeof raw.slug === 'string' ? raw.slug : '',
    title: typeof raw.title === 'string' ? raw.title : '',
    audience: typeof raw.audience === 'string' ? raw.audience : undefined,
    version: typeof raw.version === 'number' ? raw.version : undefined,
    isActive: active === undefined ? undefined : active,
    updatedAt:
      typeof raw.updatedAt === 'string'
        ? raw.updatedAt
        : typeof raw.updated_at === 'string'
          ? raw.updated_at
          : null,
  }
}

function playbookAudienceCellLabel(
  audience: string | undefined,
  t: (key: string, fallback?: string) => string,
): string {
  if (audience === 'customer_facing') return t('playbooks.form.audienceCustomer', 'Customer-facing')
  if (audience === 'both') return t('playbooks.form.audienceBoth', 'Both')
  return t('playbooks.form.audienceInternal', 'Internal')
}

function extractMarkdownDocumentsFromJson(parsed: unknown): string[] {
  if (typeof parsed === 'string' && parsed.trim()) return [parsed]
  if (Array.isArray(parsed)) {
    const docs: string[] = []
    for (const entry of parsed) {
      if (typeof entry === 'string' && entry.trim()) {
        docs.push(entry)
        continue
      }
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        const markdown = (entry as { markdown?: unknown }).markdown
        if (typeof markdown === 'string' && markdown.trim()) docs.push(markdown)
      }
    }
    return docs
  }
  if (!parsed || typeof parsed !== 'object') return []
  const record = parsed as {
    documents?: unknown
    items?: unknown
    markdown?: unknown
  }
  if (typeof record.markdown === 'string' && record.markdown.trim()) {
    return [record.markdown]
  }
  if (Array.isArray(record.documents)) {
    return record.documents.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  }
  if (Array.isArray(record.items)) {
    const docs: string[] = []
    for (const item of record.items) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      const markdown = (item as { markdown?: unknown }).markdown
      if (typeof markdown === 'string' && markdown.trim()) docs.push(markdown)
    }
    return docs
  }
  return []
}

async function readMarkdownDocumentsFromFiles(files: FileList | File[]): Promise<string[]> {
  const list = Array.from(files)
  const documents: string[] = []
  for (const file of list) {
    const text = await file.text()
    const lower = file.name.toLowerCase()
    if (lower.endsWith('.json')) {
      let parsed: unknown
      try {
        parsed = JSON.parse(text) as unknown
      } catch {
        throw new Error(`Invalid JSON in ${file.name}`)
      }
      const extracted = extractMarkdownDocumentsFromJson(parsed)
      if (extracted.length === 0) {
        throw new Error(`No markdown documents found in ${file.name}`)
      }
      documents.push(...extracted)
      continue
    }
    if (!text.trim()) continue
    documents.push(text)
  }
  return documents
}

type ListResponse = {
  items: PlaybookRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export default function PlaybooksListPage() {
  const router = useRouter()
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const importInputRef = React.useRef<HTMLInputElement>(null)
  const [rows, setRows] = React.useState<PlaybookRow[]>([])
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [search, setSearch] = React.useState('')
  const [filterValues, setFilterValues] = React.useState<FilterValues>({
    [PLAYBOOK_ACTIVE_FILTER_ID]: 'active' satisfies PlaybookActiveFilterValue,
  })
  const [isLoading, setIsLoading] = React.useState(true)
  const [isImporting, setIsImporting] = React.useState(false)
  const [isExporting, setIsExporting] = React.useState(false)
  const [selectedRows, setSelectedRows] = React.useState<PlaybookRow[]>([])
  const [canManage, setCanManage] = React.useState(false)
  const [reloadToken, setReloadToken] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    async function loadPerm() {
      const call = await apiCall<{ granted?: string[]; ok?: boolean }>('/api/auth/feature-check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ features: ['playbooks.create', 'playbooks.edit', 'playbooks.delete'] }),
      })
      if (cancelled) return
      const granted = Array.isArray(call.result?.granted) ? call.result.granted : []
      const ok =
        call.result?.ok === true ||
        granted.includes('playbooks.create') ||
        granted.includes('playbooks.edit') ||
        granted.includes('playbooks.delete')
      setCanManage(ok)
    }
    void loadPerm()
    return () => {
      cancelled = true
    }
  }, [])

  const filters = React.useMemo<FilterDef[]>(
    () => [
      {
        id: PLAYBOOK_ACTIVE_FILTER_ID,
        label: t('playbooks.list.filters.show', 'Show'),
        type: 'select',
        options: [
          { value: 'all', label: t('playbooks.list.filters.all', 'All') },
          { value: 'active', label: t('playbooks.list.filters.active', 'Active') },
          { value: 'inactive', label: t('playbooks.list.filters.inactive', 'Inactive') },
        ],
      },
    ],
    [t],
  )

  const queryParams = React.useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    if (search.trim()) params.set('search', search.trim())
    const visibility = filterValues[PLAYBOOK_ACTIVE_FILTER_ID]
    if (visibility === 'active') params.set('isActive', 'true')
    else if (visibility === 'inactive') params.set('isActive', 'false')
    return params.toString()
  }, [filterValues, page, search])

  const handleFiltersApply = React.useCallback((values: FilterValues) => {
    const next: FilterValues = {}
    Object.entries(values).forEach(([key, value]) => {
      if (value !== undefined) next[key] = value
    })
    setFilterValues(next)
    setPage(1)
  }, [])

  const handleFiltersClear = React.useCallback(() => {
    setFilterValues({})
    setPage(1)
  }, [])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const call = await apiCall<ListResponse>(`/api/playbooks?${queryParams}`)
        if (cancelled) return
        if (!call.ok || !call.result) {
          flash(t('playbooks.list.errors.load', 'Failed to load playbooks.'), 'error')
          setRows([])
          return
        }
        const rawItems: unknown[] = Array.isArray(call.result.items) ? call.result.items : []
        setRows(
          rawItems
            .filter((item) => item != null && typeof item === 'object' && !Array.isArray(item))
            .map((item) => normalizePlaybookListItem(item as Record<string, unknown>)),
        )
        setTotalPages(typeof call.result.totalPages === 'number' ? call.result.totalPages : 1)
        setTotal(typeof call.result.total === 'number' ? call.result.total : 0)
      } catch {
        if (!cancelled) flash(t('playbooks.list.errors.load', 'Failed to load playbooks.'), 'error')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [queryParams, reloadToken, scopeVersion, t])

  const handleRefresh = React.useCallback(() => {
    setReloadToken((x) => x + 1)
  }, [])

  const handleDelete = React.useCallback(
    async (row: PlaybookRow) => {
      if (!row?.id) return
      const ok = await confirm({
        title: t('playbooks.list.deleteTitle', 'Delete playbook?'),
        text: t('playbooks.list.deleteMessage', 'This will soft-delete the playbook.'),
        confirmText: t('common.delete', 'Delete'),
        variant: 'destructive',
      })
      if (!ok) return
      const result = await deleteCrud('playbooks', { id: row.id })
      if (!result.ok) {
        flash(t('playbooks.list.errors.delete', 'Could not delete playbook.'), 'error')
        return
      }
      flash(t('playbooks.list.deleted', 'Playbook deleted.'), 'success')
      setReloadToken((x) => x + 1)
    },
    [confirm, t],
  )

  const openDetail = React.useCallback(
    (id: string) => {
      router.push(`/backend/playbooks/${encodeURIComponent(id)}`)
    },
    [router],
  )

  const handleExportSelected = React.useCallback(async () => {
    const ids = selectedRows
      .map((row) => (typeof row.id === 'string' && row.id.length > 0 ? row.id : null))
      .filter((id): id is string => id != null)

    if (ids.length === 0) {
      flash(t('playbooks.list.export.noneSelected', 'Select at least one playbook to export.'), 'error')
      return
    }

    setIsExporting(true)
    try {
      const result = await exportPlaybooksMarkdownByIds(ids)
      if (!result.ok) {
        if (result.reason === 'empty') {
          flash(t('playbooks.list.export.empty', 'No exportable playbooks found for the selection.'), 'error')
        } else {
          flash(t('playbooks.list.export.error', 'Could not export playbooks.'), 'error')
        }
        return
      }
      flash(
        t('playbooks.list.export.success', 'Exported {count} playbook(s).', {
          count: result.count,
        }),
        'success',
      )
    } finally {
      setIsExporting(false)
    }
  }, [selectedRows, t])

  const handleExportOne = React.useCallback(
    async (row: PlaybookRow) => {
      if (!row?.id) return
      const result = await exportPlaybooksMarkdownByIds([row.id])
      if (!result.ok) {
        if (result.reason === 'empty') {
          flash(t('playbooks.list.export.empty', 'No exportable playbooks found for the selection.'), 'error')
        } else {
          flash(t('playbooks.list.export.error', 'Could not export playbooks.'), 'error')
        }
        return
      }
      flash(
        t('playbooks.list.export.success', 'Exported {count} playbook(s).', {
          count: result.count,
        }),
        'success',
      )
    },
    [t],
  )

  const handleImportFiles = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files
      event.target.value = ''
      if (!files || files.length === 0) return
      setIsImporting(true)
      try {
        const documents = await readMarkdownDocumentsFromFiles(files)
        if (documents.length === 0) {
          flash(t('playbooks.list.import.empty', 'No Markdown documents found in the selected files.'), 'error')
          return
        }
        if (documents.length > 50) {
          flash(t('playbooks.list.import.tooMany', 'Import at most 50 documents at once.'), 'error')
          return
        }

        const call = await apiCall<FromMarkdownBatchResponse>('/api/playbooks/from-markdown', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(documents.length === 1 ? { markdown: documents[0] } : { documents }),
        })

        if (!call.ok || !call.result) {
          flash(
            typeof call.result?.error === 'string'
              ? call.result.error
              : t('playbooks.list.import.error', 'Could not import playbooks.'),
            'error',
          )
          return
        }

        if (Array.isArray(call.result.results)) {
          const succeeded = call.result.summary?.succeeded ?? call.result.results.filter((item) => item.ok).length
          const failed = call.result.summary?.failed ?? call.result.results.length - succeeded
          if (failed > 0) {
            flash(
              t(
                'playbooks.list.import.partial',
                'Imported {succeeded} playbook(s); {failed} failed. Same slug becomes a new version when content changes.',
                { succeeded, failed },
              ),
              'error',
            )
          } else {
            flash(
              t(
                'playbooks.list.import.success',
                'Imported {count} playbook(s). Matching slug/uid creates a new version when content changes.',
                { count: succeeded },
              ),
              'success',
            )
          }
        } else {
          flash(
            t(
              'playbooks.list.import.successOne',
              'Imported playbook “{slug}” ({action}). Matching slug creates a new version when content changes.',
              {
                slug: call.result.slug ?? '—',
                action: call.result.action ?? 'updated',
              },
            ),
            'success',
          )
        }
        setReloadToken((x) => x + 1)
      } catch (err) {
        flash(
          err instanceof Error ? err.message : t('playbooks.list.import.error', 'Could not import playbooks.'),
          'error',
        )
      } finally {
        setIsImporting(false)
      }
    },
    [t],
  )

  const columns = React.useMemo<ColumnDef<PlaybookRow>[]>(
    () => [
      {
        accessorKey: 'title',
        header: t('playbooks.list.columns.title', 'Title'),
        cell: ({ row }) => (
          <Link
            href={`/backend/playbooks/${encodeURIComponent(row.original.id)}`}
            className="font-medium hover:underline"
          >
            {row.original.title}
          </Link>
        ),
      },
      {
        accessorKey: 'slug',
        header: t('playbooks.list.columns.slug', 'Slug'),
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.slug}</span>,
      },
      {
        accessorKey: 'audience',
        header: t('playbooks.list.columns.audience', 'Audience'),
        cell: ({ row }) => (
          <span className="text-sm text-foreground">{playbookAudienceCellLabel(row.original.audience, t)}</span>
        ),
      },
      {
        accessorKey: 'version',
        header: t('playbooks.list.columns.version', 'Ver.'),
      },
      {
        accessorKey: 'isActive',
        header: t('playbooks.list.columns.active', 'Active'),
        cell: ({ row }) => {
          const active = row.original.isActive !== false
          return (
            <span className="text-sm text-foreground">{active ? t('common.yes', 'Yes') : t('common.no', 'No')}</span>
          )
        },
      },
    ],
    [t],
  )

  const importAria = t('playbooks.list.import.action', 'Import playbooks')
  const exportAria = t('playbooks.list.export.action', 'Export')
  const transferGroupAria = t('playbooks.list.transfer.group', 'Import and export playbooks')

  return (
    <Page>
      <PageBody>
        <input
          ref={importInputRef}
          type="file"
          accept=".md,.markdown,.json,text/markdown,application/json"
          multiple
          className="hidden"
          onChange={(event) => void handleImportFiles(event)}
        />
        <DataTable<PlaybookRow>
          title={t('playbooks.list.title', 'Playbooks')}
          refreshButton={{
            label: t('playbooks.list.refresh', 'Refresh'),
            onRefresh: handleRefresh,
          }}
          actions={
            <>
              <div className="inline-flex items-stretch" role="group" aria-label={transferGroupAria}>
                {canManage ? (
                  <IconButton
                    type="button"
                    variant="outline"
                    title={importAria}
                    aria-label={importAria}
                    disabled={isImporting}
                    className="rounded-r-none border-r-0"
                    onClick={() => importInputRef.current?.click()}
                  >
                    <Upload className="size-4" aria-hidden />
                  </IconButton>
                ) : null}
                <IconButton
                  type="button"
                  variant="outline"
                  title={exportAria}
                  aria-label={exportAria}
                  disabled={isExporting || selectedRows.length === 0}
                  className={canManage ? 'rounded-l-none' : undefined}
                  onClick={() => void handleExportSelected()}
                >
                  <Download className="size-4" aria-hidden />
                </IconButton>
              </div>
              {canManage ? (
                <Button type="button" asChild size="sm" className="inline-flex items-center gap-2">
                  <Link href="/backend/playbooks/create">
                    <Plus className="size-4 shrink-0" aria-hidden />
                    {t('playbooks.create.title', 'New playbook')}
                  </Link>
                </Button>
              ) : null}
            </>
          }
          columns={columns}
          data={rows}
          enableRowSelection
          onSelectedRowsChange={setSelectedRows}
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          searchPlaceholder={t('playbooks.list.searchPlaceholder', 'Search playbooks…')}
          filters={filters}
          filterValues={filterValues}
          onFiltersApply={handleFiltersApply}
          onFiltersClear={handleFiltersClear}
          perspective={{ tableId: 'playbooks.list' }}
          rowActions={(row) => (
            <RowActions
              items={[
                {
                  id: 'view',
                  label: t('playbooks.list.actions.viewDetails', 'View details'),
                  onSelect: () => openDetail(row.id),
                },
                {
                  id: 'open-new-tab',
                  label: t('playbooks.list.actions.openInNewTab', 'Open in new tab'),
                  onSelect: () =>
                    window.open(`/backend/playbooks/${encodeURIComponent(row.id)}`, '_blank', 'noopener,noreferrer'),
                },
                {
                  id: 'export',
                  label: t('playbooks.list.export.action', 'Export'),
                  onSelect: () => void handleExportOne(row),
                },
                ...(canManage
                  ? [
                      {
                        id: 'delete',
                        label: t('common.delete', 'Delete'),
                        destructive: true as const,
                        onSelect: () => void handleDelete(row),
                      },
                    ]
                  : []),
              ]}
            />
          )}
          pagination={{ page, pageSize: PAGE_SIZE, total, totalPages, onPageChange: setPage }}
          isLoading={isLoading}
          onRowClick={(row) => openDetail(row.id)}
        />
      </PageBody>
      {ConfirmDialogElement}
    </Page>
  )
}
