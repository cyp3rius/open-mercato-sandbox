"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { Button } from '@open-mercato/ui/primitives/button'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import type { FleetDriverProfile } from './useFleetDriverDirectory'
import {
  TaxiFleetDialogFrame,
  useTaxiFleetDialogShortcuts,
} from './TaxiFleetDialogShell'
import {
  tripFormValuesFromSeed,
  tripFormValuesToPayload,
  type TripFormValues,
} from './tripFormConfig'
import { TripCrudForm } from './TripCrudForm'
import {
  TripFormTabNav,
  type TripFormTabId,
} from './TripFormTabNav'
import { useTripStatusDictionary } from './useTripStatusDictionary'
import { defaultTripStatusCode } from '../lib/tripStatuses'

export type TripCreateSeed = {
  teamMemberId?: string | null
  resourceId?: string | null
  assignmentId?: string | null
  startedAt?: Date | null
  endedAt?: Date | null
}

type TripCreateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  seed: TripCreateSeed | null
  driverProfiles: FleetDriverProfile[]
  resolveDriverName: (teamMemberId: string) => string
  lockedTeamMemberId?: string | null
  defaultResourceId?: string | null
  onCreated: () => void
}

export function TripCreateDialog({
  open,
  onOpenChange,
  seed,
  driverProfiles,
  resolveDriverName,
  lockedTeamMemberId = null,
  defaultResourceId = null,
  onCreated,
}: TripCreateDialogProps) {
  const t = useT()
  const { organizationId, tenantId } = useOrganizationScopeDetail()
  const { statuses } = useTripStatusDictionary()
  const dialogContentRef = React.useRef<HTMLDivElement | null>(null)
  const [formKey, setFormKey] = React.useState(0)
  const [assignmentId, setAssignmentId] = React.useState<string | null>(null)
  const [activeTab, setActiveTab] = React.useState<TripFormTabId>('route')
  const [canSubmit, setCanSubmit] = React.useState(false)

  const driverLocked = Boolean(lockedTeamMemberId?.trim().length)

  React.useEffect(() => {
    if (!open) return
    setFormKey((value) => value + 1)
    setAssignmentId(seed?.assignmentId ?? null)
    setActiveTab('route')
  }, [open, seed?.assignmentId])

  const initialValues = React.useMemo(
    () =>
      tripFormValuesFromSeed({
        teamMemberId: seed?.teamMemberId,
        resourceId: seed?.resourceId,
        startedAt: seed?.startedAt,
        endedAt: seed?.endedAt,
        defaultResourceId,
        lockedTeamMemberId,
      }),
    [defaultResourceId, lockedTeamMemberId, seed, formKey],
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
    async (values: TripFormValues) => {
      if (!organizationId || !tenantId) {
        throw new Error(t('taxi_fleet.errors.generic', 'Operation failed.'))
      }
      await createCrud(
        'taxi_fleet/trips',
        tripFormValuesToPayload(values, { tenantId, organizationId }, {
          assignmentId,
          defaultStatusCode: defaultTripStatusCode(statuses),
        }),
        { errorMessage: t('taxi_fleet.trips.form.saveError', 'Could not save trip.') },
      )
      flash(t('taxi_fleet.trips.created', 'Trip created.'), 'success')
      onOpenChange(false)
      onCreated()
    },
    [assignmentId, onCreated, onOpenChange, organizationId, statuses, t, tenantId],
  )

  return (
    <TaxiFleetDialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title={t('taxi_fleet.trips.createTitle', 'Create trip')}
      size="2xl"
      contentRef={dialogContentRef}
      onKeyDown={handleDialogKeyDown}
      headerBelow={<TripFormTabNav activeTab={activeTab} onTabChange={setActiveTab} />}
    >
      <TripCrudForm
        layout="dialog"
        mode="create"
        formKey={formKey}
        activeTab={activeTab}
        driverProfiles={driverProfiles}
        resolveDriverName={resolveDriverName}
        driverLocked={driverLocked}
        lockedTeamMemberId={lockedTeamMemberId}
        onAssignmentResolved={setAssignmentId}
        initialValues={initialValues}
        submitLabel={t('taxi_fleet.trips.actions.create', 'Create trip')}
        onSubmitReadyChange={setCanSubmit}
        extraActions={(
          <Button type="button" variant="outline" onClick={handleCancel}>
            {t('common.cancel', 'Cancel')}
          </Button>
        )}
        onSubmit={handleSubmit}
      />
    </TaxiFleetDialogFrame>
  )
}
