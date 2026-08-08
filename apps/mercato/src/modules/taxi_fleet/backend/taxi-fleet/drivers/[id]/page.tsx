"use client"

import * as React from 'react'
import Link from 'next/link'
import { ApplyBreadcrumb } from '@open-mercato/ui/backend/AppShell'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { FormHeader } from '@open-mercato/ui/backend/forms'
import { LoadingMessage, ErrorMessage } from '@open-mercato/ui/backend/detail'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { DetailTabsLayout } from '@open-mercato/core/modules/customers/components/detail/DetailTabsLayout'
import { TAXI_FLEET_BASE } from '../../paths'
import { useFleetDriverDirectory } from '../../../../components/useFleetDriverDirectory'
import { useResourceLabels } from '../../../../components/useResourceLabels'
import { useTaxiFleetPermissions } from '../../../../components/useTaxiFleetPermissions'
import { DriverProfileBasicsPanel } from '../../../../components/driver/DriverProfileBasicsPanel'
import { DriverTripsTab } from '../../../../components/driver/DriverTripsTab'
import { DriverAllocationsTab } from '../../../../components/driver/DriverAllocationsTab'
import { DriverSettlementsTab } from '../../../../components/driver/DriverSettlementsTab'
import { mapDriverProfileRowToUpdateFormValues } from '../../../../components/driverProfileFormConfig'

type DriverRow = {
  id: string
  teamMemberId: string
  payoutPercent: string
  defaultResourceId?: string | null
  externalAppEnabled: boolean
}

type DriverDetailTabId = 'trips' | 'allocations' | 'settlements'

export default function TaxiFleetDriverDetailPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const profileId = params?.id ?? ''
  const { ConfirmDialogElement } = useConfirmDialog()
  const { profiles, resolveName, reload: reloadDirectory } = useFleetDriverDirectory()
  const { canManageTrips, canManageSettlements, canManageAssignments } = useTaxiFleetPermissions()
  const [row, setRow] = React.useState<DriverRow | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [tab, setTab] = React.useState<DriverDetailTabId>('trips')

  const load = React.useCallback(async () => {
    if (!profileId) return
    setLoading(true)
    setError(null)
    const call = await apiCall<{ items: DriverRow[] }>(
      `/api/taxi_fleet/driver-profiles?ids=${encodeURIComponent(profileId)}`,
    )
    const item = call.result?.items?.[0] ?? null
    if (!item) {
      setError(t('taxi_fleet.drivers.detail.notFound', 'Driver profile not found.'))
      setRow(null)
    } else {
      setRow(item)
    }
    setLoading(false)
  }, [profileId, t])

  React.useEffect(() => {
    void load()
  }, [load])

  const resourceIds = React.useMemo(() => {
    const id = row?.defaultResourceId
    return id ? [id] : []
  }, [row?.defaultResourceId])
  const { resolveLabel: resolveResourceLabel } = useResourceLabels(resourceIds)

  const displayName = row ? resolveName(row.teamMemberId) : t('taxi_fleet.drivers.detail.title', 'Driver profile')

  const initialValues = React.useMemo(() => {
    if (!row) {
      return mapDriverProfileRowToUpdateFormValues({
        payoutPercent: 0,
        defaultResourceId: '',
        externalAppEnabled: false,
      })
    }
    return mapDriverProfileRowToUpdateFormValues(row)
  }, [row])

  const tabs = React.useMemo(
    () => [
      { id: 'trips' as const, label: t('taxi_fleet.drivers.tabs.trips', 'Trips') },
      { id: 'allocations' as const, label: t('taxi_fleet.drivers.tabs.allocations', 'Allocations') },
      { id: 'settlements' as const, label: t('taxi_fleet.drivers.tabs.settlements', 'Settlements') },
    ],
    [t],
  )

  if (loading) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage label={t('taxi_fleet.drivers.detail.loading', 'Loading…')} />
        </PageBody>
        {ConfirmDialogElement}
      </Page>
    )
  }

  if (error || !row) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage label={error ?? t('taxi_fleet.drivers.detail.notFound', 'Driver profile not found.')} />
          <p className="mt-4 text-sm">
            <Link href={`${TAXI_FLEET_BASE}/drivers`} className="text-primary hover:underline">
              {t('taxi_fleet.drivers.detail.backToList', 'Back to drivers')}
            </Link>
          </p>
        </PageBody>
        {ConfirmDialogElement}
      </Page>
    )
  }

  return (
    <>
      <ApplyBreadcrumb
        breadcrumb={[
          { label: 'Dashboard', labelKey: 'taxi_fleet.hub.dashboardTitle', href: TAXI_FLEET_BASE },
          { label: 'Driver profiles', labelKey: 'taxi_fleet.drivers.list.title', href: `${TAXI_FLEET_BASE}/drivers` },
          { label: displayName },
        ]}
        title={displayName}
      />
      <Page>
        <PageBody>
          <FormHeader
            mode="detail"
            backHref={`${TAXI_FLEET_BASE}/drivers`}
            backLabel={t('taxi_fleet.drivers.detail.backToList', 'Back to drivers')}
            entityTypeLabel={t('taxi_fleet.drivers.detail.title', 'Driver profile')}
            title={displayName}
          />
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[7fr_3fr] lg:items-start">
            <div className="min-w-0">
              <DetailTabsLayout<DriverDetailTabId>
                tabs={tabs}
                activeTab={tab}
                onTabChange={setTab}
                sectionAction={null}
                onSectionAction={() => {}}
                navAriaLabel={t('taxi_fleet.drivers.tabs.nav', 'Driver sections')}
                panelContentKey={tab}
              >
                {tab === 'trips' ? (
                  <DriverTripsTab
                    teamMemberId={row.teamMemberId}
                    defaultResourceId={row.defaultResourceId}
                    driverProfiles={profiles}
                    resolveDriverName={resolveName}
                    resolveResourceLabel={resolveResourceLabel}
                    canManageTrips={canManageTrips}
                  />
                ) : null}
                {tab === 'allocations' ? (
                  <DriverAllocationsTab
                    teamMemberId={row.teamMemberId}
                    defaultResourceId={row.defaultResourceId}
                    resolveDriverName={resolveName}
                    resolveResourceLabel={resolveResourceLabel}
                    canManageAssignments={canManageAssignments}
                  />
                ) : null}
                {tab === 'settlements' ? (
                  <DriverSettlementsTab
                    teamMemberId={row.teamMemberId}
                    canManageSettlements={canManageSettlements}
                  />
                ) : null}
              </DetailTabsLayout>
            </div>
            <div className="min-w-0">
              <DriverProfileBasicsPanel
                profileId={row.id}
                initialValues={initialValues}
                teamMemberId={row.teamMemberId}
                memberDisplayName={displayName}
                readOnly={!canManageSettlements}
                onSaved={() => {
                  void reloadDirectory()
                  void load()
                }}
                onDeleted={() => {
                  void reloadDirectory()
                }}
              />
            </div>
          </div>
        </PageBody>
        {ConfirmDialogElement}
      </Page>
    </>
  )
}
