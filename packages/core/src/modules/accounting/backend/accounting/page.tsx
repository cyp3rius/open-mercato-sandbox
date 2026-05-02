'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { FolderInput, FolderOutput, Import, Plus, Settings } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import type { FilterDef, FilterValues } from '@open-mercato/ui/backend/FilterBar'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { Badge } from '@open-mercato/ui/primitives/badge'
import { Button } from '@open-mercato/ui/primitives/button'
import { IconButton } from '@open-mercato/ui/primitives/icon-button'
import { Popover, PopoverContent, PopoverTrigger } from '@open-mercato/ui/primitives/popover'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'

type ListScope = 'income' | 'cost' | 'drafts'

type InvoiceRow = {
  id: string
  documentNumber: string
  documentKind: 'issued' | 'imported_cost' | 'imported_sales'
  issueDate: string
  counterpartyName: string | null
  externalReference: string | null
  currencyCode: string | null
  totalAmount: string | null
  isDraft: boolean
}

type ResponsePayload = {
  items: InvoiceRow[]
  total: number
  page: number
  totalPages: number
}

function parseListScope(raw: string | null): ListScope {
  if (raw === 'cost' || raw === 'drafts') return raw
  return 'income'
}

function kindLabel(t: ReturnType<typeof useT>, value: InvoiceRow['documentKind']): string {
  if (value === 'imported_cost') return t('accounting.kinds.importedCost', 'Imported cost invoice')
  if (value === 'imported_sales') return t('accounting.kinds.importedSales', 'Imported sales invoice')
  return t('accounting.kinds.issued', 'Issued invoice')
}

function listScopeToQuery(scope: ListScope): 'income' | 'cost' | 'drafts' {
  return scope
}

export default function AccountingHubPage() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = React.useMemo(
    () => parseListScope(searchParams.get('tab')),
    [searchParams],
  )

  const setActiveTab = React.useCallback(
    (next: ListScope) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', next)
      router.replace(`/backend/accounting?${params.toString()}`)
    },
    [router, searchParams],
  )

  const [rows, setRows] = React.useState<InvoiceRow[]>([])
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [filterValues, setFilterValues] = React.useState<FilterValues>({})
  const [isLoading, setIsLoading] = React.useState(true)
  const [reloadToken, setReloadToken] = React.useState(0)

  const handleRefresh = React.useCallback(() => {
    setReloadToken((x) => x + 1)
  }, [])

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

  const filters = React.useMemo<FilterDef[]>(() => {
    const currencyAndSource: FilterDef[] = [
      {
        id: 'currencyCode',
        label: t('accounting.list.filters.currency', 'Currency'),
        type: 'text',
        placeholder: t('accounting.list.filters.currencyPlaceholder', 'e.g. PLN, EUR'),
      },
      {
        id: 'sourceSystem',
        label: t('accounting.list.filters.sourceSystem', 'Source system'),
        type: 'text',
        placeholder: t('accounting.list.filters.sourceSystemPlaceholder', 'e.g. file import'),
      },
    ]
    if (activeTab === 'cost') {
      return currencyAndSource
    }
    if (activeTab === 'income') {
      return [
        {
          id: 'documentKind',
          label: t('accounting.list.filters.documentKind', 'Document type'),
          type: 'select',
          options: [
            { value: '', label: t('accounting.list.filters.documentKindAll', 'All types') },
            { value: 'issued', label: t('accounting.kinds.issued', 'Issued invoice') },
            { value: 'imported_sales', label: t('accounting.kinds.importedSales', 'Imported sales invoice') },
          ],
        },
        ...currencyAndSource,
      ]
    }
    return [
      {
        id: 'documentKind',
        label: t('accounting.list.filters.documentKind', 'Document type'),
        type: 'select',
        options: [
          { value: '', label: t('accounting.list.filters.documentKindAll', 'All types') },
          { value: 'issued', label: t('accounting.kinds.issued', 'Issued invoice') },
          { value: 'imported_cost', label: t('accounting.kinds.importedCost', 'Imported cost invoice') },
          { value: 'imported_sales', label: t('accounting.kinds.importedSales', 'Imported sales invoice') },
        ],
      },
      ...currencyAndSource,
    ]
  }, [activeTab, t])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '50',
        sortField: 'issueDate',
        sortDir: 'desc',
        listScope: listScopeToQuery(activeTab),
      })
      if (search.trim().length > 0) params.set('search', search.trim())
      const kind = filterValues.documentKind
      if (typeof kind === 'string' && kind.trim().length > 0) {
        params.set('documentKind', kind.trim())
      }
      const cur = filterValues.currencyCode
      if (typeof cur === 'string' && cur.trim().length > 0) {
        params.set('currencyCode', cur.trim())
      }
      const src = filterValues.sourceSystem
      if (typeof src === 'string' && src.trim().length > 0) {
        params.set('sourceSystem', src.trim())
      }

      const fallback: ResponsePayload = { items: [], total: 0, page, totalPages: 1 }
      const call = await apiCall<ResponsePayload>(
        `/api/accounting/invoices?${params.toString()}`,
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
  }, [page, search, activeTab, reloadToken, filterValues])

  const columns = React.useMemo<ColumnDef<InvoiceRow>[]>(
    () => [
      {
        accessorKey: 'documentNumber',
        header: t('accounting.list.columns.documentNumber', 'Number'),
        cell: ({ row }) => (
          <Link href={`/backend/accounting/invoices/${row.original.id}`} className="font-medium hover:underline">
            {row.original.documentNumber}
          </Link>
        ),
      },
      {
        accessorKey: 'documentKind',
        header: t('accounting.list.columns.documentKind', 'Type'),
        cell: ({ row }) => <Badge variant="secondary">{kindLabel(t, row.original.documentKind)}</Badge>,
      },
      {
        accessorKey: 'issueDate',
        header: t('accounting.list.columns.issueDate', 'Issue date'),
      },
      {
        accessorKey: 'counterpartyName',
        header: t('accounting.list.columns.counterpartyName', 'Counterparty'),
        cell: ({ row }) => row.original.counterpartyName || '-',
      },
      {
        accessorKey: 'totalAmount',
        header: t('accounting.list.columns.totalAmount', 'Amount'),
        cell: ({ row }) => {
          if (!row.original.totalAmount) return '-'
          return `${row.original.totalAmount} ${row.original.currencyCode || ''}`.trim()
        },
      },
    ],
    [t],
  )

  const tableTitle = React.useMemo(() => {
    if (activeTab === 'cost') {
      return t('accounting.hub.table.cost', 'Cost invoices')
    }
    if (activeTab === 'drafts') {
      return t('accounting.hub.table.drafts', 'Draft invoices')
    }
    return t('accounting.hub.table.income', 'Sales invoices')
  }, [activeTab, t])

  const extensionTableId = React.useMemo(() => {
    if (activeTab === 'cost') return 'accounting.invoices.tab.cost'
    if (activeTab === 'drafts') return 'accounting.invoices.tab.drafts'
    return 'accounting.invoices.tab.income'
  }, [activeTab])

  const settingsAria = t('accounting.hub.actions.settings', 'Accounting settings')
  const importAria = t('accounting.hub.actions.importMenu', 'Import invoice…')

  return (
    <Page>
      <PageBody className="space-y-4">
        <div
          className="flex flex-wrap gap-1 border-b border-border"
          role="tablist"
          aria-label={t('accounting.hub.tabs.aria', 'Invoice categories')}
        >
          {(
            [
              { id: 'income' as const, label: t('accounting.hub.tabs.income', 'Sales') },
              { id: 'cost' as const, label: t('accounting.hub.tabs.cost', 'Cost') },
              { id: 'drafts' as const, label: t('accounting.hub.tabs.drafts', 'Drafts') },
            ] as const
          ).map((tab) => (
            <Button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              variant="ghost"
              size="sm"
              className={cn(
                'h-auto rounded-none border-b-2 px-3 py-2 hover:bg-transparent',
                activeTab === tab.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground',
              )}
              onClick={() => {
                setActiveTab(tab.id)
                setFilterValues({})
                setPage(1)
              }}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        <DataTable
          title={tableTitle}
          refreshButton={{
            label: t('accounting.hub.actions.refresh', 'Refresh'),
            onRefresh: () => {
              setSearch('')
              setFilterValues({})
              setPage(1)
              handleRefresh()
            },
          }}
          actions={
            <>
              <IconButton asChild variant="outline" title={settingsAria}>
                <Link
                  href="/backend/config/accounting"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={settingsAria}
                >
                  <Settings aria-hidden className="size-4" />
                </Link>
              </IconButton>
              <Popover>
                <PopoverTrigger asChild>
                  <IconButton type="button" variant="outline" title={importAria} aria-label={importAria}>
                    <Import className="size-4" aria-hidden />
                  </IconButton>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-1" align="end">
                  <div className="flex flex-col gap-0.5">
                    <Button variant="ghost" className="h-9 w-full justify-start gap-2 px-2 font-normal" asChild>
                      <Link href="/backend/accounting/invoices/import-cost">
                        <FolderInput className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        {t('accounting.hub.actions.importCost', 'Import cost invoice')}
                      </Link>
                    </Button>
                    <Button variant="ghost" className="h-9 w-full justify-start gap-2 px-2 font-normal" asChild>
                      <Link href="/backend/accounting/invoices/import-sales">
                        <FolderOutput className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        {t('accounting.hub.actions.importSales', 'Import sales invoice')}
                      </Link>
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              <Button asChild type="button" size="sm" className="inline-flex items-center gap-2">
                <Link
                  href="/backend/accounting/invoices/create"
                  title={t('accounting.hub.actions.issued', 'Issue invoice')}
                >
                  <Plus className="size-4 shrink-0" aria-hidden />
                  {t('accounting.hub.actions.issued', 'Issue invoice')}
                </Link>
              </Button>
            </>
          }
          data={rows}
          columns={columns}
          searchPlaceholder={t('accounting.list.searchPlaceholder', 'Search invoices')}
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          filters={filters}
          filterValues={filterValues}
          onFiltersApply={handleFiltersApply}
          onFiltersClear={handleFiltersClear}
          rowActions={(row) => (
            <RowActions
              items={[
                {
                  id: 'open',
                  label: t('accounting.list.actions.view', 'View details'),
                  href: `/backend/accounting/invoices/${row.id}`,
                },
              ]}
            />
          )}
          pagination={{ page, pageSize: 50, total, totalPages, onPageChange: setPage }}
          isLoading={isLoading}
          perspective={{ tableId: extensionTableId }}
        />
      </PageBody>
    </Page>
  )
}
