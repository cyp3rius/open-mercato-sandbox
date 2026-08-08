"use client"

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { Button } from '@open-mercato/ui/primitives/button'
import { Badge } from '@open-mercato/ui/primitives/badge'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { TAXI_FLEET_BASE } from '../paths'
import { useFleetDriverDirectory } from '../../../components/useFleetDriverDirectory'
import { useTaxiFleetPermissions } from '../../../components/useTaxiFleetPermissions'
import { formatPercentDisplay } from '@open-mercato/shared/lib/numeric'

const PAGE_SIZE = 20

type DriverRow = {
  id: string
  teamMemberId: string
  payoutPercent: string
  externalAppEnabled: boolean
}

type ListResponse = { items: DriverRow[]; totalPages: number; total?: number }

export default function TaxiFleetDriversPage() {
  const t = useT()
  const router = useRouter()
  const scopeVersion = useOrganizationScopeVersion()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const { resolveName, reload: reloadDirectory } = useFleetDriverDirectory()
  const { canManageSettlements } = useTaxiFleetPermissions()
  const [rows, setRows] = React.useState<DriverRow[]>([])
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [isLoading, setIsLoading] = React.useState(true)
  const [reloadToken, setReloadToken] = React.useState(0)
  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      const call = await apiCall<ListResponse>(`/api/taxi_fleet/driver-profiles?${params}`)
      if (cancelled) return
      setRows(Array.isArray(call.result?.items) ? call.result.items : [])
      setTotalPages(call.result?.totalPages ?? 1)
      setTotal(call.result?.total ?? call.result?.items?.length ?? 0)
      setIsLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [page, reloadToken, scopeVersion])

  const detailHref = (id: string) => `${TAXI_FLEET_BASE}/drivers/${encodeURIComponent(id)}`

  const handleRefresh = React.useCallback(() => {
    setPage(1)
    setReloadToken((value) => value + 1)
    void reloadDirectory()
  }, [reloadDirectory])

  const handleDelete = React.useCallback(
    async (row: DriverRow) => {
      const confirmed = await confirm({
        title: t('taxi_fleet.drivers.list.deleteConfirm', 'Delete this driver profile?'),
        variant: 'destructive',
      })
      if (!confirmed) return
      await deleteCrud('taxi_fleet/driver-profiles', row.id, {
        errorMessage: t('taxi_fleet.drivers.list.deleteError', 'Failed to delete driver profile.'),
      })
      flash(t('taxi_fleet.drivers.list.deleteSuccess', 'Driver profile deleted.'), 'success')
      handleRefresh()
    },
    [confirm, handleRefresh, t],
  )

  const columns = React.useMemo<ColumnDef<DriverRow>[]>(
    () => [
      {
        accessorKey: 'teamMemberId',
        header: t('taxi_fleet.drivers.member', 'Team member'),
        cell: ({ row }) => (
          <Link href={detailHref(row.original.id)} className="font-medium hover:underline">
            {resolveName(row.original.teamMemberId)}
          </Link>
        ),
      },
      {
        accessorKey: 'payoutPercent',
        header: t('taxi_fleet.drivers.payoutPercent', 'Payout'),
        cell: ({ row }) => formatPercentDisplay(row.original.payoutPercent),
      },
      {
        accessorKey: 'externalAppEnabled',
        header: t('taxi_fleet.drivers.mobileApp', 'Mobile app'),
        cell: ({ row }) =>
          row.original.externalAppEnabled ? (
            <Badge>{t('common.yes', 'Yes')}</Badge>
          ) : (
            <Badge variant="secondary">{t('common.no', 'No')}</Badge>
          ),
      },
    ],
    [resolveName, t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable<DriverRow>
          title={t('taxi_fleet.drivers.title', 'Driver profiles')}
          description={t('taxi_fleet.drivers.description', 'Payout settings and mobile app access per driver.')}
          refreshButton={{
            label: t('taxi_fleet.drivers.list.actions.refresh', 'Refresh'),
            onRefresh: handleRefresh,
          }}
          actions={
            canManageSettlements ? (
              <Button type="button" size="sm" className="inline-flex items-center gap-2" asChild>
                <Link href={`${TAXI_FLEET_BASE}/drivers/create`}>
                  <Plus className="size-4 shrink-0" aria-hidden />
                  {t('taxi_fleet.drivers.create', 'Add driver profile')}
                </Link>
              </Button>
            ) : null
          }
          columns={columns}
          data={rows}
          rowActions={(row) => (
            <RowActions
              items={[
                {
                  id: 'view',
                  label: t('taxi_fleet.drivers.list.actions.viewDetails', 'View details'),
                  onSelect: () => router.push(detailHref(row.id)),
                },
                {
                  id: 'open-tab',
                  label: t('taxi_fleet.drivers.list.actions.openInNewTab', 'Open in new tab'),
                  onSelect: () => window.open(detailHref(row.id), '_blank', 'noopener,noreferrer'),
                },
                ...(canManageSettlements
                  ? [
                      {
                        id: 'delete',
                        label: t('taxi_fleet.drivers.list.actions.delete', 'Delete'),
                        destructive: true as const,
                        onSelect: () => void handleDelete(row),
                      },
                    ]
                  : []),
              ]}
            />
          )}
          onRowClick={(row) => router.push(detailHref(row.id))}
          isLoading={isLoading}
          emptyState={t('taxi_fleet.drivers.empty', 'No driver profiles configured.')}
          pagination={{ page, totalPages, total, pageSize: PAGE_SIZE, onPageChange: setPage }}
          perspective={{ tableId: 'taxi_fleet.drivers' }}
        />
      </PageBody>
      {ConfirmDialogElement}
    </Page>
  )
}
