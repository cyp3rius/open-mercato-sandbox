"use client"

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
import { Badge } from '@open-mercato/ui/primitives/badge'

const PAGE_SIZE = 20

type ProgramRow = {
  id: string
  name: string
  description?: string | null
  validFrom?: string | null
  validTo?: string | null
  isActive?: boolean
  updatedAt?: string | null
}

type ListResponse = {
  items: ProgramRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export default function PartnerProgramsListPage() {
  const router = useRouter()
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [rows, setRows] = React.useState<ProgramRow[]>([])
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [search, setSearch] = React.useState('')
  const [filterValues, setFilterValues] = React.useState<FilterValues>({})
  const [isLoading, setIsLoading] = React.useState(true)
  const [canManage, setCanManage] = React.useState(false)
  const [reloadToken, setReloadToken] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    async function loadPerm() {
      const call = await apiCall<{ granted?: string[]; ok?: boolean }>('/api/auth/feature-check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          features: ['partner_programs.create', 'partner_programs.edit', 'partner_programs.delete'],
        }),
      })
      if (cancelled) return
      const granted = Array.isArray(call.result?.granted) ? call.result.granted : []
      const ok =
        call.result?.ok === true ||
        granted.includes('partner_programs.create') ||
        granted.includes('partner_programs.edit') ||
        granted.includes('partner_programs.delete')
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
        id: 'isActive',
        label: t('partner_programs.list.table.isActive', 'Active'),
        type: 'select',
        options: [
          { value: 'true', label: t('common.yes', 'Yes') },
          { value: 'false', label: t('common.no', 'No') },
        ],
      },
    ],
    [t],
  )

  const queryParams = React.useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    })
    if (search.trim()) params.set('search', search.trim())
    const active = filterValues.isActive
    if (typeof active === 'string' && active.trim()) params.set('isActive', active.trim())
    return params.toString()
  }, [filterValues.isActive, page, search])

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
        const call = await apiCall<ListResponse>(`/api/partner_programs/programs?${queryParams}`)
        if (cancelled) return
        if (!call.ok || !call.result) {
          flash(t('partner_programs.list.errors.load', 'Failed to load programs.'), 'error')
          setRows([])
          setTotalPages(1)
          setTotal(0)
          return
        }
        setRows(Array.isArray(call.result.items) ? call.result.items : [])
        setTotalPages(typeof call.result.totalPages === 'number' ? call.result.totalPages : 1)
        setTotal(typeof call.result.total === 'number' ? call.result.total : 0)
      } catch {
        if (!cancelled) flash(t('partner_programs.list.errors.load', 'Failed to load programs.'), 'error')
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
    async (row: ProgramRow) => {
      if (!row?.id) return
      const name = row.name?.trim() || row.id
      const confirmTemplate = t(
        'partner_programs.list.actions.deleteConfirm',
        'Delete program "{{name}}"?',
      )
      const confirmed = await confirm({
        title: confirmTemplate.replace('{{name}}', name),
        variant: 'destructive',
      })
      if (!confirmed) return
      try {
        await deleteCrud('partner_programs/programs', row.id, {
          errorMessage: t('partner_programs.list.errors.delete', 'Failed to delete program.'),
        })
        flash(t('partner_programs.list.messages.deleted', 'Program deleted.'), 'success')
        handleRefresh()
      } catch (err) {
        const message =
          err instanceof Error ? err.message : t('partner_programs.list.errors.delete', 'Failed to delete program.')
        flash(message, 'error')
      }
    },
    [confirm, handleRefresh, t],
  )

  const columns = React.useMemo<ColumnDef<ProgramRow>[]>(() => {
    const noValue = <span className="text-muted-foreground text-sm">—</span>
    const detailHref = (id: string) => `/backend/partner_programs/programs/${encodeURIComponent(id)}`
    return [
      {
        accessorKey: 'name',
        header: t('partner_programs.list.table.name', 'Name'),
        cell: ({ row }) => (
          <Link href={detailHref(row.original.id)} className="font-medium hover:underline">
            {row.original.name}
          </Link>
        ),
      },
      {
        id: 'validFrom',
        header: t('partner_programs.list.table.validFrom', 'Valid from'),
        cell: ({ row }) =>
          row.original.validFrom ? new Date(row.original.validFrom).toLocaleDateString() : noValue,
      },
      {
        id: 'validTo',
        header: t('partner_programs.list.table.validTo', 'Valid to'),
        cell: ({ row }) =>
          row.original.validTo ? new Date(row.original.validTo).toLocaleDateString() : noValue,
      },
      {
        id: 'isActive',
        header: t('partner_programs.list.table.isActive', 'Active'),
        cell: ({ row }) =>
          row.original.isActive === false ? (
            <Badge variant="secondary">{t('common.no', 'No')}</Badge>
          ) : (
            <Badge variant="default">{t('common.yes', 'Yes')}</Badge>
          ),
      },
      {
        accessorKey: 'updatedAt',
        header: t('partner_programs.list.table.updatedAt', 'Updated'),
        cell: ({ row }) =>
          row.original.updatedAt ? new Date(row.original.updatedAt).toLocaleString() : noValue,
      },
    ]
  }, [t])

  const labels = React.useMemo(
    () => ({
      title: t('partner_programs.list.title', 'Partner programs'),
      description: t(
        'partner_programs.list.description',
        'Loyalty and B2B agreement programs scoped to CRM partner companies.',
      ),
      empty: t('partner_programs.list.table.empty', 'No programs yet.'),
      searchPlaceholder: t('partner_programs.list.table.search', 'Search programs…'),
      refresh: t('partner_programs.list.actions.refresh', 'Refresh'),
      newProgram: t('partner_programs.list.actions.new', 'New program'),
    }),
    [t],
  )

  return (
    <Page>
      <PageBody className="space-y-4">
        <DataTable<ProgramRow>
          title={labels.title}
          description={labels.description}
          perspective={{ tableId: 'partner_programs.programs' }}
          refreshButton={{ label: labels.refresh, onRefresh: handleRefresh }}
          searchPlaceholder={labels.searchPlaceholder}
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          filters={filters}
          filterValues={filterValues}
          onFiltersApply={handleFiltersApply}
          onFiltersClear={handleFiltersClear}
          columns={columns}
          data={rows}
          isLoading={isLoading}
          emptyState={labels.empty}
          pagination={{
            page,
            totalPages,
            total,
            pageSize: PAGE_SIZE,
            onPageChange: setPage,
          }}
          actions={
            canManage ? (
              <Button size="sm" className="inline-flex items-center gap-2" asChild>
                <Link href="/backend/partner_programs/programs/create">
                  <Plus className="h-4 w-4" />
                  {labels.newProgram}
                </Link>
              </Button>
            ) : null
          }
          rowActions={(row) => (
            <RowActions
              items={[
                {
                  id: 'view',
                  label: t('partner_programs.list.actions.view', 'View details'),
                  href: `/backend/partner_programs/programs/${encodeURIComponent(row.id)}`,
                },
                ...(canManage
                  ? [
                      {
                        id: 'delete',
                        label: t('partner_programs.list.actions.delete', 'Delete'),
                        onSelect: () => void handleDelete(row),
                        destructive: true,
                      },
                    ]
                  : []),
              ]}
            />
          )}
          onRowClick={(row: ProgramRow) => {
            router.push(`/backend/partner_programs/programs/${encodeURIComponent(row.id)}`)
          }}
        />
        {ConfirmDialogElement}
      </PageBody>
    </Page>
  )
}
