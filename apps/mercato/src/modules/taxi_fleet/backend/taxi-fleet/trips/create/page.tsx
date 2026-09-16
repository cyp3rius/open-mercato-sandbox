'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { LoadingMessage } from '@open-mercato/ui/backend/detail'
import { TAXI_FLEET_BASE } from '../../paths'
import { useFleetDriverDirectory } from '../../../../components/useFleetDriverDirectory'
import { useFleetBackendSession } from '../../../../components/useFleetBackendSession'
import { useTripStatusDictionary } from '../../../../components/useTripStatusDictionary'
import { defaultTripStatusCode } from '../../../../lib/tripStatuses'
import {
  mapTripRowToFormValues,
  tripFormValuesFromSeed,
  tripFormValuesToPayload,
  type TripFormValues,
} from '../../../../components/tripFormConfig'
import { TripCrudForm } from '../../../../components/TripCrudForm'
import {
  isoToDateTimeLocalValue,
  normalizeDateTimeLocalInput,
} from '../../../../lib/datetimeLocal'
import { tripFormValuesFromDuplicateSource } from '../../../../lib/tripDuplicatePrefill'

type TripDuplicateApiRow = {
  id: string
  teamMemberId: string
  resourceId: string
  customerPersonId?: string | null
  customerCompanyId?: string | null
  tripType: string
  platform?: string | null
  startedAt?: string | null
  endedAt?: string | null
  revenueAmount?: string | null
  distanceKm?: string | null
  notes?: string | null
  status: string
  metadata?: Record<string, unknown> | null
}

export default function TaxiFleetTripCreatePage() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { organizationId, tenantId } = useOrganizationScopeDetail()
  const { profiles, resolveName } = useFleetDriverDirectory()
  const { isDriverOnly, lockedTeamMemberId } = useFleetBackendSession()
  const { statusOptions, statuses } = useTripStatusDictionary()
  const duplicateFromId = searchParams.get('duplicateFrom')?.trim() || null

  const seedValues = React.useMemo((): TripFormValues => {
    const base = tripFormValuesFromSeed({
      lockedTeamMemberId: isDriverOnly ? lockedTeamMemberId : null,
    })
    base.status = defaultTripStatusCode(statuses)
    const teamMemberId = searchParams.get('teamMemberId')
    const resourceId = searchParams.get('resourceId')
    const startedAt = searchParams.get('startedAt')
    const endedAt = searchParams.get('endedAt')
    if (teamMemberId && !duplicateFromId) base.teamMemberId = teamMemberId
    if (resourceId && !duplicateFromId) base.resourceId = resourceId
    if (startedAt && !duplicateFromId) {
      base.startedAtLocal = normalizeDateTimeLocalInput(isoToDateTimeLocalValue(startedAt))
    }
    if (endedAt && !duplicateFromId) {
      base.endedAtLocal = normalizeDateTimeLocalInput(isoToDateTimeLocalValue(endedAt))
    }
    return base
  }, [duplicateFromId, isDriverOnly, lockedTeamMemberId, searchParams, statuses])

  const [initialValues, setInitialValues] = React.useState<TripFormValues>(seedValues)
  const [formKey, setFormKey] = React.useState(0)
  const [prefetchingDuplicate, setPrefetchingDuplicate] = React.useState(Boolean(duplicateFromId))

  React.useEffect(() => {
    if (!duplicateFromId) {
      setInitialValues(seedValues)
      setFormKey((key) => key + 1)
      setPrefetchingDuplicate(false)
      return
    }
    let cancelled = false
    setPrefetchingDuplicate(true)
    void (async () => {
      const call = await apiCall<{ items?: TripDuplicateApiRow[] }>(
        `/api/taxi_fleet/trips?ids=${encodeURIComponent(duplicateFromId)}&page=1&pageSize=1`,
      )
      if (cancelled) return
      const row = call.result?.items?.[0]
      if (!call.ok || !row) {
        flash(t('taxi_fleet.trips.duplicate.loadFailed', 'Could not load trip to duplicate.'), 'error')
        setInitialValues(seedValues)
        setFormKey((key) => key + 1)
        setPrefetchingDuplicate(false)
        return
      }
      const mapped = mapTripRowToFormValues(row)
      const duplicated = tripFormValuesFromDuplicateSource(mapped, {
        defaultStatus: defaultTripStatusCode(statuses),
      })
      if (isDriverOnly && lockedTeamMemberId) {
        duplicated.teamMemberId = lockedTeamMemberId
      }
      setInitialValues(duplicated)
      setFormKey((key) => key + 1)
      setPrefetchingDuplicate(false)
    })()
    return () => {
      cancelled = true
    }
  }, [duplicateFromId, isDriverOnly, lockedTeamMemberId, seedValues, statuses, t])

  if (prefetchingDuplicate) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage label={t('taxi_fleet.trips.duplicate.loading', 'Preparing duplicated trip…')} />
        </PageBody>
      </Page>
    )
  }

  return (
    <Page>
      <PageBody>
        <TripCrudForm
          layout="page"
          mode="create"
          formKey={formKey}
          title={
            duplicateFromId
              ? t('taxi_fleet.trips.duplicate.createTitle', 'Duplicate trip')
              : t('taxi_fleet.trips.createTitle', 'Create trip')
          }
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
