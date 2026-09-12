import type { EntityManager } from '@mikro-orm/postgresql'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import type { TaxiFleetTrip } from '../data/entities'
import { loadTaxiFleetOrganizationSettings } from './taxiFleetOrganizationSettings'
import {
  findTripStatusDefinition,
  normalizeTripStatus,
  type TaxiFleetStatusEnterAction,
} from './tripStatuses'

type TripEventPayload = {
  id: string
  tenantId: string
  organizationId: string
  teamMemberId?: string | null
  previousTeamMemberId?: string | null
  tripType?: string
  status?: string
  cancelSource?: string
  cancelReason?: string | null
  paymentMethod?: string
  requestId?: string | null
}

function readRequestId(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata || typeof metadata !== 'object') return null
  const requestId = metadata.requestId
  return typeof requestId === 'string' && requestId.trim().length ? requestId.trim() : null
}

function buildTripEventPayload(row: TaxiFleetTrip, extra?: Partial<TripEventPayload>): TripEventPayload {
  return {
    id: row.id,
    tenantId: row.tenantId,
    organizationId: row.organizationId,
    teamMemberId: row.teamMemberId ?? null,
    tripType: row.tripType,
    status: normalizeTripStatus(row.status),
    requestId: readRequestId(row.metadata),
    ...extra,
  }
}

async function emitTripEvent(
  ctx: CommandRuntimeContext,
  eventId: string,
  payload: TripEventPayload,
) {
  const eventBus = ctx.container.resolve('eventBus') as { emitEvent: (event: string, data: unknown) => Promise<void> }
  await eventBus.emitEvent(eventId, payload)
}

async function runStatusEnterAction(
  ctx: CommandRuntimeContext,
  row: TaxiFleetTrip,
  action: TaxiFleetStatusEnterAction,
  options?: { cancelSource?: string; cancelReason?: string | null; paymentMethod?: string },
) {
  const payload = buildTripEventPayload(row, {
    cancelSource: options?.cancelSource,
    cancelReason: options?.cancelReason ?? null,
    paymentMethod: options?.paymentMethod,
  })

  switch (action) {
    case 'notify_order_created':
      await emitTripEvent(ctx, 'taxi_fleet.trip.created', payload)
      return
    case 'notify_assigned':
      if (row.teamMemberId) {
        await emitTripEvent(ctx, 'taxi_fleet.trip.assigned', payload)
      }
      return
    case 'notify_paid':
      await emitTripEvent(ctx, 'taxi_fleet.trip.paid', payload)
      return
    case 'notify_confirmed':
      await emitTripEvent(ctx, 'taxi_fleet.trip.approved', payload)
      return
    case 'notify_cancelled':
      await emitTripEvent(ctx, 'taxi_fleet.trip.cancelled', payload)
      return
    case 'customer_email_created':
    case 'customer_email_approved':
    case 'customer_email_paid':
    case 'customer_email_cancelled':
      return
    default:
      return
  }
}

export async function runTripStatusEnterActions(
  ctx: CommandRuntimeContext,
  row: TaxiFleetTrip,
  status: string,
  options?: { cancelSource?: string; cancelReason?: string | null; paymentMethod?: string },
) {
  const em = ctx.container.resolve('em') as EntityManager
  const settings = await loadTaxiFleetOrganizationSettings(em, {
    tenantId: row.tenantId,
    organizationId: row.organizationId,
  })
  const normalized = normalizeTripStatus(status)
  const definition = findTripStatusDefinition(settings.tripStatuses, normalized)
  for (const action of definition?.onEnterActions ?? []) {
    await runStatusEnterAction(ctx, row, action, options)
  }
}

export async function applyTripStatusChange(
  ctx: CommandRuntimeContext,
  row: TaxiFleetTrip,
  nextStatus: string,
  options?: {
    cancelSource?: string
    cancelReason?: string | null
    paymentMethod?: string
    skipActions?: boolean
  },
): Promise<{ previousStatus: string; nextStatus: string; changed: boolean }> {
  const em = ctx.container.resolve('em') as EntityManager
  const previousStatus = normalizeTripStatus(row.status)
  const normalizedNext = normalizeTripStatus(nextStatus)
  const changed = previousStatus !== normalizedNext
  row.status = normalizedNext

  if (!changed || options?.skipActions) {
    return { previousStatus, nextStatus: normalizedNext, changed }
  }

  const settings = await loadTaxiFleetOrganizationSettings(em, {
    tenantId: row.tenantId,
    organizationId: row.organizationId,
  })
  const definition = findTripStatusDefinition(settings.tripStatuses, normalizedNext)
  const actions = definition?.onEnterActions ?? []

  for (const action of actions) {
    await runStatusEnterAction(ctx, row, action, options)
  }

  return { previousStatus, nextStatus: normalizedNext, changed }
}

export async function emitTripAssignedIfNeeded(
  ctx: CommandRuntimeContext,
  row: TaxiFleetTrip,
  previousTeamMemberId: string | null | undefined,
) {
  const nextTeamMemberId = row.teamMemberId ?? null
  if (!nextTeamMemberId || previousTeamMemberId === nextTeamMemberId) return

  await emitTripEvent(
    ctx,
    'taxi_fleet.trip.assigned',
    buildTripEventPayload(row, { previousTeamMemberId: previousTeamMemberId ?? null }),
  )
}
