'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeDetail, useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { TAXI_FLEET_BASE } from '../../paths'
import {
  buildDriverProfileFormFields,
  buildDriverProfileFormGroups,
  defaultDriverProfileFormValues,
  driverProfileCreateSchema,
  driverProfileFormValuesToCreatePayload,
  type DriverProfileFormValues,
} from '../../../../components/driverProfileFormConfig'
import { useTaxiFleetSettings } from '../../../../components/useTaxiFleetSettings'

const PROFILE_PAGE_SIZE = 100

type DriverProfileListRow = {
  teamMemberId: string
}

export default function TaxiFleetDriverCreatePage() {
  const t = useT()
  const router = useRouter()
  const scopeVersion = useOrganizationScopeVersion()
  const { organizationId, tenantId } = useOrganizationScopeDetail()
  const { settings, loading: settingsLoading } = useTaxiFleetSettings()
  const [excludeMemberIds, setExcludeMemberIds] = React.useState<Set<string>>(new Set())
  const [profilesLoaded, setProfilesLoaded] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    async function loadExistingProfiles() {
      setProfilesLoaded(false)
      const params = new URLSearchParams({ page: '1', pageSize: String(PROFILE_PAGE_SIZE) })
      const call = await apiCall<{ items?: DriverProfileListRow[] }>(`/api/taxi_fleet/driver-profiles?${params}`)
      if (cancelled) return
      const items = Array.isArray(call.result?.items) ? call.result.items : []
      setExcludeMemberIds(new Set(items.map((row) => row.teamMemberId)))
      setProfilesLoaded(true)
    }
    void loadExistingProfiles()
    return () => {
      cancelled = true
    }
  }, [scopeVersion])

  const fields = React.useMemo(
    () => buildDriverProfileFormFields(t, { mode: 'create', excludeMemberIds, surface: 'page' }),
    [excludeMemberIds, t],
  )
  const groups = React.useMemo(() => buildDriverProfileFormGroups(t), [t])

  return (
    <Page>
      <PageBody>
        {profilesLoaded && !settingsLoading ? (
          <CrudForm<DriverProfileFormValues>
            title={t('taxi_fleet.drivers.createTitle', 'Create driver profile')}
            backHref={`${TAXI_FLEET_BASE}/drivers`}
            cancelHref={`${TAXI_FLEET_BASE}/drivers`}
            submitLabel={t('taxi_fleet.drivers.form.submit', 'Save')}
            fields={fields}
            groups={groups}
            initialValues={defaultDriverProfileFormValues(settings.defaultPayoutPercent)}
            schema={driverProfileCreateSchema()}
            onSubmit={async (values) => {
              if (!organizationId || !tenantId) throw new Error(t('taxi_fleet.errors.generic', 'Operation failed.'))
              const call = await createCrud<{ id?: string }>(
                'taxi_fleet/driver-profiles',
                driverProfileFormValuesToCreatePayload(values, { tenantId, organizationId }),
                { errorMessage: t('taxi_fleet.drivers.form.saveError', 'Could not save driver profile.') },
              )
              const newId = typeof call.result?.id === 'string' ? call.result.id : ''
              if (!newId) throw new Error(t('taxi_fleet.drivers.form.missingId', 'No id returned.'))
              flash(t('taxi_fleet.drivers.created', 'Driver profile created.'), 'success')
              router.push(`${TAXI_FLEET_BASE}/drivers/${encodeURIComponent(newId)}`)
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t('taxi_fleet.drivers.create.loading', 'Loading…')}</p>
        )}
      </PageBody>
    </Page>
  )
}
