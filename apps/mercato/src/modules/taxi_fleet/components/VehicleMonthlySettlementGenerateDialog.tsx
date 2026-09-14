'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { CrudForm, type CrudField } from '@open-mercato/ui/backend/CrudForm'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { TAXI_FLEET_BASE } from '../backend/taxi-fleet/paths'
import { isMonthFullyCompleted, listRecentMonthStarts } from '../lib/weekUtils'
import {
  TaxiFleetDialogFrame,
  taxiFleetDialogCrudBodyClass,
  useTaxiFleetDialogShortcuts,
} from './TaxiFleetDialogShell'
import { z } from 'zod'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerated?: () => void
}

type FormValues = { monthStart: string }

function generateSchema() {
  return z.object({
    monthStart: z.string().regex(/^\d{4}-\d{2}-01$/),
  })
}

export function VehicleMonthlySettlementGenerateDialog({ open, onOpenChange, onGenerated }: Props) {
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
    setLoadingMonths(true)
    const pastMonths = listRecentMonthStarts(24).filter((monthStart) => isMonthFullyCompleted(monthStart))
    setAvailableMonths(pastMonths)
    setFormKey((value) => value + 1)
    setLoadingMonths(false)
  }, [open])

  const fields = React.useMemo((): CrudField[] => {
    if (loadingMonths || availableMonths.length === 0) {
      return [
        {
          id: 'monthStart',
          type: 'custom',
          label: t('taxi_fleet.vehicleMonthlySettlements.monthStart', 'Month'),
          required: true,
          layout: 'full',
          component: () => (
            <p className="text-sm text-muted-foreground">
              {loadingMonths
                ? t('common.loading', 'Loading…')
                : t(
                    'taxi_fleet.vehicleMonthlySettlements.noAvailableMonths',
                    'No completed calendar months are available yet.',
                  )}
            </p>
          ),
        },
      ]
    }
    return [
      {
        id: 'monthStart',
        type: 'select',
        label: t('taxi_fleet.vehicleMonthlySettlements.monthStart', 'Month'),
        description: t(
          'taxi_fleet.vehicleMonthlySettlements.generateMonthHint',
          'Select the first day of the calendar month (YYYY-MM-01).',
        ),
        required: true,
        layout: 'full',
        options: availableMonths.map((monthStart) => ({
          value: monthStart,
          label: monthStart.slice(0, 7),
        })),
      },
    ]
  }, [availableMonths, loadingMonths, t])

  const initialValues = React.useMemo(
    (): FormValues => ({ monthStart: availableMonths[0] ?? '' }),
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
    async (values: FormValues) => {
      if (!canSubmit || !organizationId || !tenantId) {
        throw new Error(
          t(
            'taxi_fleet.vehicleMonthlySettlements.errors.scopeRequired',
            'Organization scope is required.',
          ),
        )
      }
      const call = await apiCall<{ id: string | null; ids: string[] }>(
        '/api/taxi_fleet/vehicle-monthly-settlements/generate',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            tenantId,
            organizationId,
            monthStart: values.monthStart,
          }),
        },
      )
      if (!call.ok) {
        throw new Error(
          (call.result as { error?: string } | null)?.error ||
            t(
              'taxi_fleet.vehicleMonthlySettlements.form.saveError',
              'Could not generate vehicle monthly settlements.',
            ),
        )
      }
      const ids = call.result?.ids ?? []
      flash(
        t(
          'taxi_fleet.vehicleMonthlySettlements.generatedBatch',
          'Generated {count} vehicle settlement(s).',
          { count: String(ids.length) },
        ),
        'success',
      )
      onOpenChange(false)
      onGenerated?.()
      if (ids[0]) {
        router.push(`${TAXI_FLEET_BASE}/vehicle-monthly-settlements/${encodeURIComponent(ids[0])}`)
      }
    },
    [canSubmit, onGenerated, onOpenChange, organizationId, router, t, tenantId],
  )

  return (
    <TaxiFleetDialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title={t('taxi_fleet.vehicleMonthlySettlements.generateTitle', 'Generate vehicle monthly settlements')}
      contentRef={dialogContentRef}
      onKeyDown={handleDialogKeyDown}
    >
      <div className={taxiFleetDialogCrudBodyClass}>
        <CrudForm<FormValues>
          key={formKey}
          embedded
          schema={generateSchema()}
          fields={fields}
          initialValues={initialValues}
          submitLabel={t(
            'taxi_fleet.vehicleMonthlySettlements.form.submitGenerate',
            'Generate (⌘/Ctrl + Enter)',
          )}
          submitDisabled={!canSubmit}
          onSubmit={handleSubmit}
        />
      </div>
    </TaxiFleetDialogFrame>
  )
}
