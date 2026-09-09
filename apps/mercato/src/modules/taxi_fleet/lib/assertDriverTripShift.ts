import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { findOneWithDecryption, findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetDailyAssignment, TaxiFleetDriverProfile } from '../data/entities'
import {
  findDriverShiftForTripWindow,
  findOpenDriverShift,
  type DriverShiftMatch,
} from './driverTripShiftWindow'
import { resolveDriverDefaultResourceIds } from './driverDefaultResources'
import { formatDateInTimeZone } from './shiftGraceWindow'
import { loadTaxiFleetOrganizationSettings } from './taxiFleetOrganizationSettings'

type Translate = (key: string, fallback?: string) => string

export type DriverTripShiftMode = 'live' | 'past' | 'scheduled'

export type DriverTripShiftBinding = {
  assignmentId: string | null
  resourceId: string
}

type AssertDriverTripShiftInput = {
  em: EntityManager
  tenantId: string
  organizationId: string
  teamMemberId: string
  startedAt: Date | null | undefined
  endedAt?: Date | null
  /** @deprecated Prefer `mode`. Live / in-progress trip requires an open shift. */
  requireOpenShift?: boolean
  mode?: DriverTripShiftMode
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

function resolveMode(input: AssertDriverTripShiftInput): DriverTripShiftMode {
  if (input.mode) return input.mode
  return input.requireOpenShift ? 'live' : 'past'
}

function toBinding(match: DriverShiftMatch): DriverTripShiftBinding {
  return { assignmentId: match.assignmentId, resourceId: match.resourceId }
}

async function resolveDefaultResourceId(
  em: EntityManager,
  input: Pick<AssertDriverTripShiftInput, 'tenantId' | 'organizationId' | 'teamMemberId'>,
): Promise<string | null> {
  const profile = await findOneWithDecryption(
    em,
    TaxiFleetDriverProfile,
    {
      teamMemberId: input.teamMemberId,
      deletedAt: null,
    },
    undefined,
    { tenantId: input.tenantId, organizationId: input.organizationId },
  )
  return resolveDriverDefaultResourceIds(profile ?? {})[0] ?? null
}

async function resolveScheduledBinding(
  input: AssertDriverTripShiftInput & { startedAt: Date },
): Promise<DriverTripShiftBinding> {
  const now = input.now ?? new Date()
  const assignments = await loadDriverAssignments(input.em, input)
  const open = findOpenDriverShift(assignments, now)
  if (open) return toBinding(open)

  const settings = await loadTaxiFleetOrganizationSettings(input.em, {
    tenantId: input.tenantId,
    organizationId: input.organizationId,
  })
  const timeZone = settings.calendar.timezone || 'Europe/Warsaw'
  const dayKey = formatDateInTimeZone(input.startedAt, timeZone)
  const dayAssignment = assignments.find(
    (row) => row.assignmentDate === dayKey && row.resourceId && row.status !== 'cancelled',
  )
  if (dayAssignment?.resourceId) {
    return { assignmentId: dayAssignment.id, resourceId: dayAssignment.resourceId }
  }

  const defaultResourceId = await resolveDefaultResourceId(input.em, input)
  if (defaultResourceId) {
    return { assignmentId: null, resourceId: defaultResourceId }
  }

  throw new CrudHttpError(400, {
    error: input.translate(
      'taxi_fleet.errors.vehicleRequired',
      'No vehicle is assigned for this trip. Ask dispatch for a vehicle or set a default vehicle on your profile.',
    ),
  })
}

export async function assertDriverTripShift(
  input: AssertDriverTripShiftInput,
): Promise<DriverTripShiftBinding> {
  const now = input.now ?? new Date()
  const mode = resolveMode(input)
  const assignments = await loadDriverAssignments(input.em, input)

  if (mode === 'live') {
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
    return toBinding(match)
  }

  if (!input.startedAt || Number.isNaN(input.startedAt.getTime())) {
    throw new CrudHttpError(400, {
      error: input.translate(
        'taxi_fleet.errors.tripStartRequired',
        'Trip start time is required.',
      ),
    })
  }

  if (input.endedAt && input.endedAt.getTime() < input.startedAt.getTime()) {
    throw new CrudHttpError(400, {
      error: input.translate(
        'taxi_fleet.errors.tripEndBeforeStart',
        'Trip end time must be after the start time.',
      ),
    })
  }

  if (mode === 'scheduled') {
    return resolveScheduledBinding({ ...input, startedAt: input.startedAt })
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
  return toBinding(match)
}
