import type { TaxiFleetTrip } from '../../data/entities'

export type PlatformTripSnapshot = {
  id: string
  tenantId: string
  organizationId: string
  teamMemberId: string | null
  tripType: TaxiFleetTrip['tripType']
  platform: TaxiFleetTrip['platform']
  externalTripId: string | null
  status: string
  startedAt: string | null
  endedAt: string | null
  distanceKm: string | null
  revenueAmount: string | null
  currencyCode: string
  customerPersonId: string | null
  customerCompanyId: string | null
  notes: string | null
  metadata: Record<string, unknown> | null
  deletedAt: string | null
}

export function serializePlatformTripSnapshot(trip: TaxiFleetTrip): PlatformTripSnapshot {
  return {
    id: trip.id,
    tenantId: trip.tenantId,
    organizationId: trip.organizationId,
    teamMemberId: trip.teamMemberId ?? null,
    tripType: trip.tripType,
    platform: trip.platform ?? null,
    externalTripId: trip.externalTripId ?? null,
    status: trip.status,
    startedAt: trip.startedAt ? trip.startedAt.toISOString() : null,
    endedAt: trip.endedAt ? trip.endedAt.toISOString() : null,
    distanceKm: trip.distanceKm ?? null,
    revenueAmount: trip.revenueAmount ?? null,
    currencyCode: trip.currencyCode,
    customerPersonId: trip.customerPersonId ?? null,
    customerCompanyId: trip.customerCompanyId ?? null,
    notes: trip.notes ?? null,
    metadata: trip.metadata ?? null,
    deletedAt: trip.deletedAt ? trip.deletedAt.toISOString() : null,
  }
}

export function applyPlatformTripSnapshot(trip: TaxiFleetTrip, snapshot: PlatformTripSnapshot): void {
  trip.teamMemberId = snapshot.teamMemberId
  trip.tripType = snapshot.tripType
  trip.platform = snapshot.platform
  trip.externalTripId = snapshot.externalTripId
  trip.status = snapshot.status
  trip.startedAt = snapshot.startedAt ? new Date(snapshot.startedAt) : null
  trip.endedAt = snapshot.endedAt ? new Date(snapshot.endedAt) : null
  trip.distanceKm = snapshot.distanceKm
  trip.revenueAmount = snapshot.revenueAmount
  trip.currencyCode = snapshot.currencyCode
  trip.customerPersonId = snapshot.customerPersonId
  trip.customerCompanyId = snapshot.customerCompanyId
  trip.notes = snapshot.notes
  trip.metadata = snapshot.metadata
  trip.deletedAt = snapshot.deletedAt ? new Date(snapshot.deletedAt) : null
  trip.updatedAt = new Date()
}
