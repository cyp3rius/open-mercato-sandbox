"use client"

import * as React from 'react'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { RESOURCES_RESOURCE_FIELDSET_VEHICLE } from '@open-mercato/core/modules/resources/lib/resourceCustomFields'

type PolicyItem = {
  id: string
  policyNumber: string
  validFrom: string | null
  validTo: string | null
}

type FinancingKind = 'lease' | 'loan' | 'cash' | 'other'

function readFinancing(values: Record<string, unknown>): Record<string, unknown> {
  const raw = values.financingProfile
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  return {}
}

export function ResourceVehicleCommercialSection(props: {
  values: Record<string, unknown>
  setFormValue: (id: string, value: unknown) => void
  disabled?: boolean
  resourceId: string | null
  financingEligibleByTypeId: Map<string, boolean>
  resolveFieldsetCode: (resourceTypeId?: string | null) => string
}) {
  const { values, setFormValue, disabled, resourceId, financingEligibleByTypeId, resolveFieldsetCode } = props
  const t = useT()
  const resourceTypeId =
    typeof values.resourceTypeId === 'string' && values.resourceTypeId.trim().length > 0
      ? values.resourceTypeId.trim()
      : null
  const fieldsetCode = resolveFieldsetCode(resourceTypeId)
  const isVehicle = fieldsetCode === RESOURCES_RESOURCE_FIELDSET_VEHICLE
  const financingOk = resourceTypeId ? financingEligibleByTypeId.get(resourceTypeId) === true : false

  const [policies, setPolicies] = React.useState<PolicyItem[]>([])
  React.useEffect(() => {
    if (!isVehicle) {
      setPolicies([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const params = new URLSearchParams({ page: '1', pageSize: '50', sortField: 'validFrom', sortDir: 'desc' })
        if (resourceId) params.set('resourceId', resourceId)
        const res = await apiCall<{ items?: PolicyItem[] }>(`/api/insurance/policies?${params.toString()}`)
        if (cancelled || !res.ok) return
        setPolicies(Array.isArray(res.result?.items) ? res.result.items : [])
      } catch {
        if (!cancelled) setPolicies([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isVehicle, resourceId])

  if (!isVehicle) return null

  const fp = readFinancing(values)
  const patchFinancing = (next: Record<string, unknown>) => {
    setFormValue('financingProfile', { ...fp, ...next })
  }

  const currentPolicy =
    typeof values.insurancePolicyId === 'string' && values.insurancePolicyId.trim().length > 0
      ? values.insurancePolicyId.trim()
      : ''

  return (
    <div className="space-y-4 rounded-md border border-border/60 bg-muted/5 p-4">
      <div className="text-sm font-semibold">
        {t('resources.resources.form.vehicleCommercial.title', 'Vehicle policy & financing')}
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="resource-primary-policy">
          {t('resources.resources.form.vehicleCommercial.primaryPolicy', 'Primary insurance policy')}
        </label>
        <select
          id="resource-primary-policy"
          className="h-9 w-full rounded border px-2 text-sm"
          value={currentPolicy}
          disabled={disabled}
          onChange={(event) => setFormValue('insurancePolicyId', event.target.value || null)}
        >
          <option value="">{t('ui.forms.select.emptyOption', '—')}</option>
          {policies.map((policy) => (
            <option key={policy.id} value={policy.id}>
              {policy.policyNumber}
            </option>
          ))}
        </select>
      </div>
      {financingOk ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="financing-kind">
              {t('resources.resources.form.vehicleCommercial.financingKind', 'Financing kind')}
            </label>
            <select
              id="financing-kind"
              className="h-9 w-full rounded border px-2 text-sm"
              value={typeof fp.financingKind === 'string' ? fp.financingKind : 'lease'}
              disabled={disabled}
              onChange={(event) =>
                patchFinancing({ financingKind: event.target.value as FinancingKind })
              }
            >
              <option value="lease">{t('resources.resources.form.vehicleCommercial.kind.lease', 'Lease')}</option>
              <option value="loan">{t('resources.resources.form.vehicleCommercial.kind.loan', 'Loan')}</option>
              <option value="cash">{t('resources.resources.form.vehicleCommercial.kind.cash', 'Cash')}</option>
              <option value="other">{t('resources.resources.form.vehicleCommercial.kind.other', 'Other')}</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="financing-term">
              {t('resources.resources.form.vehicleCommercial.termMonths', 'Term (months)')}
            </label>
            <input
              id="financing-term"
              type="number"
              min={1}
              className="h-9 w-full rounded border px-2 text-sm"
              value={fp.termMonths != null ? String(fp.termMonths) : ''}
              disabled={disabled}
              onChange={(event) =>
                patchFinancing({
                  termMonths: event.target.value ? Number(event.target.value) : null,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="financing-currency">
              {t('resources.resources.form.vehicleCommercial.currency', 'Currency')}
            </label>
            <input
              id="financing-currency"
              type="text"
              className="h-9 w-full rounded border px-2 text-sm"
              value={typeof fp.currencyCode === 'string' ? fp.currencyCode : ''}
              disabled={disabled}
              onChange={(event) => patchFinancing({ currencyCode: event.target.value || null })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="financing-value">
              {t('resources.resources.form.vehicleCommercial.vehicleValue', 'Vehicle value')}
            </label>
            <input
              id="financing-value"
              type="number"
              step="0.01"
              className="h-9 w-full rounded border px-2 text-sm"
              value={fp.vehicleValueAmount != null ? String(fp.vehicleValueAmount) : ''}
              disabled={disabled}
              onChange={(event) =>
                patchFinancing({
                  vehicleValueAmount: event.target.value ? Number(event.target.value) : null,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="financing-installment">
              {t('resources.resources.form.vehicleCommercial.installment', 'Installment')}
            </label>
            <input
              id="financing-installment"
              type="number"
              step="0.01"
              className="h-9 w-full rounded border px-2 text-sm"
              value={fp.installmentAmount != null ? String(fp.installmentAmount) : ''}
              disabled={disabled}
              onChange={(event) =>
                patchFinancing({
                  installmentAmount: event.target.value ? Number(event.target.value) : null,
                })
              }
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
