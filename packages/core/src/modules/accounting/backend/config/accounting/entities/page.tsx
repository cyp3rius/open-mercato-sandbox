'use client'

import * as React from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type Row = {
  id: string
  name: string
  nip: string | null
  regon: string | null
}

type ResponsePayload = {
  items: Row[]
  total: number
  page: number
  totalPages: number
}

export default function AccountingSellingEntitiesListPage() {
  const t = useT()
  const [rows, setRows] = React.useState<Row[]>([])
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '50',
        sortField: 'name',
        sortDir: 'asc',
      })
      if (search.trim().length > 0) params.set('search', search.trim())

      const fallback: ResponsePayload = { items: [], total: 0, page, totalPages: 1 }
      const call = await apiCall<ResponsePayload>(
        `/api/accounting/selling-entities?${params.toString()}`,
        undefined,
        { fallback },
      )
      if (!cancelled) {
        const payload = call.result ?? fallback
        setRows(Array.isArray(payload.items) ? payload.items : [])
        setTotal(Number(payload.total ?? 0))
        setTotalPages(Number(payload.totalPages ?? 1))
        setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [page, search])

  const columns = React.useMemo<ColumnDef<Row>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('accounting.settings.entities.list.columns.name', 'Name'),
        cell: ({ row }) => (
          <Link
            href={`/backend/config/accounting/entities/${row.original.id}`}
            className="font-medium hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: 'nip',
        header: t('accounting.settings.entities.list.columns.nip', 'NIP'),
        cell: ({ row }) => row.original.nip || '—',
      },
      {
        accessorKey: 'regon',
        header: t('accounting.settings.entities.list.columns.regon', 'REGON'),
        cell: ({ row }) => row.original.regon || '—',
      },
    ],
    [t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('accounting.settings.entities.list.title', 'Selling companies')}
          data={rows}
          columns={columns}
          searchPlaceholder={t('accounting.settings.entities.list.searchPlaceholder', 'Search by name, NIP, REGON')}
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          actions={
            <Button asChild>
              <Link href="/backend/config/accounting/entities/create">
                <Plus className="mr-2 h-4 w-4" />
                {t('accounting.settings.entities.list.add', 'Add company')}
              </Link>
            </Button>
          }
          rowActions={(row) => (
            <RowActions
              items={[
                {
                  id: 'view',
                  label: t('accounting.settings.entities.list.viewDetails', 'View details'),
                  href: `/backend/config/accounting/entities/${row.id}`,
                },
              ]}
            />
          )}
          pagination={{ page, pageSize: 50, total, totalPages, onPageChange: setPage }}
          isLoading={isLoading}
          perspective={{ tableId: 'accounting.settings.sellingEntities.list' }}
        />
      </PageBody>
    </Page>
  )
}
