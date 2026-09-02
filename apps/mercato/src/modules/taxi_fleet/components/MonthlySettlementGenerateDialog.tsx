'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { TAXI_FLEET_BASE } from '../backend/taxi-fleet/paths'
import { listUnsettledMonths, normalizeDateOnly } from '../lib/weekUtils'
import {
  TaxiFleetDialogFrame,
  taxiFleetDialogCrudBodyClass,
  useTaxiFleetDialogShortcuts,
} from './TaxiFleetDialogShell'
import { z } from 'zod'

type MonthlySettlementGenerateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerated?: () => void
}

type MonthlySettlementListItem = {
  monthStart?: string
}

type MonthlyGenerateFormValues = {
  monthStart: string
}

function monthlyGenerateSchema() {
  return z.object({
    monthStart: z.string().regex(/^\d{4}-\d{2}-01$/),
  })
}

export function MonthlySettlementGenerateDialog({
  open,
  onOpenChange,
  onGenerated,
}: MonthlySettlementGenerateDialogProps) {
  const t = useT()
  const router = useRouter()
  const { organizationId, tenantId } = useOrganizationScopeDetail()
  const dialogContentRef = React.useRef<HTMLDivElement | null>(null)
  const [formKey, setFormKey] = React.useState(0)
  const [availableMonths, setAvailableMonths] = React.useState<string[]>([])
  const [loadingMonths, setLoadingMonths] = React.useState(false)

  const canSubmit = !loadingMonths && availableMonths.length > 0

  React.useEffect(() => {
    if (!open) return
    setFormKey((value) => value + 1)
    setAvailableMonths([])
  }, [open])

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    async function loadMonths() {
      setLoadingMonths(true)
      const call = await apiCall<{ items: MonthlySettlementListItem[] }>(
        '/api/taxi_fleet/monthly-settlements?page=1&pageSize=100',
      )
      if (cancelled) return
      if (!call.ok) {
        setAvailableMonths([])
        setLoadingMonths(false)
        flash(
          (call.result as { error?: string } | null)?.error ??
            t('taxi_fleet.monthlySettlements.loadMonthsError', 'Could not load existing monthly settlements.'),
          'error',
        )
        return
      }
      const existing = new Set(
        (Array.isArray(call.result?.items) ? call.result.items : [])
          .map((item) => normalizeDateOnly(item.monthStart))
          .filter((value) => value.length > 0),
      )
      setAvailableMonths(listUnsettledMonths(existing))
      setFormKey((value) => value + 1)
      setLoadingMonths(false)
    }
    void loadMonths()
    return () => {
      cancelled = true
    }
  }, [open, t])

  const fields = React.useMemo(
    () => [
      {
        id: 'monthStart',
        type: loadingMonths ? ('custom' as const) : availableMonths.length === 0 ? ('custom' as const) : ('select' as const),
        label: t('taxi_fleet.monthlySettlements.monthStart', 'Month'),
        description: t(
          'taxi_fleet.monthlySettlements.generateMonthHint',
          'Select the first day of the calendar month (YYYY-MM-01).',
        ),
        required: true,
        layout: 'full' as const,
        ...(loadingMonths
          ? {
              component: () => (
                <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading…')}</p>
              ),
            }
          : availableMonths.length === 0
            ? {
                component: () => (
                  <p className="text-sm text-muted-foreground">
                    {t('taxi_fleet.monthlySettlements.noAvailableMonths', 'All recent months already have settlements.')}
                  </p>
                ),
              }
            : {
                options: availableMonths.map((monthStart) => ({
                  value: monthStart,
                  label: monthStart.slice(0, 7),
                })),
              }),
      },
    ],
    [availableMonths, loadingMonths, t],
  )

  const initialValues = React.useMemo(
    (): MonthlyGenerateFormValues => ({ monthStart: availableMonths[0] ?? '' }),
    [availableMonths, formKey],
  )

  const handleCancel = React.useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const handleDialogKeyDown = useTaxiFleetDialogShortcuts({
    contentRef: dialogContentRef,
    onCancel: handleCancel,
    canSubmit,
  })

  const handleSubmit = React.useCallback(
    async (values: MonthlyGenerateFormValues) => {
      if (!organizationId || !tenantId) {
        throw new Error(t('taxi_fleet.errors.generic', 'Operation failed.'))
      }
      if (!values.monthStart || !availableMonths.includes(values.monthStart)) {
        throw new Error(t('taxi_fleet.monthlySettlements.monthAlreadySettled', 'This month already has a settlement.'))
      }
      const call = await apiCall<{ id?: string | null }>('/api/taxi_fleet/monthly-settlements/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          monthStart: values.monthStart,
          tenantId,
          organizationId,
        }),
      })
      if (!call.ok) {
        throw new Error(
          (call.result as { error?: string } | null)?.error ??
            t('taxi_fleet.monthlySettlements.form.saveError', 'Could not generate monthly settlement.'),
        )
      }
      const newId = typeof call.result?.id === 'string' ? call.result.id : ''
      if (!newId) throw new Error(t('taxi_fleet.settlements.form.missingId', 'No id returned.'))
      flash(t('taxi_fleet.monthlySettlements.generated', 'Monthly settlement generated.'), 'success')
      onOpenChange(false)
      onGenerated?.()
      router.push(`${TAXI_FLEET_BASE}/monthly-settlements/${encodeURIComponent(newId)}`)
    },
    [availableMonths, onGenerated, onOpenChange, organizationId, router, t, tenantId],
  )

  return (
    <TaxiFleetDialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title={t('taxi_fleet.monthlySettlements.generateTitle', 'Generate monthly settlement')}
      contentRef={dialogContentRef}
      onKeyDown={handleDialogKeyDown}
    >
      <div className={taxiFleetDialogCrudBodyClass}>
        <CrudForm<MonthlyGenerateFormValues>
          key={formKey}
          embedded
          fields={fields}
          initialValues={initialValues}
          schema={monthlyGenerateSchema()}
          submitLabel={t('taxi_fleet.monthlySettlements.form.submitGenerate', 'Generate (⌘/Ctrl + Enter)')}
          onSubmit={handleSubmit}
        />
      </div>
    </TaxiFleetDialogFrame>
  )
}
