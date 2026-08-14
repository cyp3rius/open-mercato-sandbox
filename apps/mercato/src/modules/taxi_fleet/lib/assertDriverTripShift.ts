import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetDailyAssignment } from '../data/entities'
import {
  findDriverShiftForTripWindow,
  findOpenDriverShift,
  type DriverShiftMatch,
} from './driverTripShiftWindow'

type Translate = (key: string, fallback?: string) => string

type AssertDriverTripShiftInput = {
  em: EntityManager
  tenantId: string
  organizationId: string
  teamMemberId: string
  startedAt: Date | null | undefined
  endedAt?: Date | null
  /** Live / in-progress trip requires an open shift. */
  requireOpenShift: boolean
  translate: Translate
  now?: Date
}

async function loadDriverAssignments(
  em: EntityManager,
  input: Pick<AssertDriverTripShiftInput, 'tenantId' | 'organizationId' | 'teamMemberId'>,
) {
  return findWithDecryption(
    em,
    TaxiFleetDailyAssignment,
    {
      teamMemberId: input.teamMemberId,
      deletedAt: null,
      status: { $ne: 'cancelled' },
    },
    { orderBy: { shiftStart: 'DESC' } },
    { tenantId: input.tenantId, organizationId: input.organizationId },
  )
}

export async function assertDriverTripShift(
  input: AssertDriverTripShiftInput,
): Promise<DriverShiftMatch> {
  const now = input.now ?? new Date()
  const assignments = await loadDriverAssignments(input.em, input)

  if (input.requireOpenShift) {
    const open = findOpenDriverShift(assignments, now)
    if (!open) {
      throw new CrudHttpError(400, {
        error: input.translate(
          'taxi_fleet.errors.liveRequiresOpenShift',
          'Start a live trip only while your shift is open.',
        ),
      })
    }
    const startedAt = input.startedAt ?? now
    const match = findDriverShiftForTripWindow(assignments, startedAt, input.endedAt ?? null, now)
    if (!match?.open) {
      throw new CrudHttpError(400, {
        error: input.translate(
          'taxi_fleet.errors.tripOutsideShift',
          'Trip times must fall within a past or current shift.',
        ),
      })
    }
    return match
  }

  if (!input.startedAt || Number.isNaN(input.startedAt.getTime())) {
    throw new CrudHttpError(400, {
      error: input.translate(
        'taxi_fleet.errors.tripStartRequired',
        'Trip start time is required.',
      ),
    })
  }

  if (input.startedAt.getTime() > now.getTime()) {
    throw new CrudHttpError(400, {
      error: input.translate(
        'taxi_fleet.errors.tripOutsideShift',
        'Trip times must fall within a past or current shift.',
      ),
    })
  }
  if (input.endedAt && input.endedAt.getTime() > now.getTime()) {
    throw new CrudHttpError(400, {
      error: input.translate(
        'taxi_fleet.errors.tripOutsideShift',
        'Trip times must fall within a past or current shift.',
      ),
    })
  }

  const match = findDriverShiftForTripWindow(
    assignments,
    input.startedAt,
    input.endedAt ?? null,
    now,
  )
  if (!match) {
    throw new CrudHttpError(400, {
      error: input.translate(
        'taxi_fleet.errors.tripOutsideShift',
        'Trip times must fall within a past or current shift.',
      ),
    })
  }
  return match
}
