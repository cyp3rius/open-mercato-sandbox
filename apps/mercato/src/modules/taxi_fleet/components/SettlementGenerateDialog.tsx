"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { TAXI_FLEET_BASE } from '../backend/taxi-fleet/paths'
import { listUnsettledMondays } from '../lib/weekUtils'
import { useFleetDriverDirectory } from './useFleetDriverDirectory'
import {
  TaxiFleetDialogFrame,
  taxiFleetDialogCrudBodyClass,
  useTaxiFleetDialogShortcuts,
} from './TaxiFleetDialogShell'
import {
  buildSettlementGenerateDialogFields,
  defaultSettlementGenerateValues,
  defaultSettlementGenerateWeekValues,
  settlementGenerateSchema,
  settlementGenerateWeekSchema,
  type SettlementGenerateFormValues,
  type SettlementGenerateWeekFormValues,
} from './settlementFormConfig'

type SettlementGenerateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamMemberId?: string
  onGenerated?: () => void
}

type SettlementListItem = {
  weekStart?: string
}

export function SettlementGenerateDialog({
  open,
  onOpenChange,
  teamMemberId: lockedTeamMemberId,
  onGenerated,
}: SettlementGenerateDialogProps) {
  const t = useT()
  const router = useRouter()
  const { organizationId, tenantId } = useOrganizationScopeDetail()
  const { profiles, resolveName } = useFleetDriverDirectory()
  const dialogContentRef = React.useRef<HTMLDivElement | null>(null)
  const isDriverLocked = Boolean(lockedTeamMemberId)
  const [selectedDriverId, setSelectedDriverId] = React.useState('')
  const [formKey, setFormKey] = React.useState(0)
  const [availableWeeks, setAvailableWeeks] = React.useState<string[]>([])
  const [loadingWeeks, setLoadingWeeks] = React.useState(false)

  const effectiveDriverId = lockedTeamMemberId ?? (selectedDriverId.trim() || null)
  const driverSelected = Boolean(effectiveDriverId)
  const canSubmit = driverSelected && !loadingWeeks && availableWeeks.length > 0

  React.useEffect(() => {
    if (!open) return
    setFormKey((value) => value + 1)
    setSelectedDriverId('')
    setAvailableWeeks([])
  }, [open])

  React.useEffect(() => {
    if (!open || !effectiveDriverId) {
      setAvailableWeeks([])
      return
    }
    let cancelled = false
    async function loadWeeks() {
      setLoadingWeeks(true)
      const params = new URLSearchParams({
        page: '1',
        pageSize: '200',
        teamMemberId: effectiveDriverId,
      })
      const call = await apiCall<{ items: SettlementListItem[] }>(`/api/taxi_fleet/settlements?${params}`)
      if (cancelled) return
      const existing = new Set(
        (Array.isArray(call.result?.items) ? call.result.items : [])
          .map((item) => (typeof item.weekStart === 'string' ? item.weekStart : ''))
          .filter((value) => value.length > 0),
      )
      setAvailableWeeks(listUnsettledMondays(existing))
      setFormKey((value) => value + 1)
      setLoadingWeeks(false)
    }
    void loadWeeks()
    return () => {
      cancelled = true
    }
  }, [effectiveDriverId, open])

  const handleDriverChange = React.useCallback((teamMemberId: string) => {
    setSelectedDriverId(teamMemberId)
  }, [])

  const fields = React.useMemo(
    () =>
      buildSettlementGenerateDialogFields(t, {
        includeDriver: !isDriverLocked,
        driverProfiles: profiles,
        resolveDriverName: resolveName,
        availableWeeks,
        weeksLoading: loadingWeeks,
        driverSelected,
        onDriverChange: handleDriverChange,
      }),
    [
      availableWeeks,
      driverSelected,
      handleDriverChange,
      isDriverLocked,
      loadingWeeks,
      profiles,
      resolveName,
      t,
    ],
  )

  const initialValues = React.useMemo(() => {
    const weekStart = availableWeeks[0] ?? ''
    if (isDriverLocked) {
      return defaultSettlementGenerateWeekValues(weekStart)
    }
    return defaultSettlementGenerateValues(weekStart)
  }, [availableWeeks, formKey, isDriverLocked])

  const handleCancel = React.useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const handleDialogKeyDown = useTaxiFleetDialogShortcuts({
    contentRef: dialogContentRef,
    onCancel: handleCancel,
    canSubmit,
  })

  const handleSubmit = React.useCallback(
    async (values: SettlementGenerateFormValues | SettlementGenerateWeekFormValues) => {
      if (!organizationId || !tenantId) {
        throw new Error(t('taxi_fleet.errors.generic', 'Operation failed.'))
      }
      const teamMemberId = lockedTeamMemberId ?? ('teamMemberId' in values ? values.teamMemberId : '')
      if (!teamMemberId) {
        throw new Error(t('taxi_fleet.settlements.pickDriverFirst', 'Select a driver to choose the settlement week.'))
      }
      if (!values.weekStart || !availableWeeks.includes(values.weekStart)) {
        throw new Error(t('taxi_fleet.settlements.weekAlreadySettled', 'This week already has a settlement.'))
      }
      const call = await apiCall<{ id?: string | null }>('/api/taxi_fleet/settlements/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          teamMemberId,
          weekStart: values.weekStart,
          tenantId,
          organizationId,
        }),
      })
      if (!call.ok) {
        throw new Error(t('taxi_fleet.settlements.form.saveError', 'Could not generate settlement.'))
      }
      const newId = typeof call.result?.id === 'string' ? call.result.id : ''
      if (!newId) throw new Error(t('taxi_fleet.settlements.form.missingId', 'No id returned.'))
      flash(t('taxi_fleet.settlements.generated', 'Settlement generated.'), 'success')
      onOpenChange(false)
      onGenerated?.()
      router.push(`${TAXI_FLEET_BASE}/settlements/${encodeURIComponent(newId)}`)
    },
    [availableWeeks, lockedTeamMemberId, onGenerated, onOpenChange, organizationId, router, t, tenantId],
  )

  return (
    <TaxiFleetDialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title={t('taxi_fleet.settlements.generateTitle', 'Generate settlement')}
      contentRef={dialogContentRef}
      onKeyDown={handleDialogKeyDown}
    >
      <div className={taxiFleetDialogCrudBodyClass}>
        {isDriverLocked ? (
          <CrudForm<SettlementGenerateWeekFormValues>
            key={formKey}
            embedded
            fields={fields}
            initialValues={initialValues as SettlementGenerateWeekFormValues}
            schema={settlementGenerateWeekSchema()}
            submitLabel={t('taxi_fleet.settlements.form.submitGenerate', 'Generate (⌘/Ctrl + Enter)')}
            onSubmit={handleSubmit}
          />
        ) : (
          <CrudForm<SettlementGenerateFormValues>
            key={formKey}
            embedded
            fields={fields}
            initialValues={initialValues as SettlementGenerateFormValues}
            schema={settlementGenerateSchema()}
            submitLabel={t('taxi_fleet.settlements.form.submitGenerate', 'Generate (⌘/Ctrl + Enter)')}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </TaxiFleetDialogFrame>
  )
}
