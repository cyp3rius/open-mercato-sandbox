'use client'

import * as React from 'react'
import { ApplyBreadcrumb } from '@open-mercato/ui/backend/AppShell'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { Button } from '@open-mercato/ui/primitives/button'
import { LoadingMessage, ErrorMessage } from '@open-mercato/ui/backend/detail'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { TAXI_FLEET_BASE } from '../../paths'
import { useFleetDriverDirectory } from '../../../../components/useFleetDriverDirectory'
import { useTaxiFleetPermissions } from '../../../../components/useTaxiFleetPermissions'
import {
  buildSettlementDetailFields,
  buildSettlementDetailGroups,
  defaultSettlementDetailValues,
  type SettlementFormValues,
} from '../../../../components/settlementFormConfig'

type SettlementRow = {
  id: string
  teamMemberId: string
  weekStart: string
  status: string
  totalRevenue: string
  totalCosts: string
  netAmount: string
  payoutPercent: string
  payoutAmount: string
}

export default function TaxiFleetSettlementDetailPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const settlementId = params?.id ?? ''
  const { resolveName } = useFleetDriverDirectory()
  const { canManageSettlements } = useTaxiFleetPermissions()
  const [row, setRow] = React.useState<SettlementRow | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [formKey, setFormKey] = React.useState(0)
  const [isApproving, setIsApproving] = React.useState(false)

  const load = React.useCallback(async () => {
    if (!settlementId) return
    setLoading(true)
    setError(null)
    const call = await apiCall<{ items: SettlementRow[] }>(
      `/api/taxi_fleet/settlements?ids=${encodeURIComponent(settlementId)}`,
    )
    const item = call.result?.items?.[0] ?? null
    if (!item) {
      setError(t('taxi_fleet.settlements.detail.notFound', 'Settlement not found.'))
      setRow(null)
    } else {
      setRow(item)
    }
    setLoading(false)
  }, [settlementId, t])

  React.useEffect(() => {
    void load()
  }, [load])

  const fields = React.useMemo(
    () => buildSettlementDetailFields(t, !canManageSettlements, resolveName),
    [canManageSettlements, resolveName, t],
  )
  const groups = React.useMemo(() => buildSettlementDetailGroups(t), [t])

  const title = row
    ? `${resolveName(row.teamMemberId)} · ${row.weekStart}`
    : t('taxi_fleet.settlements.detail.title', 'Settlement')

  const initialValues = React.useMemo((): SettlementFormValues => {
    if (!row) return defaultSettlementDetailValues()
    return {
      teamMemberId: row.teamMemberId,
      weekStart: row.weekStart,
      status: row.status,
      totalRevenue: row.totalRevenue,
      totalCosts: row.totalCosts,
      netAmount: row.netAmount,
      payoutPercent: row.payoutPercent,
      payoutAmount: row.payoutAmount,
    }
  }, [row])

  const canApprove =
    canManageSettlements && row != null && (row.status === 'draft' || row.status === 'submitted')

  const approveSettlement = async () => {
    if (!row) return
    setIsApproving(true)
    try {
      await updateCrud(
        'taxi_fleet/settlements',
        { id: row.id, status: 'approved' },
        { errorMessage: t('taxi_fleet.settlements.form.saveError', 'Could not save settlement.') },
      )
      flash(t('taxi_fleet.settlements.approved', 'Settlement approved.'), 'success')
      setFormKey((value) => value + 1)
      await load()
    } finally {
      setIsApproving(false)
    }
  }

  if (loading) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage label={t('taxi_fleet.settlements.detail.loading', 'Loading…')} />
        </PageBody>
      </Page>
    )
  }

  if (error || !row) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage label={error ?? t('taxi_fleet.settlements.detail.notFound', 'Settlement not found.')} />
        </PageBody>
      </Page>
    )
  }

  return (
    <>
      <ApplyBreadcrumb
        breadcrumb={[
          { label: 'Dashboard', labelKey: 'taxi_fleet.hub.dashboardTitle', href: TAXI_FLEET_BASE },
          { label: 'Settlements', labelKey: 'taxi_fleet.settlements.list.title', href: `${TAXI_FLEET_BASE}/settlements` },
          { label: title },
        ]}
        title={title}
      />
      <Page>
        <PageBody>
          <CrudForm<SettlementFormValues>
            key={formKey}
            title={t('taxi_fleet.settlements.detail.title', 'Settlement')}
            backHref={`${TAXI_FLEET_BASE}/settlements`}
            cancelHref={`${TAXI_FLEET_BASE}/settlements`}
            submitLabel={t('taxi_fleet.settlements.form.save', 'Save changes')}
            fields={fields}
            groups={groups}
            initialValues={initialValues}
            readOnly={!canManageSettlements || row.status === 'approved' || row.status === 'paid'}
            extraActions={
              canApprove ? (
                <Button type="button" disabled={isApproving} onClick={() => void approveSettlement()}>
                  {t('taxi_fleet.settlements.approve', 'Approve')}
                </Button>
              ) : null
            }
            onSubmit={async (values) => {
              await updateCrud(
                'taxi_fleet/settlements',
                { id: row.id, status: values.status },
                { errorMessage: t('taxi_fleet.settlements.form.saveError', 'Could not save settlement.') },
              )
              flash(t('taxi_fleet.settlements.form.updated', 'Changes saved.'), 'success')
              setFormKey((value) => value + 1)
              await load()
            }}
          />
        </PageBody>
      </Page>
    </>
  )
}
