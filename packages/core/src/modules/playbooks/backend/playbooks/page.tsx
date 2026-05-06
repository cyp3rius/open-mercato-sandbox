'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import type { FilterDef, FilterValues } from '@open-mercato/ui/backend/FilterBar'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { parsePlaybookBooleanField } from '../../lib/playbookFields'

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
  const [rows, setRows] = React.useState<PlaybookRow[]>([])
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [search, setSearch] = React.useState('')
  const [filterValues, setFilterValues] = React.useState<FilterValues>({
    [PLAYBOOK_ACTIVE_FILTER_ID]: 'active' satisfies PlaybookActiveFilterValue,
  })
  const [isLoading, setIsLoading] = React.useState(true)
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
      {
        id: 'actions',
        cell: ({ row }) =>
          canManage ? (
            <RowActions
              items={[
                {
                  id: 'delete',
                  label: t('common.delete', 'Delete'),
                  destructive: true,
                  onSelect: () => void handleDelete(row.original),
                },
              ]}
            />
          ) : null,
      },
    ],
    [canManage, handleDelete, t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable<PlaybookRow>
          title={t('playbooks.list.title', 'Playbooks')}
          refreshButton={{
            label: t('playbooks.list.refresh', 'Refresh'),
            onRefresh: () => {
              setSearch('')
              setPage(1)
              handleRefresh()
            },
          }}
          actions={
            canManage ? (
              <Button type="button" asChild size="sm" className="inline-flex items-center gap-2">
                <Link href="/backend/playbooks/create">
                  <Plus className="size-4 shrink-0" aria-hidden />
                  {t('playbooks.create.title', 'New playbook')}
                </Link>
              </Button>
            ) : null
          }
          columns={columns}
          data={rows}
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
