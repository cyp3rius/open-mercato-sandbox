"use client"

import { useCallback } from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'

export const TAXI_FLEET_TRIP_TYPES = ['client', 'private', 'empty', 'event', 'other'] as const
export type TaxiFleetTripType = (typeof TAXI_FLEET_TRIP_TYPES)[number]

export function useTaxiFleetLabels() {
  const t = useT()

  const resolveTripTypeLabel = useCallback(
    (tripType: string) => t(`taxi_fleet.trips.types.${tripType}`, tripType),
    [t],
  )

  const resolveTripStatusLabel = useCallback(
    (status: string) => t(`taxi_fleet.trips.statuses.${status}`, status),
    [t],
  )

  const resolveAssignmentStatusLabel = useCallback(
    (status: string) => t(`taxi_fleet.assignments.statuses.${status}`, status),
    [t],
  )

  const resolveSettlementStatusLabel = useCallback(
    (status: string) => t(`taxi_fleet.settlements.statuses.${status}`, status),
    [t],
  )

  const resolveIncomeDocumentTypeLabel = useCallback(
    (documentType: string) => t(`taxi_fleet.financial.incomeTypes.${documentType}`, documentType),
    [t],
  )

  const resolveCostTypeLabel = useCallback(
    (costType: string) => t(`taxi_fleet.financial.costTypes.${costType}`, costType),
    [t],
  )

  return {
    resolveTripTypeLabel,
    resolveTripStatusLabel,
    resolveAssignmentStatusLabel,
    resolveSettlementStatusLabel,
    resolveIncomeDocumentTypeLabel,
    resolveCostTypeLabel,
  }
}
