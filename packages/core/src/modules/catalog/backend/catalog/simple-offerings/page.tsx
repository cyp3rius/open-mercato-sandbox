"use client"

import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { DataTable, withDataTableNamespaces } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { fetchProcurementCustomerAssociationPreview } from '@open-mercato/core/modules/procurement/lib/procurementEntitySearch'

type OfferingRow = {
  id: string
  productTitle: string
  customerName: string
  customerEntityId: string
  customerHref: string | null
  status: string
  startsAt: string | null
  endsAt: string | null
  salesOrderId: string | null
}

const PAGE_SIZE = 20
const MANAGE_FEATURE = 'catalog.simple_offerings.manage'

export default function SimpleOfferingsPage() {
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [rows, setRows] = React.useState<OfferingRow[]>([])
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [canManage, setCanManage] = React.useState(false)
  const [reloadToken, setReloadToken] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    async function loadPerm() {
      const call = await apiCall<{ granted?: string[]; ok?: boolean }>('/api/auth/feature-check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ features: [MANAGE_FEATURE] }),
      })
      if (cancelled) return
      const granted = Array.isArray(call.result?.granted) ? call.result.granted : []
      setCanManage(call.result?.ok === true || granted.includes(MANAGE_FEATURE))
    }
    void loadPerm()
    return () => {
      cancelled = true
    }
  }, [])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      if (search.trim()) params.set('search', search.trim())
      const call = await apiCall<{
        items?: Array<Record<string, unknown>>
        total?: number
        pageSize?: number
      }>(`/api/catalog/customer-offerings?${params.toString()}`)
      if (!call.ok) {
        flash(t('catalog.simpleOfferings.errors.load', 'Failed to load offerings.'), 'error')
        return
      }
      const items = Array.isArray(call.result?.items) ? call.result.items : []
      const mapped = await Promise.all(
        items.map(async (item) => {
          const customerEntityId = typeof item.customerEntityId === 'string' ? item.customerEntityId : ''
          let customerHref: string | null = null
          if (customerEntityId) {
            try {
              const preview = await fetchProcurementCustomerAssociationPreview(customerEntityId)
              customerHref = preview?.recordHref ?? null
            } catch {
              customerHref = null
            }
          }
          return withDataTableNamespaces(
            {
              id: typeof item.id === 'string' ? item.id : '',
              productTitle: typeof item.productTitle === 'string' ? item.productTitle : '—',
              customerName: typeof item.customerName === 'string' ? item.customerName : '—',
              customerEntityId,
              customerHref,
              status: typeof item.status === 'string' ? item.status : '—',
              startsAt: typeof item.startsAt === 'string' ? item.startsAt : null,
              endsAt: typeof item.endsAt === 'string' ? item.endsAt : null,
              salesOrderId: typeof item.salesOrderId === 'string' ? item.salesOrderId : null,
            },
            item,
          )
        }),
      )
      setRows(mapped)
      const totalCount = typeof call.result?.total === 'number' ? call.result.total : items.length
      setTotal(totalCount)
      setTotalPages(Math.max(1, Math.ceil(totalCount / PAGE_SIZE)))
    } catch (err) {
      console.error('simple.offerings.load failed', err)
      flash(t('catalog.simpleOfferings.errors.load', 'Failed to load offerings.'), 'error')
    } finally {
      setLoading(false)
    }
  }, [page, search, t])

  React.useEffect(() => {
    void load()
  }, [load, scopeVersion, reloadToken])

  const activate = React.useCallback(
    async (offeringId: string, activateFlag: boolean) => {
      const ok = await confirm({
        title: activateFlag
          ? t('catalog.simpleOfferings.actions.activateConfirm', 'Activate this offering?')
          : t('catalog.simpleOfferings.actions.deactivateConfirm', 'Deactivate this offering?'),
        variant: activateFlag ? undefined : 'destructive',
      })
      if (!ok) return
      const path = activateFlag
        ? '/api/catalog/customer-offerings/activate'
        : '/api/catalog/customer-offerings/deactivate'
      const call = await apiCall(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ offeringId }),
      })
      if (!call.ok) {
        flash(
          activateFlag
            ? t('catalog.simpleOfferings.errors.activate', 'Failed to activate offering.')
            : t('catalog.simpleOfferings.errors.deactivate', 'Failed to deactivate offering.'),
          'error',
        )
        return
      }
      flash(
        activateFlag
          ? t('catalog.simpleOfferings.success.activate', 'Offering activated.')
          : t('catalog.simpleOfferings.success.deactivate', 'Offering deactivated.'),
        'success',
      )
      setReloadToken((token) => token + 1)
    },
    [confirm, t],
  )

  const columns = React.useMemo<ColumnDef<OfferingRow>[]>(
    () => [
      {
        accessorKey: 'productTitle',
        header: t('catalog.simpleOfferings.columns.product', 'Product'),
      },
      {
        accessorKey: 'customerName',
        header: t('catalog.simpleOfferings.columns.customer', 'Customer'),
      },
      {
        accessorKey: 'status',
        header: t('catalog.simpleOfferings.columns.status', 'Status'),
      },
      {
        id: 'window',
        header: t('catalog.simpleOfferings.columns.window', 'Window'),
        cell: ({ row }) => {
          const start = row.original.startsAt
            ? new Date(row.original.startsAt).toLocaleDateString()
            : '—'
          const end = row.original.endsAt ? new Date(row.original.endsAt).toLocaleDateString() : '—'
          return `${start} → ${end}`
        },
      },
    ],
    [t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('catalog.simpleOfferings.list.title', 'Simple offerings')}
          columns={columns}
          data={rows}
          isLoading={loading}
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          searchPlaceholder={t('catalog.simpleOfferings.list.search', 'Search offerings…')}
          pagination={{ page, pageSize: PAGE_SIZE, total, totalPages, onPageChange: setPage }}
          perspective={{ tableId: 'catalog.simpleOfferings.list' }}
          refreshButton={{
            onRefresh: () => {
              setSearch('')
              setPage(1)
              setReloadToken((token) => token + 1)
            },
            label: t('catalog.simpleOfferings.list.actions.refresh', 'Refresh'),
            isRefreshing: loading,
          }}
          rowActions={(row) => {
            const items: Array<{
              id: string
              label: string
              href?: string
              onSelect?: () => void
              destructive?: boolean
            }> = []
            if (row.customerHref) {
              items.push({
                id: 'customer',
                label: t('catalog.simpleOfferings.actions.openCustomer', 'Open customer'),
                href: row.customerHref,
              })
            }
            if (row.salesOrderId) {
              items.push({
                id: 'order',
                label: t('catalog.simpleOfferings.actions.openOrder', 'Open order'),
                href: `/backend/sales/simple-orders/${encodeURIComponent(row.salesOrderId)}`,
              })
            }
            if (canManage) {
              items.push({
                id: 'activate',
                label: t('catalog.simpleOfferings.actions.activate', 'Activate'),
                onSelect: () => void activate(row.id, true),
              })
              items.push({
                id: 'deactivate',
                label: t('catalog.simpleOfferings.actions.deactivate', 'Deactivate'),
                destructive: true,
                onSelect: () => void activate(row.id, false),
              })
            }
            return <RowActions items={items} />
          }}
        />
      </PageBody>
      {ConfirmDialogElement}
    </Page>
  )
}
