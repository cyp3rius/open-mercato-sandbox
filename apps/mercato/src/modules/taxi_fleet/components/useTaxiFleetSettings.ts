"use client"

import * as React from 'react'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import type { TaxiFleetSettingsResponse } from '../lib/taxiFleetSettings'
import {
  defaultTaxiFleetSettings,
  normalizeTaxiFleetSettingsResponse,
} from '../lib/taxiFleetSettings'

export function useTaxiFleetSettings() {
  const scopeVersion = useOrganizationScopeVersion()
  const [settings, setSettings] = React.useState<TaxiFleetSettingsResponse>(() =>
    normalizeTaxiFleetSettingsResponse(defaultTaxiFleetSettings()),
  )
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await readApiResultOrThrow<TaxiFleetSettingsResponse>('/api/taxi_fleet/settings')
        if (!cancelled) setSettings(normalizeTaxiFleetSettingsResponse(data))
      } catch {
        if (!cancelled) {
          setSettings(normalizeTaxiFleetSettingsResponse(defaultTaxiFleetSettings()))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [scopeVersion])

  return { settings, loading, resourceTypeId: settings.effectiveResourceTypeId ?? null }
}
