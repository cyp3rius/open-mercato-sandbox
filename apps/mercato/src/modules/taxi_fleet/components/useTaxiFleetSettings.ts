"use client"

import * as React from 'react'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import type { TaxiFleetSettingsResponse } from '../lib/taxiFleetSettings'
import {
  defaultTaxiFleetSettings,
  normalizeTaxiFleetSettingsResponse,
} from '../lib/taxiFleetSettings'

type SettingsCacheEntry = {
  scopeVersion: number
  promise: Promise<TaxiFleetSettingsResponse>
  data: TaxiFleetSettingsResponse | null
}

let settingsCache: SettingsCacheEntry | null = null

function fallbackSettings(): TaxiFleetSettingsResponse {
  return normalizeTaxiFleetSettingsResponse(defaultTaxiFleetSettings())
}

function loadTaxiFleetSettingsCached(scopeVersion: number): Promise<TaxiFleetSettingsResponse> {
  if (settingsCache && settingsCache.scopeVersion === scopeVersion) {
    if (settingsCache.data) return Promise.resolve(settingsCache.data)
    return settingsCache.promise
  }

  const promise = readApiResultOrThrow<TaxiFleetSettingsResponse>('/api/taxi_fleet/settings')
    .then((data) => normalizeTaxiFleetSettingsResponse(data))
    .catch(() => fallbackSettings())

  settingsCache = { scopeVersion, promise, data: null }

  void promise.then((data) => {
    if (settingsCache?.promise === promise) {
      settingsCache.data = data
    }
  })

  return promise
}

/** Drop shared client cache (e.g. after settings PUT or org switch side-effects). */
export function invalidateTaxiFleetSettingsCache() {
  settingsCache = null
}

export function useTaxiFleetSettings() {
  const scopeVersion = useOrganizationScopeVersion()
  const [settings, setSettings] = React.useState<TaxiFleetSettingsResponse>(() => {
    if (settingsCache?.scopeVersion === scopeVersion && settingsCache.data) {
      return settingsCache.data
    }
    return fallbackSettings()
  })
  const [loading, setLoading] = React.useState(
    !(settingsCache?.scopeVersion === scopeVersion && settingsCache.data),
  )

  React.useEffect(() => {
    let cancelled = false
    const hasFresh =
      settingsCache?.scopeVersion === scopeVersion && settingsCache.data != null
    if (!hasFresh) setLoading(true)

    void loadTaxiFleetSettingsCached(scopeVersion).then((data) => {
      if (cancelled) return
      setSettings(data)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [scopeVersion])

  return { settings, loading, resourceTypeId: settings.effectiveResourceTypeId ?? null }
}
