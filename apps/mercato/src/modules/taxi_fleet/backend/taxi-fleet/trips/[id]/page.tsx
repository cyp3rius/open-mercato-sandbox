'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BadgeCheck, CalendarClock, Check, CreditCard, X } from 'lucide-react'
import { ApplyBreadcrumb } from '@open-mercato/ui/backend/AppShell'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { Button } from '@open-mercato/ui/primitives/button'
import { Badge } from '@open-mercato/ui/primitives/badge'
import { LoadingMessage, ErrorMessage } from '@open-mercato/ui/backend/detail'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { updateCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { TAXI_FLEET_BASE } from '../../paths'
import { useFleetDriverDirectory } from '../../../../components/useFleetDriverDirectory'
import { useTaxiFleetPermissions } from '../../../../components/useTaxiFleetPermissions'
import { useFleetBackendSession } from '../../../../components/useFleetBackendSession'
import { useTripStatusDictionary } from '../../../../components/useTripStatusDictionary'
import {
  mapTripRowToFormValues,
  tripFormValuesToUpdatePayload,
} from '../../../../components/tripFormConfig'
import { TripCrudForm } from '../../../../components/TripCrudForm'
import { TripReceiptOcrPanel } from '../../../../components/TripReceiptOcrPanel'
import { PlatformTripIngestBadge } from '../../../../components/PlatformTripIngestBadge'
import { PlatformTripIngestPanel } from '../../../../components/PlatformTripIngestPanel'
import { Notice } from '@open-mercato/ui/primitives/Notice'
import { isPlatformIngestedTrip } from '../../../../lib/platformSync/platformTripIngest'
import {
  tripDetailActionsForStatus,
  tripDetailAllowsDriverEdit,
  tripDetailLockMode,
  type TripDetailActionId,
} from '../../../../lib/tripDetailWorkflow'
import { normalizeTripStatus } from '../../../../lib/tripStatuses'

type TripRow = {
  id: string
  teamMemberId: string
  resourceId: string
  tripType: string
  status: string
  platform?: string | null
  externalTripId?: string | null
  customerPersonId?: string | null
  customerCompanyId?: string | null
  startedAt?: string | null
  endedAt?: string | null
  revenueAmount?: string | null
  distanceKm?: string | null
  notes?: string | null
  metadata?: Record<string, unknown> | null
}

type DriverSuggestion = {
  teamMemberId: string
  displayName: string
  score: number
  reasons: string[]
}

const ACTION_BUTTON_CLASS = 'h-9 rounded border shadow-none'

export default function TaxiFleetTripDetailPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const tripId = params?.id ?? ''
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const { profiles, resolveName } = useFleetDriverDirectory()
  const { canManageTrips } = useTaxiFleetPermissions()
  const { isDriverOnly, lockedTeamMemberId } = useFleetBackendSession()
  const { statusOptions } = useTripStatusDictionary()
  const [row, setRow] = React.useState<TripRow | null>(null)
  const [suggestions, setSuggestions] = React.useState<DriverSuggestion[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [formKey, setFormKey] = React.useState(0)
  const [pendingAction, setPendingAction] = React.useState<TripDetailActionId | null>(null)

  const load = React.useCallback(async () => {
    if (!tripId) return
    setLoading(true)
    setError(null)
    const call = await apiCall<{ items: TripRow[] }>(`/api/taxi_fleet/trips?ids=${encodeURIComponent(tripId)}`)
    const item = call.result?.items?.[0] ?? null
    if (!item) {
      setError(t('taxi_fleet.trips.detail.notFound', 'Trip not found.'))
      setRow(null)
      setSuggestions([])
      setLoading(false)
      return
    }
    setRow(item)
    const lockMode = tripDetailLockMode(normalizeTripStatus(item.status))
    if (item.startedAt && item.endedAt && lockMode !== 'full') {
      const params = new URLSearchParams({
        startedAt: item.startedAt,
        endedAt: item.endedAt,
        limit: '5',
      })
      const suggestCall = await apiCall<{ items: DriverSuggestion[] }>(
        `/api/taxi_fleet/trips/suggest-drivers?${params}`,
      )
      setSuggestions(Array.isArray(suggestCall.result?.items) ? suggestCall.result.items : [])
    } else {
      setSuggestions([])
    }
    setLoading(false)
  }, [tripId, t])

  React.useEffect(() => {
    void load()
  }, [load])

  const initialValues = React.useMemo(() => {
    if (!row) {
      return mapTripRowToFormValues({
        teamMemberId: '',
        resourceId: '',
        tripType: 'client',
        status: 'new',
      })
    }
    return mapTripRowToFormValues(row)
  }, [row])

  const handleDelete = React.useCallback(async () => {
    if (!row) return
    const ok = await confirm({
      title: t('taxi_fleet.trips.list.deleteConfirm', 'Delete this trip?'),
      variant: 'destructive',
    })
    if (!ok) return
    await deleteCrud('taxi_fleet/trips', row.id, {
      errorMessage: t('taxi_fleet.trips.list.deleteError', 'Failed to delete trip.'),
    })
    flash(t('taxi_fleet.trips.list.deleteSuccess', 'Trip deleted.'), 'success')
    router.push(`${TAXI_FLEET_BASE}/trips`)
  }, [confirm, row, router, t])

  const breadcrumbTitle = React.useMemo(() => {
    if (!row) return t('taxi_fleet.trips.detail.title', 'Trip')
    return resolveName(row.teamMemberId)
  }, [resolveName, row, t])

  const runStatusAction = React.useCallback(
    async (action: TripDetailActionId) => {
      if (!tripId) return
      if (action === 'reject') {
        const ok = await confirm({
          title: t('taxi_fleet.trips.rejectConfirm', 'Reject this trip?'),
          variant: 'destructive',
        })
        if (!ok) return
      }
      setPendingAction(action)
      const pathByAction: Record<TripDetailActionId, string> = {
        approve: `/api/taxi_fleet/trips/${tripId}/approve`,
        reject: `/api/taxi_fleet/trips/${tripId}/reject`,
        schedule: `/api/taxi_fleet/trips/${tripId}/schedule`,
        mark_paid: `/api/taxi_fleet/trips/${tripId}/mark-paid`,
        complete: `/api/taxi_fleet/trips/${tripId}/complete`,
      }
      const successByAction: Record<TripDetailActionId, string> = {
        approve: t('taxi_fleet.trips.approved', 'Trip approved.'),
        reject: t('taxi_fleet.trips.rejected', 'Trip rejected.'),
        schedule: t('taxi_fleet.trips.scheduled', 'Trip marked for fulfillment.'),
        mark_paid: t('taxi_fleet.trips.markedPaid', 'Trip marked as paid.'),
        complete: t('taxi_fleet.trips.completedFlash', 'Trip marked as completed.'),
      }
      const call = await apiCall(pathByAction[action], { method: 'POST' })
      setPendingAction(null)
      if (call.ok) {
        flash(successByAction[action], 'success')
        void load()
        setFormKey((value) => value + 1)
      } else {
        flash(t('taxi_fleet.errors.generic', 'Operation failed.'), 'error')
      }
    },
    [confirm, load, t, tripId],
  )

  if (loading) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage label={t('taxi_fleet.trips.detail.loading', 'Loading…')} />
        </PageBody>
        {ConfirmDialogElement}
      </Page>
    )
  }

  if (error || !row) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage label={error ?? t('taxi_fleet.trips.detail.notFound', 'Trip not found.')} />
        </PageBody>
        {ConfirmDialogElement}
      </Page>
    )
  }

  const canEditTrip = canManageTrips || (isDriverOnly && row.teamMemberId === lockedTeamMemberId)
  const normalizedStatus = normalizeTripStatus(row.status)
  const lockMode = tripDetailLockMode(normalizedStatus)
  const formFullyReadOnly = !canEditTrip || lockMode === 'full'
  const availableActions = canManageTrips ? tripDetailActionsForStatus(normalizedStatus) : []
  const actionBusy = pendingAction !== null

  const actionButtons: Record<
    TripDetailActionId,
    { icon: React.ReactNode; label: string }
  > = {
    approve: {
      icon: <Check className="size-4 shrink-0" aria-hidden />,
      label: t('taxi_fleet.trips.actions.approve', 'Accept'),
    },
    reject: {
      icon: <X className="size-4 shrink-0" aria-hidden />,
      label: t('taxi_fleet.trips.actions.reject', 'Reject'),
    },
    schedule: {
      icon: <CalendarClock className="size-4 shrink-0" aria-hidden />,
      label: t('taxi_fleet.trips.actions.schedule', 'Ready for fulfillment'),
    },
    mark_paid: {
      icon: <CreditCard className="size-4 shrink-0" aria-hidden />,
      label: t('taxi_fleet.trips.actions.markPaid', 'Paid'),
    },
    complete: {
      icon: <BadgeCheck className="size-4 shrink-0" aria-hidden />,
      label: t('taxi_fleet.trips.actions.complete', 'Completed'),
    },
  }

  return (
    <>
      <ApplyBreadcrumb
        breadcrumb={[
          { label: 'Dashboard', labelKey: 'taxi_fleet.hub.dashboardTitle', href: TAXI_FLEET_BASE },
          { label: 'Trips', labelKey: 'taxi_fleet.trips.list.title', href: `${TAXI_FLEET_BASE}/trips` },
          { label: breadcrumbTitle },
        ]}
        title={breadcrumbTitle}
      />
      <Page>
        <PageBody>
          {isPlatformIngestedTrip(row.metadata ?? null) ? (
            <div className="mb-4 space-y-3">
              <Notice variant="info">
                {t(
                  'taxi_fleet.platformSync.backendReadOnly',
                  'This trip was imported from a platform app. Edit fields here only when correcting sync data.',
                )}
              </Notice>
              <PlatformTripIngestBadge
                variant="detail"
                metadata={row.metadata ?? null}
                platform={row.platform ?? null}
                externalTripId={row.externalTripId ?? null}
              />
            </div>
          ) : null}
          <TripCrudForm
            layout="page"
            mode="edit"
            formKey={formKey}
            title={t('taxi_fleet.trips.detail.title', 'Trip')}
            backHref={`${TAXI_FLEET_BASE}/trips`}
            cancelHref={`${TAXI_FLEET_BASE}/trips`}
            submitLabel={t('taxi_fleet.trips.form.save', 'Save changes')}
            driverProfiles={profiles}
            resolveDriverName={resolveName}
            statusOptions={statusOptions}
            initialValues={initialValues}
            readOnly={formFullyReadOnly}
            lockStatus={canEditTrip ? normalizedStatus : null}
            allowDriverEdit={canEditTrip && tripDetailAllowsDriverEdit(normalizedStatus)}
            onDelete={canManageTrips && lockMode !== 'full' ? handleDelete : undefined}
            sidebarExtra={
              isPlatformIngestedTrip(row.metadata ?? null) ? (
                <PlatformTripIngestPanel
                  metadata={row.metadata ?? null}
                  platform={row.platform ?? null}
                  externalTripId={row.externalTripId ?? null}
                />
              ) : (
                <TripReceiptOcrPanel tripId={row.id} canManage={canManageTrips} />
              )
            }
            extraActions={
              availableActions.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  {availableActions.map((action) => (
                    <Button
                      key={action}
                      type="button"
                      variant="outline"
                      className={ACTION_BUTTON_CLASS}
                      disabled={actionBusy}
                      onClick={() => void runStatusAction(action)}
                    >
                      {actionButtons[action].icon}
                      {actionButtons[action].label}
                    </Button>
                  ))}
                </div>
              ) : null
            }
            onSubmit={async (values) => {
              await updateCrud(
                'taxi_fleet/trips',
                tripFormValuesToUpdatePayload(row.id, values),
                { errorMessage: t('taxi_fleet.trips.form.saveError', 'Could not save trip.') },
              )
              flash(t('taxi_fleet.trips.form.updated', 'Changes saved.'), 'success')
              setFormKey((value) => value + 1)
              void load()
            }}
          />
          {suggestions.length > 0 ? (
            <section className="mt-6 space-y-3 rounded-lg border bg-card px-4 py-3">
              <h2 className="text-sm font-medium">{t('taxi_fleet.trips.suggestedDrivers', 'Suggested drivers')}</h2>
              <ul className="space-y-2">
                {suggestions.map((suggestion) => (
                  <li key={suggestion.teamMemberId} className="flex flex-wrap items-center gap-2 text-sm">
                    <Link
                      href={`/backend/staff/team-members/${suggestion.teamMemberId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {suggestion.displayName}
                    </Link>
                    <Badge variant="secondary">{suggestion.score}</Badge>
                    <span className="text-muted-foreground">{suggestion.reasons.join(', ')}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </PageBody>
        {ConfirmDialogElement}
      </Page>
    </>
  )
}
