"use client"

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Settings } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import type { FilterDef, FilterValues } from '@open-mercato/ui/backend/FilterBar'
import type { FilterOption } from '@open-mercato/ui/backend/FilterOverlay'
import { Button } from '@open-mercato/ui/primitives/button'
import { IconButton } from '@open-mercato/ui/primitives/icon-button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import {
  DictionaryValue,
  createDictionaryMap,
  type DictionaryDisplayEntry,
  type DictionaryMap,
} from '@open-mercato/core/modules/dictionaries/components/dictionaryAppearance'
import type { DictionaryOption } from '@open-mercato/core/modules/dictionaries/components/DictionaryEntrySelect'
import { fetchDictionaryOptionsByKey } from '../../../lib/fetchDictionaryOptionsByKey'
import {
  PROCUREMENT_PROCESS_STATUS_DICTIONARY_KEY,
  PROCUREMENT_PROCESS_TYPE_DICTIONARY_KEY,
} from '../../../lib/dictionaryKeys'

const PAGE_SIZE = 20

type ProcessRow = {
  id: string
  title: string
  statusLabel: string | null
  statusValue: string | null
  statusColor: string | null
  statusIcon: string | null
  typeLabel: string | null
  typeValue: string | null
  typeColor: string | null
  typeIcon: string | null
  updatedAt: string | null
}

type ListResponse = {
  items: ProcessRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

function rowDictionaryMap(
  value: string | null | undefined,
  label: string | null | undefined,
  icon: string | null | undefined,
  color: string | null | undefined,
): DictionaryMap {
  const v = typeof value === 'string' && value.trim() ? value.trim() : ''
  if (!v) return {}
  const colorNorm =
    typeof color === 'string' && /^#([0-9a-fA-F]{6})$/.test(color.trim()) ? color.trim() : null
  const entry: DictionaryDisplayEntry = {
    value: v,
    label: typeof label === 'string' && label.trim() ? label.trim() : v,
    icon: typeof icon === 'string' && icon.trim() ? icon.trim() : null,
    color: colorNorm,
  }
  return createDictionaryMap([entry])
}

export default function ProcurementProcessesListPage() {
  const router = useRouter()
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [rows, setRows] = React.useState<ProcessRow[]>([])
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [search, setSearch] = React.useState('')
  const [filterValues, setFilterValues] = React.useState<FilterValues>({})
  const [isLoading, setIsLoading] = React.useState(true)
  const [canManage, setCanManage] = React.useState(false)
  const [canSettings, setCanSettings] = React.useState(false)
  const [reloadToken, setReloadToken] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    async function loadPerm() {
      const call = await apiCall<{ granted?: string[]; ok?: boolean }>('/api/auth/feature-check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          features: ['procurement.processes.manage', 'procurement.settings.manage'],
        }),
      })
      if (cancelled) return
      const granted = Array.isArray(call.result?.granted) ? call.result?.granted : []
      setCanManage(call.result?.ok === true || granted.includes('procurement.processes.manage'))
      setCanSettings(call.result?.ok === true || granted.includes('procurement.settings.manage'))
    }
    void loadPerm()
    return () => {
      cancelled = true
    }
  }, [])

  const loadStatusFilterOptions = React.useCallback(async (): Promise<FilterOption[]> => {
    try {
      const rows = await fetchDictionaryOptionsByKey(PROCUREMENT_PROCESS_STATUS_DICTIONARY_KEY)
      return rows.map((r: DictionaryOption) => ({ value: r.value, label: r.label }))
    } catch {
      return []
    }
  }, [])

  const loadTypeFilterOptions = React.useCallback(async (): Promise<FilterOption[]> => {
    try {
      const rows = await fetchDictionaryOptionsByKey(PROCUREMENT_PROCESS_TYPE_DICTIONARY_KEY)
      return rows.map((r: DictionaryOption) => ({ value: r.value, label: r.label }))
    } catch {
      return []
    }
  }, [])

  const filters = React.useMemo<FilterDef[]>(
    () => [
      {
        id: 'statusValue',
        label: t('procurement.processes.list.filters.status', 'Status'),
        type: 'select',
        loadOptions: loadStatusFilterOptions,
      },
      {
        id: 'typeValue',
        label: t('procurement.processes.list.filters.type', 'Type'),
        type: 'select',
        loadOptions: loadTypeFilterOptions,
      },
    ],
    [loadStatusFilterOptions, loadTypeFilterOptions, t],
  )

  const queryParams = React.useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    })
    if (search.trim()) params.set('search', search.trim())
    const status = filterValues.statusValue
    if (typeof status === 'string' && status.trim()) params.set('statusValue', status.trim())
    const type = filterValues.typeValue
    if (typeof type === 'string' && type.trim()) params.set('typeValue', type.trim())
    return params.toString()
  }, [filterValues.statusValue, filterValues.typeValue, page, search])

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
        const call = await apiCall<ListResponse>(`/api/procurement/processes?${queryParams}`)
        if (cancelled) return
        if (!call.ok || !call.result) {
          const errPayload = call.result as { error?: string } | undefined
          const message =
            typeof errPayload?.error === 'string'
              ? errPayload.error
              : t('procurement.processes.list.error.load', 'Failed to load processes.')
          flash(message, 'error')
          setRows([])
          setTotalPages(1)
          setTotal(0)
          return
        }
        setRows(Array.isArray(call.result.items) ? call.result.items : [])
        setTotalPages(typeof call.result.totalPages === 'number' ? call.result.totalPages : 1)
        setTotal(typeof call.result.total === 'number' ? call.result.total : 0)
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : t('procurement.processes.list.error.load', 'Failed to load processes.')
          flash(message, 'error')
          setRows([])
          setTotalPages(1)
          setTotal(0)
        }
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
    async (row: ProcessRow) => {
      if (!row?.id) return
      const name = row.title?.trim() || t('procurement.processes.list.deleteFallbackName', 'this process')
      const confirmed = await confirm({
        title: t('procurement.processes.list.deleteConfirm', undefined, { title: name }),
        variant: 'destructive',
      })
      if (!confirmed) return
      try {
        await deleteCrud('procurement/processes', row.id, {
          errorMessage: t('procurement.processes.list.deleteError', 'Failed to delete process.'),
        })
        flash(t('procurement.processes.list.deleteSuccess', 'Process deleted.'), 'success')
        handleRefresh()
      } catch (err) {
        const message =
          err instanceof Error ? err.message : t('procurement.processes.list.deleteError', 'Failed to delete process.')
        flash(message, 'error')
      }
    },
    [confirm, handleRefresh, t],
  )

  const columns = React.useMemo<ColumnDef<ProcessRow>[]>(() => {
    const noValue = (
      <span className="text-muted-foreground text-sm">
        {t('procurement.processes.list.noValue', '—')}
      </span>
    )
    const detailHref = (id: string) => `/backend/procurement/processes/${encodeURIComponent(id)}`

    return [
      {
        accessorKey: 'title',
        header: t('procurement.processes.list.columns.title', 'Title'),
        cell: ({ row }) => (
          <Link href={detailHref(row.original.id)} className="font-medium hover:underline">
            {row.original.title}
          </Link>
        ),
      },
      {
        id: 'status',
        header: t('procurement.processes.list.columns.status', 'Status'),
        cell: ({ row }) => {
          const map = rowDictionaryMap(
            row.original.statusValue,
            row.original.statusLabel,
            row.original.statusIcon,
            row.original.statusColor,
          )
          return (
            <DictionaryValue
              value={row.original.statusValue}
              map={map}
              fallback={noValue}
              className="text-sm"
              iconWrapperClassName="inline-flex h-6 w-6 items-center justify-center rounded border border-border bg-card"
              iconClassName="h-4 w-4"
              colorClassName="h-3 w-3 rounded-full"
            />
          )
        },
      },
      {
        id: 'type',
        header: t('procurement.processes.list.columns.type', 'Type'),
        cell: ({ row }) => {
          const map = rowDictionaryMap(
            row.original.typeValue,
            row.original.typeLabel,
            row.original.typeIcon,
            row.original.typeColor,
          )
          return (
            <DictionaryValue
              value={row.original.typeValue}
              map={map}
              fallback={noValue}
              className="text-sm"
              iconWrapperClassName="inline-flex h-6 w-6 items-center justify-center rounded border border-border bg-card"
              iconClassName="h-4 w-4"
              colorClassName="h-3 w-3 rounded-full"
            />
          )
        },
      },
      {
        accessorKey: 'updatedAt',
        header: t('procurement.processes.list.columns.updated', 'Updated'),
        cell: ({ row }) =>
          row.original.updatedAt ? new Date(row.original.updatedAt).toLocaleString() : noValue,
      },
    ]
  }, [t])

  const openDetail = React.useCallback((id: string) => {
    router.push(`/backend/procurement/processes/${encodeURIComponent(id)}`)
  }, [router])

  return (
    <Page>
      <PageBody>
        <DataTable<ProcessRow>
          title={t('procurement.processes.list.title', 'Procurement processes')}
          refreshButton={{
            label: t('procurement.processes.list.actions.refresh', 'Refresh'),
            onRefresh: () => {
              setSearch('')
              setPage(1)
              handleRefresh()
            },
          }}
          actions={
            <>
              {canSettings ? (
                <IconButton asChild variant="outline" title={t('procurement.processes.list.actions.settings', 'Module settings')}>
                  <Link
                    href="/backend/config/procurement"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t('procurement.processes.list.actions.settings', 'Module settings')}
                  >
                    <Settings aria-hidden className="size-4" />
                  </Link>
                </IconButton>
              ) : null}
              {canManage ? (
                <Button asChild>
                  <Link href="/backend/procurement/processes/create">
                    {t('procurement.processes.list.actions.new', 'New process')}
                  </Link>
                </Button>
              ) : null}
            </>
          }
          columns={columns}
          data={rows}
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          searchPlaceholder={t('procurement.processes.list.search', 'Search by title')}
          filters={filters}
          filterValues={filterValues}
          onFiltersApply={handleFiltersApply}
          onFiltersClear={handleFiltersClear}
          perspective={{ tableId: 'procurement.processes.list' }}
          rowActions={(row) => (
            <RowActions
              items={[
                {
                  id: 'view',
                  label: t('procurement.processes.list.actions.viewDetails', 'View details'),
                  onSelect: () => openDetail(row.id),
                },
                {
                  id: 'open-new-tab',
                  label: t('procurement.processes.list.actions.openInNewTab', 'Open in new tab'),
                  onSelect: () =>
                    window.open(
                      `/backend/procurement/processes/${encodeURIComponent(row.id)}`,
                      '_blank',
                      'noopener,noreferrer',
                    ),
                },
                ...(canManage
                  ? [
                      {
                        id: 'delete',
                        label: t('procurement.processes.list.actions.delete', 'Delete'),
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
