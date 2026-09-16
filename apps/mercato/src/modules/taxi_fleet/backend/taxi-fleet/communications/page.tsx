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

function readSelectFilter(value: unknown): string | null {
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
    return parts.length ? parts.join(',') : null
  }
  if (typeof value === 'string' && value.trim()) return value.trim()
  return null
}

function readDateRange(value: unknown): { from?: string; to?: string } | null {
  if (!value || typeof value !== 'object') return null
  const range = value as { from?: unknown; to?: unknown }
  const from = typeof range.from === 'string' && range.from.trim() ? range.from.trim() : undefined
  const to = typeof range.to === 'string' && range.to.trim() ? range.to.trim() : undefined
  if (!from && !to) return null
  return { from, to }
}

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
        multiple: true,
        options: [
          { value: 'draft', label: t('taxi_fleet.communications.status.draft', 'Draft') },
          { value: 'scheduled', label: t('taxi_fleet.communications.status.scheduled', 'Scheduled') },
          { value: 'sending', label: t('taxi_fleet.communications.status.sending', 'Sending') },
          { value: 'partial', label: t('taxi_fleet.communications.status.partial', 'Partial') },
          { value: 'sent', label: t('taxi_fleet.communications.status.sent', 'Sent') },
          { value: 'cancelled', label: t('taxi_fleet.communications.status.cancelled', 'Cancelled') },
        ],
      },
      {
        id: 'kind',
        label: t('taxi_fleet.communications.list.filters.kind', 'Type'),
        type: 'select',
        multiple: true,
        options: [
          { value: 'info', label: t('taxi_fleet.communications.kind.info', 'Info') },
          { value: 'service', label: t('taxi_fleet.communications.kind.service', 'Service') },
          { value: 'direct', label: t('taxi_fleet.communications.kind.direct', 'Direct') },
        ],
      },
      {
        id: 'sentAt',
        label: t('taxi_fleet.communications.list.filters.sentAt', 'Sent date'),
        type: 'dateRange',
      },
      {
        id: 'createdAt',
        label: t('taxi_fleet.communications.list.filters.createdAt', 'Created date'),
        type: 'dateRange',
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
      const searchTerm = search.trim()
      if (searchTerm) params.set('search', searchTerm)

      const status = readSelectFilter(filterValues.status)
      if (status) params.set('status', status)
      const kind = readSelectFilter(filterValues.kind)
      if (kind) params.set('kind', kind)

      const sentAt = readDateRange(filterValues.sentAt)
      if (sentAt?.from) params.set('sentFrom', sentAt.from)
      if (sentAt?.to) params.set('sentTo', sentAt.to)

      const createdAt = readDateRange(filterValues.createdAt)
      if (createdAt?.from) params.set('createdFrom', createdAt.from)
      if (createdAt?.to) params.set('createdTo', createdAt.to)

      const call = await apiCall<ListResponse>(`/api/taxi_fleet/driver-communications?${params}`)
      if (cancelled) return
      const items = Array.isArray(call.result?.items) ? call.result.items : []
      setRows(items)
      setTotalPages(call.result?.totalPages ?? 1)
      setTotal(call.result?.total ?? items.length)
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
          return t(
            'taxi_fleet.communications.list.deliverySummary',
            '{sent}/{total} · {read} read',
            {
              sent: String(counts.sent),
              total: String(counts.total),
              read: String(counts.read),
            },
          )
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
      {
        accessorKey: 'createdAt',
        header: t('taxi_fleet.communications.list.columns.createdAt', 'Created'),
        cell: ({ row }) =>
          row.original.createdAt ? new Date(row.original.createdAt).toLocaleString() : '—',
      },
    ],
    [t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('taxi_fleet.communications.list.title', 'Communications')}
          description={t(
            'taxi_fleet.communications.list.description',
            'Broadcast messages to drivers in the mobile app.',
          )}
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
          searchPlaceholder={t('taxi_fleet.communications.list.search', 'Search title or message…')}
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
          emptyState={t('taxi_fleet.communications.list.empty', 'No communications yet.')}
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
                  label: t('taxi_fleet.communications.list.actions.openInNewTab', 'Open in new tab'),
                  onSelect: () =>
                    window.open(
                      `${TAXI_FLEET_BASE}/communications/${row.id}`,
                      '_blank',
                      'noopener,noreferrer',
                    ),
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
