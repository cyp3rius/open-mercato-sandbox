"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { TAXI_FLEET_BASE } from '../backend/taxi-fleet/paths'
import { listRecentMondays, normalizeDateOnly } from '../lib/weekUtils'
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
  teamMemberId?: string
  team_member_id?: string
}

function firstUnsettledWeek(recentWeeks: string[], settledWeekStarts: Set<string>): string {
  return recentWeeks.find((weekStart) => !settledWeekStarts.has(weekStart)) ?? ''
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
  const [dialogSession, setDialogSession] = React.useState(0)
  const [weeksRevision, setWeeksRevision] = React.useState(0)
  const [recentWeeks, setRecentWeeks] = React.useState<string[]>([])
  const [settledWeekStarts, setSettledWeekStarts] = React.useState<Set<string>>(() => new Set())
  const [loadingWeeks, setLoadingWeeks] = React.useState(false)

  const effectiveDriverId = lockedTeamMemberId ?? (selectedDriverId.trim() || null)
  const driverSelected = Boolean(effectiveDriverId)
  const unsettledWeeks = React.useMemo(
    () => recentWeeks.filter((weekStart) => !settledWeekStarts.has(weekStart)),
    [recentWeeks, settledWeekStarts],
  )
  const canSubmit = driverSelected && !loadingWeeks && unsettledWeeks.length > 0

  React.useEffect(() => {
    if (!open) return
    setDialogSession((value) => value + 1)
    setWeeksRevision(0)
    setSelectedDriverId('')
    setRecentWeeks([])
    setSettledWeekStarts(new Set())
  }, [open])

  React.useEffect(() => {
    if (!open || !effectiveDriverId) {
      setRecentWeeks([])
      setSettledWeekStarts(new Set())
      setWeeksRevision(0)
      return
    }
    const driverId = effectiveDriverId
    let cancelled = false
    setRecentWeeks([])
    setSettledWeekStarts(new Set())
    setWeeksRevision(0)
    async function loadWeeks() {
      setLoadingWeeks(true)
      const params = new URLSearchParams({
        page: '1',
        pageSize: '100',
        teamMemberId: driverId,
      })
      const call = await apiCall<{ items: SettlementListItem[] }>(`/api/taxi_fleet/settlements?${params}`)
      if (cancelled) return
      if (!call.ok) {
        setRecentWeeks([])
        setSettledWeekStarts(new Set())
        setLoadingWeeks(false)
        flash(
          (call.result as { error?: string } | null)?.error ??
            t('taxi_fleet.settlements.loadWeeksError', 'Could not load existing settlement weeks.'),
          'error',
        )
        return
      }
      const existing = new Set(
        (Array.isArray(call.result?.items) ? call.result.items : [])
          .filter((item) => {
            const memberId = item.teamMemberId ?? item.team_member_id ?? ''
            return memberId === effectiveDriverId
          })
          .map((item) => normalizeDateOnly(item.weekStart))
          .filter((value) => value.length > 0),
      )
      setRecentWeeks(listRecentMondays())
      setSettledWeekStarts(existing)
      setLoadingWeeks(false)
      setWeeksRevision((value) => value + 1)
    }
    void loadWeeks()
    return () => {
      cancelled = true
    }
  }, [effectiveDriverId, open, t])

  const handleDriverChange = React.useCallback((teamMemberId: string) => {
    setSelectedDriverId(teamMemberId)
  }, [])

  const fields = React.useMemo(
    () =>
      buildSettlementGenerateDialogFields(t, {
        includeDriver: !isDriverLocked,
        driverProfiles: profiles,
        resolveDriverName: resolveName,
        recentWeeks,
        settledWeekStarts,
        weeksLoading: loadingWeeks,
        driverSelected,
        onDriverChange: handleDriverChange,
      }),
    [
      driverSelected,
      handleDriverChange,
      isDriverLocked,
      loadingWeeks,
      profiles,
      recentWeeks,
      resolveName,
      settledWeekStarts,
      t,
    ],
  )

  const defaultWeekStart = firstUnsettledWeek(recentWeeks, settledWeekStarts)

  const initialValues = React.useMemo(() => {
    if (isDriverLocked) {
      return defaultSettlementGenerateWeekValues(defaultWeekStart)
    }
    return defaultSettlementGenerateValues(defaultWeekStart, effectiveDriverId ?? '')
  }, [defaultWeekStart, dialogSession, effectiveDriverId, isDriverLocked, weeksRevision])

  const formKey = isDriverLocked
    ? `locked-${lockedTeamMemberId}-${dialogSession}-${weeksRevision}`
    : `gen-${effectiveDriverId ?? 'none'}-${dialogSession}-${weeksRevision}`

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
      // Prefer dialog driver state over form values — form remount races can send the previous driver.
      const teamMemberId = effectiveDriverId ?? lockedTeamMemberId ?? ('teamMemberId' in values ? values.teamMemberId : '')
      if (!teamMemberId) {
        throw new Error(t('taxi_fleet.settlements.pickDriverFirst', 'Select a driver to choose the settlement week.'))
      }
      if (!values.weekStart || settledWeekStarts.has(values.weekStart)) {
        throw new Error(
          t(
            'taxi_fleet.settlements.weekAlreadySettled',
            'This driver already has a settlement for this week.',
          ),
        )
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
        throw new Error(
          (call.result as { error?: string } | null)?.error ??
            t('taxi_fleet.settlements.form.saveError', 'Could not generate settlement.'),
        )
      }
      const newId = typeof call.result?.id === 'string' ? call.result.id : ''
      if (!newId) throw new Error(t('taxi_fleet.settlements.form.missingId', 'No id returned.'))
      flash(t('taxi_fleet.settlements.generated', 'Settlement generated.'), 'success')
      onOpenChange(false)
      onGenerated?.()
      router.push(`${TAXI_FLEET_BASE}/settlements/${encodeURIComponent(newId)}`)
    },
    [effectiveDriverId, lockedTeamMemberId, onGenerated, onOpenChange, organizationId, router, settledWeekStarts, t, tenantId],
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
