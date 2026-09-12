'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { TAXI_FLEET_BASE } from '../../paths'
import { useFleetDriverDirectory } from '../../../../components/useFleetDriverDirectory'
import { useFleetBackendSession } from '../../../../components/useFleetBackendSession'
import { useTripStatusDictionary } from '../../../../components/useTripStatusDictionary'
import { defaultTripStatusCode } from '../../../../lib/tripStatuses'
import {
  tripFormValuesFromSeed,
  tripFormValuesToPayload,
  type TripFormValues,
} from '../../../../components/tripFormConfig'
import { TripCrudForm } from '../../../../components/TripCrudForm'
import {
  isoToDateTimeLocalValue,
  normalizeDateTimeLocalInput,
} from '../../../../lib/datetimeLocal'

export default function TaxiFleetTripCreatePage() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { organizationId, tenantId } = useOrganizationScopeDetail()
  const { profiles, resolveName } = useFleetDriverDirectory()
  const { isDriverOnly, lockedTeamMemberId } = useFleetBackendSession()
  const { statusOptions, statuses } = useTripStatusDictionary()

  const initialValues = React.useMemo((): TripFormValues => {
    const base = tripFormValuesFromSeed({
      lockedTeamMemberId: isDriverOnly ? lockedTeamMemberId : null,
    })
    base.status = defaultTripStatusCode(statuses)
    const teamMemberId = searchParams.get('teamMemberId')
    const resourceId = searchParams.get('resourceId')
    const startedAt = searchParams.get('startedAt')
    const endedAt = searchParams.get('endedAt')
    if (teamMemberId) base.teamMemberId = teamMemberId
    if (resourceId) base.resourceId = resourceId
    if (startedAt) base.startedAtLocal = normalizeDateTimeLocalInput(isoToDateTimeLocalValue(startedAt))
    if (endedAt) base.endedAtLocal = normalizeDateTimeLocalInput(isoToDateTimeLocalValue(endedAt))
    return base
  }, [isDriverOnly, lockedTeamMemberId, searchParams, statuses])

  return (
    <Page>
      <PageBody>
        <TripCrudForm
          layout="page"
          mode="create"
          title={t('taxi_fleet.trips.createTitle', 'Create trip')}
          backHref={`${TAXI_FLEET_BASE}/trips`}
          cancelHref={`${TAXI_FLEET_BASE}/trips`}
          submitLabel={t('taxi_fleet.trips.actions.create', 'Create trip')}
          driverProfiles={profiles}
          resolveDriverName={resolveName}
          driverLocked={isDriverOnly}
          lockedTeamMemberId={lockedTeamMemberId}
          statusOptions={statusOptions}
          initialValues={initialValues}
          onSubmit={async (values) => {
            if (!organizationId || !tenantId) throw new Error(t('taxi_fleet.errors.generic', 'Operation failed.'))
            const call = await createCrud<{ id?: string }>(
              'taxi_fleet/trips',
              tripFormValuesToPayload(values, { tenantId, organizationId }, {
                defaultStatusCode: defaultTripStatusCode(statuses),
              }),
              { errorMessage: t('taxi_fleet.trips.form.saveError', 'Could not save trip.') },
            )
            const newId = typeof call.result?.id === 'string' ? call.result.id : ''
            if (!newId) throw new Error(t('taxi_fleet.trips.form.missingId', 'No id returned.'))
            flash(t('taxi_fleet.trips.created', 'Trip created.'), 'success')
            router.push(`${TAXI_FLEET_BASE}/trips/${encodeURIComponent(newId)}`)
          }}
        />
      </PageBody>
    </Page>
  )
}
