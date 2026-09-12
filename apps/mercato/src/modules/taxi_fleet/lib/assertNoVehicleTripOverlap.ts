import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetTrip } from '../data/entities'
import { findOverlappingTrip } from './tripTimeOverlap'

type Translate = (key: string, fallback?: string) => string

type AssertNoVehicleTripOverlapInput = {
  em: EntityManager
  tenantId: string
  organizationId: string
  resourceId: string
  startedAt: Date | null | undefined
  endedAt?: Date | null
  excludeTripId?: string | null
  translate: Translate
  now?: Date
}

/** Blocks save when the same vehicle is already booked on another non-cancelled trip. */
export async function assertNoVehicleTripOverlap(
  input: AssertNoVehicleTripOverlapInput,
): Promise<void> {
  const resourceId = input.resourceId?.trim()
  if (!resourceId || !input.startedAt || Number.isNaN(input.startedAt.getTime())) {
    return
  }

  const now = input.now ?? new Date()
  const candidateEnd = input.endedAt ?? now
  if (Number.isNaN(candidateEnd.getTime())) return
  if (candidateEnd.getTime() < input.startedAt.getTime()) {
    throw new CrudHttpError(400, {
      error: input.translate(
        'taxi_fleet.errors.invalidTripTimes',
        'Trip end time must be after start time.',
      ),
    })
  }

  const candidates = await findWithDecryption(
    input.em,
    TaxiFleetTrip,
    {
      resourceId,
      deletedAt: null,
      status: { $ne: 'cancelled' },
      startedAt: { $ne: null, $lt: candidateEnd },
      ...(input.excludeTripId ? { id: { $ne: input.excludeTripId } } : {}),
      $or: [{ endedAt: null }, { endedAt: { $gt: input.startedAt } }],
    },
    undefined,
    { tenantId: input.tenantId, organizationId: input.organizationId },
  )

  const overlap = findOverlappingTrip(
    { startedAt: input.startedAt, endedAt: input.endedAt ?? null },
    candidates,
    { excludeTripId: input.excludeTripId, now },
  )
  if (overlap) {
    throw new CrudHttpError(400, {
      error: input.translate(
        'taxi_fleet.errors.vehicleTripOverlap',
        'This vehicle is already assigned to another trip at the selected time.',
      ),
    })
  }
}
