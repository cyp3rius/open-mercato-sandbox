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
import { Badge } from '@open-mercato/ui/primitives/badge'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { TAXI_FLEET_BASE } from '../paths'

const PAGE_SIZE = 20

type RecipientCounts = {
  total: number
  sent: number
  read: number
  failed: number
  skipped: number
  pending: number
}

type CommunicationRow = {
  id: string
  kind: string
  title: string
  status: string
  scheduledAt?: string | null
  sentAt?: string | null
  createdAt?: string | null
  recipientCounts?: RecipientCounts
}

type ListResponse = { items: CommunicationRow[]; totalPages: number; total?: number }

export default function TaxiFleetCommunicationsPage() {
  const t = useT()
  const router = useRouter()
  const scopeVersion = useOrganizationScopeVersion()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [rows, setRows] = React.useState<CommunicationRow[]>([])
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [isLoading, setIsLoading] = React.useState(true)
  const [reloadToken, setReloadToken] = React.useState(0)
  const [search, setSearch] = React.useState('')
  const [filterValues, setFilterValues] = React.useState<FilterValues>({})

  const filters = React.useMemo<FilterDef[]>(
    () => [
      {
        id: 'status',
        label: t('taxi_fleet.communications.list.filters.status', 'Status'),
        type: 'select',
        options: [
          { value: 'draft', label: t('taxi_fleet.communications.status.draft', 'Draft') },
          { value: 'scheduled', label: t('taxi_fleet.communications.status.scheduled', 'Scheduled') },
          { value: 'sending', label: t('taxi_fleet.communications.status.sending', 'Sending') },
          { value: 'sent', label: t('taxi_fleet.communications.status.sent', 'Sent') },
          { value: 'cancelled', label: t('taxi_fleet.communications.status.cancelled', 'Cancelled') },
        ],
      },
      {
        id: 'kind',
        label: t('taxi_fleet.communications.list.filters.kind', 'Type'),
        type: 'select',
        options: [
          { value: 'info', label: t('taxi_fleet.communications.kind.info', 'Info') },
          { value: 'service', label: t('taxi_fleet.communications.kind.service', 'Service') },
          { value: 'direct', label: t('taxi_fleet.communications.kind.direct', 'Direct') },
        ],
      },
    ],
    [t],
  )

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        sortField: 'createdAt',
        sortDir: 'desc',
      })
      if (typeof filterValues.status === 'string' && filterValues.status) {
        params.set('status', filterValues.status)
      }
      if (typeof filterValues.kind === 'string' && filterValues.kind) {
        params.set('kind', filterValues.kind)
      }
      const call = await apiCall<ListResponse>(`/api/taxi_fleet/driver-communications?${params}`)
      if (cancelled) return
      const items = Array.isArray(call.result?.items) ? call.result.items : []
      const filtered = search.trim()
        ? items.filter((row) => row.title.toLowerCase().includes(search.trim().toLowerCase()))
        : items
      setRows(filtered)
      setTotalPages(call.result?.totalPages ?? 1)
      setTotal(call.result?.total ?? filtered.length)
      setIsLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [page, reloadToken, scopeVersion, filterValues, search])

  const columns = React.useMemo<ColumnDef<CommunicationRow>[]>(
    () => [
      {
        accessorKey: 'title',
        header: t('taxi_fleet.communications.list.columns.title', 'Title'),
        cell: ({ row }) => (
          <Link
            href={`${TAXI_FLEET_BASE}/communications/${row.original.id}`}
            className="font-medium text-primary hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {row.original.title}
          </Link>
        ),
      },
      {
        accessorKey: 'kind',
        header: t('taxi_fleet.communications.list.columns.kind', 'Type'),
        cell: ({ row }) => (
          <Badge variant="secondary">
            {t(`taxi_fleet.communications.kind.${row.original.kind}`, row.original.kind)}
          </Badge>
        ),
      },
      {
        accessorKey: 'status',
        header: t('taxi_fleet.communications.list.columns.status', 'Status'),
        cell: ({ row }) => (
          <Badge variant="outline">
            {t(`taxi_fleet.communications.status.${row.original.status}`, row.original.status)}
          </Badge>
        ),
      },
      {
        id: 'counts',
        header: t('taxi_fleet.communications.list.columns.delivery', 'Sent / read'),
        cell: ({ row }) => {
          const counts = row.original.recipientCounts
          if (!counts) return '—'
          return `${counts.sent}/${counts.total} · ${counts.read} ${t('taxi_fleet.communications.list.read', 'read')}`
        },
      },
      {
        accessorKey: 'scheduledAt',
        header: t('taxi_fleet.communications.list.columns.scheduledAt', 'Scheduled'),
        cell: ({ row }) =>
          row.original.scheduledAt
            ? new Date(row.original.scheduledAt).toLocaleString()
            : '—',
      },
      {
        accessorKey: 'sentAt',
        header: t('taxi_fleet.communications.list.columns.sentAt', 'Sent'),
        cell: ({ row }) =>
          row.original.sentAt ? new Date(row.original.sentAt).toLocaleString() : '—',
      },
    ],
    [t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('taxi_fleet.communications.list.title', 'Driver communications')}
          refreshButton={{
            label: t('taxi_fleet.communications.list.actions.refresh', 'Refresh'),
            onRefresh: () => {
              setPage(1)
              setReloadToken((token) => token + 1)
            },
          }}
          actions={
            <Button asChild size="sm" className="inline-flex items-center gap-2">
              <Link href={`${TAXI_FLEET_BASE}/communications/create`}>
                <Plus className="size-4" aria-hidden />
                {t('taxi_fleet.communications.list.actions.create', 'New message')}
              </Link>
            </Button>
          }
          searchPlaceholder={t('taxi_fleet.communications.list.search', 'Search title…')}
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          filters={filters}
          filterValues={filterValues}
          onFiltersApply={(values) => {
            setFilterValues(values)
            setPage(1)
          }}
          onFiltersClear={() => {
            setFilterValues({})
            setPage(1)
          }}
          columns={columns}
          data={rows}
          isLoading={isLoading}
          perspective={{ tableId: 'taxi_fleet.communications' }}
          pagination={{
            page,
            pageSize: PAGE_SIZE,
            total,
            totalPages,
            onPageChange: setPage,
          }}
          onRowClick={(row) => router.push(`${TAXI_FLEET_BASE}/communications/${row.id}`)}
          rowActions={(row) => (
            <RowActions
              items={[
                {
                  label: t('taxi_fleet.communications.list.actions.viewDetails', 'View details'),
                  onSelect: () => router.push(`${TAXI_FLEET_BASE}/communications/${row.id}`),
                },
                {
                  label: t('taxi_fleet.communications.list.actions.delete', 'Delete'),
                  destructive: true,
                  onSelect: async () => {
                    const ok = await confirm({
                      text: t(
                        'taxi_fleet.communications.list.deleteConfirm',
                        'Delete this communication?',
                      ),
                      confirmText: t('common.delete', 'Delete'),
                      variant: 'destructive',
                    })
                    if (!ok) return
                    try {
                      await deleteCrud('taxi_fleet/driver-communications', row.id)
                      flash(t('taxi_fleet.communications.list.deleteSuccess', 'Deleted.'), 'success')
                      setReloadToken((token) => token + 1)
                    } catch {
                      flash(t('taxi_fleet.errors.generic', 'Operation failed.'), 'error')
                    }
                  },
                },
              ]}
            />
          )}
        />
      </PageBody>
      {ConfirmDialogElement}
    </Page>
  )
}
