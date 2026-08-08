'use client'

import { useCallback, useMemo } from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import {
  buildTripStatusSelectOptions,
  findTripStatusDefinition,
  resolveTripStatusLabelFromDictionary,
  type TaxiFleetTripStatusDefinition,
} from '../lib/tripStatuses'
import { useTaxiFleetSettings } from './useTaxiFleetSettings'

export function useTripStatusDictionary() {
  const t = useT()
  const { settings } = useTaxiFleetSettings()
  const statuses = settings.tripStatuses

  const statusOptions = useMemo(() => buildTripStatusSelectOptions(statuses), [statuses])

  const resolveLabel = useCallback(
    (code: string) => {
      const fromDictionary = resolveTripStatusLabelFromDictionary(statuses, code)
      if (fromDictionary !== code) return fromDictionary
      return t(`taxi_fleet.trips.statuses.${code}`, code)
    },
    [statuses, t],
  )

  const findDefinition = useCallback(
    (code: string): TaxiFleetTripStatusDefinition | undefined => findTripStatusDefinition(statuses, code),
    [statuses],
  )

  return {
    statuses,
    statusOptions,
    resolveLabel,
    findDefinition,
  }
}
