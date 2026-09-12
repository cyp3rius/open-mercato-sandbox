import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { requireId } from '@open-mercato/shared/lib/commands/helpers'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetTrip } from '../data/entities'
import {
  tripApproveSchema,
  tripCancelSchema,
  tripCompleteSchema,
  tripCreateSchema,
  tripDeleteSchema,
  tripMarkPaidSchema,
  tripRejectSchema,
  tripScheduleSchema,
  tripUpdateSchema,
  type TripCancelInput,
  type TripCreateInput,
  type TripMarkPaidInput,
  type TripUpdateInput,
} from '../data/validators'
import { assertTeamMemberHasDriverProfile } from '../lib/driverProfileGuard'
import { resolveTripCustomerLink } from '../lib/customerLink.server'
import { resolveFleetBackendActor } from '../lib/backendFleetActor'
import { normalizeTripStatus } from '../lib/tripStatuses'
import {
  applyTripStatusChange,
  emitTripAssignedIfNeeded,
  runTripStatusEnterActions,
} from '../lib/tripStatusTransitions'
import { ensureOrganizationScope, ensureTenantScope, numericToString } from './shared'
import { assertDriverTripShift } from '../lib/assertDriverTripShift'
import { assertNoTripOverlap } from '../lib/assertNoTripOverlap'
import { assertNoVehicleTripOverlap } from '../lib/assertNoVehicleTripOverlap'
import { isTripDetailFieldEditable, tripDetailLockMode, isCompletedTripReceiptSupplementUpdate } from '../lib/tripDetailWorkflow'
import { tripHasReceiptAttachment } from '../lib/driverTripReceiptStatus'
import {
  recalculateWeeklySettlementsForTrip,
  resolveTripWeekStart,
} from '../lib/settlementWeekScope'
import { scheduleTripGoogleCalendarSync } from '../lib/googleCalendar/tripGoogleCalendarSync'

async function actorMayEditCompletedTrip(
  ctx: Parameters<CommandHandler<TripUpdateInput, { tripId: string }>['execute']>[1],
): Promise<boolean> {
  const userId = ctx.auth?.sub
  if (!userId) return false
  try {
    const rbac = ctx.container.resolve('rbacService') as {
      userHasAllFeatures: (
        userId: string,
        required: string[],
        scope: { tenantId: string | null; organizationId: string | null },
      ) => Promise<boolean>
    }
    return await rbac.userHasAllFeatures(
      userId,
      ['taxi_fleet.trips.edit_completed'],
      { tenantId: ctx.auth?.tenantId ?? null, organizationId: ctx.auth?.orgId ?? null },
    )
  } catch {
    return false
  }
}

async function assertDriverScopedTeamMember(
  ctx: Parameters<CommandHandler<TripCreateInput, { tripId: string }>['execute']>[1],
  teamMemberId: string,
) {
  const actor = await resolveFleetBackendActor(ctx)
  if (actor?.role === 'driver' && actor.teamMemberId !== teamMemberId) {
    throw new CrudHttpError(403, { error: 'Forbidden' })
  }
}

const createTripCommand: CommandHandler<TripCreateInput, { tripId: string }> = {
  id: 'taxi_fleet.trips.create',
  async execute(input, ctx) {
    const parsed = tripCreateSchema.parse(input)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const { translate } = await resolveTranslations()

    const actor = await resolveFleetBackendActor(ctx)
    const teamMemberId = actor?.role === 'driver' ? actor.teamMemberId : parsed.teamMemberId
    await assertTeamMemberHasDriverProfile(em, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      teamMemberId,
      translate,
    })

    const customer = await resolveTripCustomerLink(
      em,
      {
        customerPersonId: parsed.customerPersonId,
        customerCompanyId: parsed.customerCompanyId,
        customerEntityId: parsed.customerEntityId,
      },
      { tenantId: parsed.tenantId, organizationId: parsed.organizationId },
      { required: parsed.tripType === 'client' },
    )
    const initialStatus = normalizeTripStatus(parsed.status ?? 'new')
    const now = new Date()

    let resourceId = parsed.resourceId
    let assignmentId = parsed.assignmentId ?? null
    if (actor?.role === 'driver') {
      const initialMode =
        initialStatus === 'in_progress'
          ? 'live'
          : initialStatus === 'scheduled'
            ? 'scheduled'
            : 'past'
      const shiftMatch = await assertDriverTripShift({
        em,
        tenantId: parsed.tenantId,
        organizationId: parsed.organizationId,
        teamMemberId,
        startedAt: parsed.startedAt ?? (initialMode === 'live' ? now : null),
        endedAt: parsed.endedAt ?? null,
        mode: initialMode,
        translate,
        now,
      })
      resourceId = shiftMatch.resourceId
      assignmentId = shiftMatch.assignmentId
    }

    if (teamMemberId && parsed.startedAt) {
      await assertNoTripOverlap({
        em,
        tenantId: parsed.tenantId,
        organizationId: parsed.organizationId,
        teamMemberId,
        startedAt: parsed.startedAt,
        endedAt: parsed.endedAt ?? null,
        translate,
        now,
      })
    }
    if (resourceId && parsed.startedAt) {
      await assertNoVehicleTripOverlap({
        em,
        tenantId: parsed.tenantId,
        organizationId: parsed.organizationId,
        resourceId,
        startedAt: parsed.startedAt,
        endedAt: parsed.endedAt ?? null,
        translate,
        now,
      })
    }

    const record = em.create(TaxiFleetTrip, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      teamMemberId,
      resourceId,
      assignmentId,
      tripType: parsed.tripType,
      platform: parsed.platform ?? null,
      startedAt: parsed.startedAt ?? null,
      endedAt: parsed.endedAt ?? null,
      odometerStart: parsed.odometerStart == null ? null : numericToString(parsed.odometerStart),
      odometerEnd: parsed.odometerEnd == null ? null : numericToString(parsed.odometerEnd),
      distanceKm: parsed.distanceKm == null ? null : numericToString(parsed.distanceKm),
      revenueAmount: parsed.revenueAmount == null ? null : numericToString(parsed.revenueAmount),
      currencyCode: parsed.currencyCode ?? 'PLN',
      customerPersonId: customer.customerPersonId,
      customerCompanyId: customer.customerCompanyId,
      status: initialStatus,
      notes: parsed.notes ?? null,
      metadata: parsed.metadata ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    await em.persistAndFlush(record)
    await runTripStatusEnterActions(ctx, record, initialStatus)
    if (record.teamMemberId) {
      await emitTripAssignedIfNeeded(ctx, record, null)
    }
    await recalculateWeeklySettlementsForTrip(em, record)
    scheduleTripGoogleCalendarSync(record.id)
    return { tripId: record.id }
  },
}

const updateTripCommand: CommandHandler<TripUpdateInput, { tripId: string }> = {
  id: 'taxi_fleet.trips.update',
  async execute(input, ctx) {
    const parsed = tripUpdateSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await findOneWithDecryption(em, TaxiFleetTrip, { id: parsed.id, deletedAt: null })
    if (!row) throw new CrudHttpError(404, { error: 'Not found' })
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)
    await assertDriverScopedTeamMember(ctx, row.teamMemberId ?? '')

    const { translate } = await resolveTranslations()
    const allowEditCompleted = await actorMayEditCompletedTrip(ctx)
    const lockMode = tripDetailLockMode(row.status, { allowEditCompleted })
    const receiptSupplement =
      lockMode === 'full' &&
      isCompletedTripReceiptSupplementUpdate(
        row.status,
        tripHasReceiptAttachment(row),
        parsed as Record<string, unknown>,
      )
    if (lockMode === 'full' && !receiptSupplement) {
      throw new CrudHttpError(409, {
        error: translate(
          'taxi_fleet.trips.errors.locked',
          'This trip is completed or cancelled and cannot be edited.',
        ),
      })
    }
    if (
      parsed.teamMemberId !== undefined &&
      !isTripDetailFieldEditable(row.status, 'teamMemberId', { allowEditCompleted })
    ) {
      throw new CrudHttpError(400, {
        error: translate(
          'taxi_fleet.trips.errors.driverLocked',
          'Driver cannot be changed for this trip status.',
        ),
      })
    }
    const previousTeamMemberId = row.teamMemberId ?? null
    const previousWeekStart = resolveTripWeekStart(row)
    const previousStatus = normalizeTripStatus(row.status)
    const actor = await resolveFleetBackendActor(ctx)
    if (parsed.teamMemberId !== undefined) {
      const nextTeamMemberId = actor?.role === 'driver' ? actor.teamMemberId : parsed.teamMemberId
      if (nextTeamMemberId) {
        await assertTeamMemberHasDriverProfile(em, {
          tenantId: row.tenantId,
          organizationId: row.organizationId,
          teamMemberId: nextTeamMemberId,
          translate,
        })
      }
      row.teamMemberId = nextTeamMemberId
    }
    if (parsed.resourceId !== undefined) row.resourceId = parsed.resourceId
    if (parsed.assignmentId !== undefined) row.assignmentId = parsed.assignmentId
    if (parsed.tripType !== undefined) row.tripType = parsed.tripType
    if (parsed.platform !== undefined) row.platform = parsed.platform ?? null
    if (parsed.startedAt !== undefined) row.startedAt = parsed.startedAt
    if (parsed.endedAt !== undefined) row.endedAt = parsed.endedAt
    if (parsed.odometerStart !== undefined) row.odometerStart = parsed.odometerStart == null ? null : numericToString(parsed.odometerStart)
    if (parsed.odometerEnd !== undefined) row.odometerEnd = parsed.odometerEnd == null ? null : numericToString(parsed.odometerEnd)
    if (parsed.distanceKm !== undefined) row.distanceKm = parsed.distanceKm == null ? null : numericToString(parsed.distanceKm)
    if (parsed.revenueAmount !== undefined) row.revenueAmount = parsed.revenueAmount == null ? null : numericToString(parsed.revenueAmount)
    if (parsed.currencyCode !== undefined) row.currencyCode = parsed.currencyCode
    const customerTouched =
      parsed.customerPersonId !== undefined ||
      parsed.customerCompanyId !== undefined ||
      parsed.customerEntityId !== undefined
    if (customerTouched) {
      const customer = await resolveTripCustomerLink(
        em,
        {
          customerPersonId: parsed.customerPersonId,
          customerCompanyId: parsed.customerCompanyId,
          customerEntityId: parsed.customerEntityId,
        },
        { tenantId: row.tenantId, organizationId: row.organizationId },
        { required: true },
      )
      row.customerPersonId = customer.customerPersonId
      row.customerCompanyId = customer.customerCompanyId
    }
    if (parsed.notes !== undefined) row.notes = parsed.notes
    if (parsed.metadata !== undefined) row.metadata = parsed.metadata
    if (parsed.status !== undefined) {
      await applyTripStatusChange(ctx, row, parsed.status)
    }

    const nextStatus = normalizeTripStatus(row.status)
    const driverStartedScheduled =
      actor?.role === 'driver' &&
      previousStatus === 'scheduled' &&
      nextStatus === 'in_progress'
    if (driverStartedScheduled) {
      const now = new Date()
      row.endedAt = null
      if (!row.startedAt) row.startedAt = now
      const shiftMatch = await assertDriverTripShift({
        em,
        tenantId: row.tenantId,
        organizationId: row.organizationId,
        teamMemberId: row.teamMemberId ?? actor.teamMemberId,
        startedAt: row.startedAt,
        endedAt: null,
        mode: 'live',
        translate,
        now,
      })
      row.resourceId = shiftMatch.resourceId
      row.assignmentId = shiftMatch.assignmentId
    }

    const timesOrMemberTouched =
      parsed.startedAt !== undefined ||
      parsed.endedAt !== undefined ||
      parsed.teamMemberId !== undefined ||
      driverStartedScheduled
    if (timesOrMemberTouched && row.teamMemberId && row.startedAt) {
      await assertNoTripOverlap({
        em,
        tenantId: row.tenantId,
        organizationId: row.organizationId,
        teamMemberId: row.teamMemberId,
        startedAt: row.startedAt,
        endedAt: row.endedAt ?? null,
        excludeTripId: row.id,
        translate,
      })
    }
    const vehicleScheduleTouched =
      timesOrMemberTouched || parsed.resourceId !== undefined || driverStartedScheduled
    if (vehicleScheduleTouched && row.resourceId && row.startedAt) {
      await assertNoVehicleTripOverlap({
        em,
        tenantId: row.tenantId,
        organizationId: row.organizationId,
        resourceId: row.resourceId,
        startedAt: row.startedAt,
        endedAt: row.endedAt ?? null,
        excludeTripId: row.id,
        translate,
      })
    }

    await em.flush()
    await emitTripAssignedIfNeeded(ctx, row, previousTeamMemberId)
    await recalculateWeeklySettlementsForTrip(em, row, previousWeekStart)
    scheduleTripGoogleCalendarSync(row.id)
    return { tripId: row.id }
  },
}

const deleteTripCommand: CommandHandler<{ id: string }, { ok: true }> = {
  id: 'taxi_fleet.trips.delete',
  async execute(input, ctx) {
    const parsed = tripDeleteSchema.parse(input)
    const id = requireId(parsed.id)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await findOneWithDecryption(em, TaxiFleetTrip, { id, deletedAt: null })
    if (!row) throw new CrudHttpError(404, { error: 'Not found' })
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)
    await assertDriverScopedTeamMember(ctx, row.teamMemberId ?? '')
    const previousWeekStart = resolveTripWeekStart(row)
    row.deletedAt = new Date()
    await em.flush()
    await recalculateWeeklySettlementsForTrip(em, row, previousWeekStart)
    scheduleTripGoogleCalendarSync(row.id)
    return { ok: true }
  },
}

const approveTripCommand: CommandHandler<{ id: string }, { tripId: string }> = {
  id: 'taxi_fleet.trips.approve',
  async execute(input, ctx) {
    const parsed = tripApproveSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await findOneWithDecryption(em, TaxiFleetTrip, { id: parsed.id, deletedAt: null })
    if (!row) throw new CrudHttpError(404, { error: 'Not found' })
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)
    await applyTripStatusChange(ctx, row, 'approved')
    await em.flush()
    scheduleTripGoogleCalendarSync(row.id)
    return { tripId: row.id }
  },
}

const rejectTripCommand: CommandHandler<{ id: string; notes?: string | null }, { tripId: string }> = {
  id: 'taxi_fleet.trips.reject',
  async execute(input, ctx) {
    const parsed = tripRejectSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await findOneWithDecryption(em, TaxiFleetTrip, { id: parsed.id, deletedAt: null })
    if (!row) throw new CrudHttpError(404, { error: 'Not found' })
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)
    if (parsed.notes !== undefined) row.notes = parsed.notes
    await applyTripStatusChange(ctx, row, 'cancelled', {
      cancelSource: 'operator',
      cancelReason: parsed.notes ?? null,
    })
    await em.flush()
    await recalculateWeeklySettlementsForTrip(em, row)
    scheduleTripGoogleCalendarSync(row.id)
    return { tripId: row.id }
  },
}

const cancelTripCommand: CommandHandler<TripCancelInput, { tripId: string }> = {
  id: 'taxi_fleet.trips.cancel',
  async execute(input, ctx) {
    const parsed = tripCancelSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await findOneWithDecryption(em, TaxiFleetTrip, { id: parsed.id, deletedAt: null })
    if (!row) throw new CrudHttpError(404, { error: 'Not found' })
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)
    await assertDriverScopedTeamMember(ctx, row.teamMemberId ?? '')
    const metadata = { ...(row.metadata ?? {}) }
    metadata.cancelSource = parsed.cancelSource
    metadata.cancelledAt = new Date().toISOString()
    if (parsed.reason !== undefined) metadata.cancelReason = parsed.reason
    row.metadata = metadata
    if (parsed.reason !== undefined) row.notes = parsed.reason
    await applyTripStatusChange(ctx, row, 'cancelled', {
      cancelSource: parsed.cancelSource,
      cancelReason: parsed.reason ?? null,
    })
    await em.flush()
    await recalculateWeeklySettlementsForTrip(em, row)
    scheduleTripGoogleCalendarSync(row.id)
    return { tripId: row.id }
  },
}

const markTripPaidCommand: CommandHandler<TripMarkPaidInput, { tripId: string }> = {
  id: 'taxi_fleet.trips.mark_paid',
  async execute(input, ctx) {
    const parsed = tripMarkPaidSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await findOneWithDecryption(em, TaxiFleetTrip, { id: parsed.id, deletedAt: null })
    if (!row) throw new CrudHttpError(404, { error: 'Not found' })
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)
    const metadata = { ...(row.metadata ?? {}) }
    metadata.paymentMethod = parsed.paymentMethod
    metadata.paidAt = new Date().toISOString()
    if (parsed.paymentReference) metadata.paymentReference = parsed.paymentReference
    row.metadata = metadata
    await applyTripStatusChange(ctx, row, 'paid', { paymentMethod: parsed.paymentMethod })
    await em.flush()
    await recalculateWeeklySettlementsForTrip(em, row)
    scheduleTripGoogleCalendarSync(row.id)
    return { tripId: row.id }
  },
}

const scheduleTripCommand: CommandHandler<{ id: string }, { tripId: string }> = {
  id: 'taxi_fleet.trips.schedule',
  async execute(input, ctx) {
    const parsed = tripScheduleSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await findOneWithDecryption(em, TaxiFleetTrip, { id: parsed.id, deletedAt: null })
    if (!row) throw new CrudHttpError(404, { error: 'Not found' })
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)
    await applyTripStatusChange(ctx, row, 'scheduled')
    await em.flush()
    scheduleTripGoogleCalendarSync(row.id)
    return { tripId: row.id }
  },
}

const completeTripCommand: CommandHandler<{ id: string }, { tripId: string }> = {
  id: 'taxi_fleet.trips.complete',
  async execute(input, ctx) {
    const parsed = tripCompleteSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await findOneWithDecryption(em, TaxiFleetTrip, { id: parsed.id, deletedAt: null })
    if (!row) throw new CrudHttpError(404, { error: 'Not found' })
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)
    await applyTripStatusChange(ctx, row, 'completed')
    await em.flush()
    await recalculateWeeklySettlementsForTrip(em, row)
    scheduleTripGoogleCalendarSync(row.id)
    return { tripId: row.id }
  },
}

registerCommand(createTripCommand)
registerCommand(updateTripCommand)
registerCommand(deleteTripCommand)
registerCommand(approveTripCommand)
registerCommand(rejectTripCommand)
registerCommand(cancelTripCommand)
registerCommand(markTripPaidCommand)
registerCommand(scheduleTripCommand)
registerCommand(completeTripCommand)
