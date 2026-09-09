import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { requireId } from '@open-mercato/shared/lib/commands/helpers'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetDailyAssignment, TaxiFleetDriverProfile } from '../data/entities'
import {
  assignmentCreateSchema,
  assignmentDeleteSchema,
  assignmentSelfStartSchema,
  assignmentShiftSchema,
  assignmentUpdateSchema,
  type AssignmentCreateInput,
  type AssignmentSelfStartInput,
  type AssignmentShiftInput,
  type AssignmentUpdateInput,
} from '../data/validators'
import { findAssignmentConflict, findAssignedResourceIdsForDate, findAssignmentUniqueBlockers, resolveSelfStartAssignmentRow } from '../lib/assignmentValidation'
import { assertTeamMemberHasDriverProfile } from '../lib/driverProfileGuard'
import { resolveDriverContext } from '../lib/driverContext'
import { computeAssignmentGpsDistanceKm } from '../lib/computeAssignmentGpsDistance'
import {
  buildShiftStartAllowlist,
  resolveDriverDefaultResourceIds,
  resolveShiftStartVehicle,
} from '../lib/driverDefaultResources'
import { formatDateInTimeZone } from '../lib/shiftGraceWindow'
import { loadTaxiFleetOrganizationSettings } from '../lib/taxiFleetOrganizationSettings'
import { ensureOrganizationScope, ensureTenantScope } from './shared'

function resolvePlannedTimes(input: {
  plannedShiftStart?: Date | null
  plannedShiftEnd?: Date | null
  shiftStart?: Date | null
  shiftEnd?: Date | null
}): { plannedShiftStart: Date | null; plannedShiftEnd: Date | null } {
  return {
    plannedShiftStart: input.plannedShiftStart ?? input.shiftStart ?? null,
    plannedShiftEnd: input.plannedShiftEnd ?? input.shiftEnd ?? null,
  }
}

const createAssignmentCommand: CommandHandler<AssignmentCreateInput, { assignmentId: string }> = {
  id: 'taxi_fleet.assignments.create',
  async execute(input, ctx) {
    const parsed = assignmentCreateSchema.parse(input)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const { translate } = await resolveTranslations()
    await assertTeamMemberHasDriverProfile(em, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      teamMemberId: parsed.teamMemberId,
      translate,
    })
    const conflict = await findAssignmentConflict(em, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      assignmentDate: parsed.assignmentDate,
      teamMemberId: parsed.teamMemberId,
      resourceId: parsed.resourceId,
    })
    if (conflict) {
      const message =
        conflict === 'member'
          ? translate('taxi_fleet.errors.memberAssigned', 'Driver already assigned for this date.')
          : translate('taxi_fleet.errors.resourceAssigned', 'Vehicle already assigned for this date.')
      throw new CrudHttpError(409, { error: message, code: 'ASSIGNMENT_CONFLICT' })
    }
    const planned = resolvePlannedTimes(parsed)
    const now = new Date()
    const record = em.create(TaxiFleetDailyAssignment, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      teamMemberId: parsed.teamMemberId,
      resourceId: parsed.resourceId,
      assignmentDate: parsed.assignmentDate,
      plannedShiftStart: planned.plannedShiftStart,
      plannedShiftEnd: planned.plannedShiftEnd,
      shiftStart: null,
      shiftEnd: null,
      gpsDistanceKm: null,
      status: parsed.status ?? 'planned',
      notes: parsed.notes ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    await em.persistAndFlush(record)
    const eventBus = ctx.container.resolve('eventBus') as { emitEvent: (event: string, data: unknown) => Promise<void> }
    await eventBus.emitEvent('taxi_fleet.assignment.created', {
      id: record.id,
      tenantId: record.tenantId,
      organizationId: record.organizationId,
    })
    return { assignmentId: record.id }
  },
}

const updateAssignmentCommand: CommandHandler<AssignmentUpdateInput, { assignmentId: string }> = {
  id: 'taxi_fleet.assignments.update',
  async execute(input, ctx) {
    const parsed = assignmentUpdateSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await findOneWithDecryption(em, TaxiFleetDailyAssignment, { id: parsed.id, deletedAt: null })
    if (!row) throw new CrudHttpError(404, { error: 'Not found' })
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)
    const { translate } = await resolveTranslations()
    const nextMemberId = parsed.teamMemberId ?? row.teamMemberId
    if (parsed.teamMemberId !== undefined) {
      await assertTeamMemberHasDriverProfile(em, {
        tenantId: row.tenantId,
        organizationId: row.organizationId,
        teamMemberId: parsed.teamMemberId,
        translate,
      })
    }
    const nextResourceId = parsed.resourceId ?? row.resourceId
    const nextDate = parsed.assignmentDate ?? row.assignmentDate
    const conflict = await findAssignmentConflict(em, {
      tenantId: row.tenantId,
      organizationId: row.organizationId,
      assignmentDate: nextDate,
      teamMemberId: nextMemberId,
      resourceId: nextResourceId,
      excludeId: row.id,
    })
    if (conflict) {
      const message =
        conflict === 'member'
          ? translate('taxi_fleet.errors.memberAssigned', 'Driver already assigned for this date.')
          : translate('taxi_fleet.errors.resourceAssigned', 'Vehicle already assigned for this date.')
      throw new CrudHttpError(409, { error: message, code: 'ASSIGNMENT_CONFLICT' })
    }
    if (parsed.teamMemberId !== undefined) row.teamMemberId = parsed.teamMemberId
    if (parsed.resourceId !== undefined) row.resourceId = parsed.resourceId
    if (parsed.assignmentDate !== undefined) row.assignmentDate = parsed.assignmentDate

    // Operator schedule edits always go to planned*; never overwrite punch via CRUD.
    if (parsed.plannedShiftStart !== undefined) {
      row.plannedShiftStart = parsed.plannedShiftStart
    } else if (parsed.shiftStart !== undefined) {
      row.plannedShiftStart = parsed.shiftStart
    }
    if (parsed.plannedShiftEnd !== undefined) {
      row.plannedShiftEnd = parsed.plannedShiftEnd
    } else if (parsed.shiftEnd !== undefined) {
      row.plannedShiftEnd = parsed.shiftEnd
    }

    if (parsed.status !== undefined) row.status = parsed.status
    if (parsed.notes !== undefined) row.notes = parsed.notes
    await em.flush()
    const eventBus = ctx.container.resolve('eventBus') as { emitEvent: (event: string, data: unknown) => Promise<void> }
    await eventBus.emitEvent('taxi_fleet.assignment.updated', {
      id: row.id,
      tenantId: row.tenantId,
      organizationId: row.organizationId,
    })
    return { assignmentId: row.id }
  },
}

const deleteAssignmentCommand: CommandHandler<{ id: string }, { ok: true }> = {
  id: 'taxi_fleet.assignments.delete',
  async execute(input, ctx) {
    const parsed = assignmentDeleteSchema.parse(input)
    const id = requireId(parsed.id)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await findOneWithDecryption(em, TaxiFleetDailyAssignment, { id, deletedAt: null })
    if (!row) throw new CrudHttpError(404, { error: 'Not found' })
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)
    row.deletedAt = new Date()
    await em.flush()
    return { ok: true }
  },
}

const shiftAssignmentCommand: CommandHandler<
  AssignmentShiftInput,
  {
    assignmentId: string
    shiftStart: string | null
    shiftEnd: string | null
    plannedShiftStart: string | null
    plannedShiftEnd: string | null
    gpsDistanceKm: string | null
    status: string
    resourceId: string
  }
> = {
  id: 'taxi_fleet.assignments.shift',
  async execute(input, ctx) {
    const parsed = assignmentShiftSchema.parse(input)
    const { translate } = await resolveTranslations()
    const driver = await resolveDriverContext(ctx, translate, { requireExternalApp: true })
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await findOneWithDecryption(em, TaxiFleetDailyAssignment, {
      id: parsed.id,
      deletedAt: null,
    })
    if (!row) throw new CrudHttpError(404, { error: translate('taxi_fleet.errors.notFound', 'Not found') })
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)
    if (row.teamMemberId !== driver.teamMemberId) {
      throw new CrudHttpError(403, {
        error: translate('taxi_fleet.errors.assignmentNotOwned', 'Assignment does not belong to this driver.'),
      })
    }
    if (row.status === 'cancelled') {
      throw new CrudHttpError(400, {
        error: translate('taxi_fleet.errors.assignmentCancelled', 'Cannot clock in/out a cancelled assignment.'),
      })
    }

    const now = new Date()

    let mutated = false
    if (parsed.action === 'start') {
      if (!row.shiftStart) {
        const profile = await findOneWithDecryption(
          em,
          TaxiFleetDriverProfile,
          { teamMemberId: driver.teamMemberId, deletedAt: null },
          undefined,
          { tenantId: row.tenantId, organizationId: row.organizationId },
        )
        const defaults = resolveDriverDefaultResourceIds(profile ?? {})
        const busyResourceIds = await findAssignedResourceIdsForDate(em, {
          tenantId: row.tenantId,
          organizationId: row.organizationId,
          assignmentDate: row.assignmentDate,
          resourceIds: defaults,
          excludeAssignmentId: row.id,
        })
        const allowlist = buildShiftStartAllowlist({
          defaultResourceIds: defaults,
          busyResourceIds,
        })
        const vehiclePick = resolveShiftStartVehicle({
          allowlist,
          requestedResourceId: parsed.resourceId,
        })
        if (!vehiclePick.ok) {
          if (vehiclePick.code === 'SHIFT_VEHICLE_REQUIRED') {
            throw new CrudHttpError(400, {
              error: translate(
                allowlist.length
                  ? 'taxi_fleet.errors.shiftVehicleRequired'
                  : 'taxi_fleet.errors.noAvailableDefaultVehicles',
                allowlist.length
                  ? 'Select a vehicle before starting your shift.'
                  : 'No available default vehicles. All are already assigned for today.',
              ),
              code: allowlist.length ? 'SHIFT_VEHICLE_REQUIRED' : 'NO_AVAILABLE_DEFAULT_VEHICLES',
            })
          }
          throw new CrudHttpError(400, {
            error: translate(
              'taxi_fleet.errors.shiftVehicleNotAllowed',
              'Selected vehicle is not allowed for this shift.',
            ),
            code: 'SHIFT_VEHICLE_NOT_ALLOWED',
          })
        }
        if (vehiclePick.resourceId !== row.resourceId) {
          const conflict = await findAssignmentConflict(em, {
            tenantId: row.tenantId,
            organizationId: row.organizationId,
            assignmentDate: row.assignmentDate,
            teamMemberId: row.teamMemberId,
            resourceId: vehiclePick.resourceId,
            excludeId: row.id,
          })
          if (conflict === 'resource') {
            throw new CrudHttpError(409, {
              error: translate(
                'taxi_fleet.errors.resourceAssigned',
                'This vehicle is already assigned for that day.',
              ),
            })
          }
          row.resourceId = vehiclePick.resourceId
        }
        row.shiftStart = now
        if (row.status === 'planned') row.status = 'confirmed'
        mutated = true
      }
    } else {
      if (!row.shiftStart) {
        throw new CrudHttpError(400, {
          error: translate('taxi_fleet.errors.shiftNotStarted', 'Start the shift before ending it.'),
          code: 'SHIFT_NOT_STARTED',
        })
      }
      if (!row.shiftEnd) {
        row.shiftEnd = now
        row.status = 'completed'
        const gps = await computeAssignmentGpsDistanceKm(em, row.id, {
          tenantId: row.tenantId,
          organizationId: row.organizationId,
        })
        row.gpsDistanceKm = gps.formatted
        mutated = true
      }
    }
    if (mutated) {
      row.updatedAt = now
      await em.flush()
      const eventBus = ctx.container.resolve('eventBus') as {
        emitEvent: (event: string, data: unknown) => Promise<void>
      }
      await eventBus.emitEvent('taxi_fleet.assignment.updated', {
        id: row.id,
        tenantId: row.tenantId,
        organizationId: row.organizationId,
        shiftAction: parsed.action,
      })
    }
    return {
      assignmentId: row.id,
      shiftStart: row.shiftStart?.toISOString() ?? null,
      shiftEnd: row.shiftEnd?.toISOString() ?? null,
      plannedShiftStart: row.plannedShiftStart?.toISOString() ?? null,
      plannedShiftEnd: row.plannedShiftEnd?.toISOString() ?? null,
      gpsDistanceKm: row.gpsDistanceKm ?? null,
      status: row.status,
      resourceId: row.resourceId,
    }
  },
}

type ShiftResult = {
  assignmentId: string
  shiftStart: string | null
  shiftEnd: string | null
  plannedShiftStart: string | null
  plannedShiftEnd: string | null
  gpsDistanceKm: string | null
  status: string
  resourceId: string
}

const selfStartAssignmentCommand: CommandHandler<AssignmentSelfStartInput, ShiftResult> = {
  id: 'taxi_fleet.assignments.self_start',
  async execute(input, ctx) {
    const parsed = assignmentSelfStartSchema.parse(input)
    const { translate } = await resolveTranslations()
    const driver = await resolveDriverContext(ctx, translate, { requireExternalApp: true })
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const tenantId = driver.teamMember.tenantId
    const organizationId = driver.teamMember.organizationId
    const settings = await loadTaxiFleetOrganizationSettings(em, { tenantId, organizationId })
    const today = formatDateInTimeZone(new Date(), settings.calendar.timezone || 'Europe/Warsaw')

    const openShift = await findOneWithDecryption(
      em,
      TaxiFleetDailyAssignment,
      {
        teamMemberId: driver.teamMemberId,
        deletedAt: null,
        shiftStart: { $ne: null },
        shiftEnd: null,
        status: { $ne: 'cancelled' },
      },
      { orderBy: { shiftStart: 'DESC' } },
      { tenantId, organizationId },
    )
    if (openShift) {
      throw new CrudHttpError(409, {
        error: translate(
          'taxi_fleet.errors.shiftAlreadyOpen',
          'You already have an open shift. End it before starting another.',
        ),
        code: 'SHIFT_ALREADY_OPEN',
      })
    }

    const existingToday = await findOneWithDecryption(
      em,
      TaxiFleetDailyAssignment,
      {
        teamMemberId: driver.teamMemberId,
        assignmentDate: today,
        deletedAt: null,
        status: { $ne: 'cancelled' },
      },
      undefined,
      { tenantId, organizationId },
    )
    if (existingToday) {
      // Open shift already covered above; unstarted planned → normal clock-in.
      if (existingToday.shiftStart && !existingToday.shiftEnd) {
        throw new CrudHttpError(409, {
          error: translate(
            'taxi_fleet.errors.shiftAlreadyOpen',
            'You already have an open shift. End it before starting another.',
          ),
          code: 'SHIFT_ALREADY_OPEN',
        })
      }
      if (!existingToday.shiftStart) {
        return shiftAssignmentCommand.execute(
          {
            id: existingToday.id,
            action: 'start',
            resourceId: parsed.resourceId,
            clientMutationId: parsed.clientMutationId,
          },
          ctx,
        )
      }
      // Completed today: soft-delete so a new ad-hoc shift can reclaim the unique slots.
      existingToday.deletedAt = new Date()
      existingToday.updatedAt = new Date()
      await em.flush()
    }

    const profile = await findOneWithDecryption(
      em,
      TaxiFleetDriverProfile,
      { teamMemberId: driver.teamMemberId, deletedAt: null },
      undefined,
      { tenantId, organizationId },
    )
    const defaults = resolveDriverDefaultResourceIds(profile ?? {})
    const busyResourceIds = await findAssignedResourceIdsForDate(em, {
      tenantId,
      organizationId,
      assignmentDate: today,
      resourceIds: defaults,
    })
    const allowlist = buildShiftStartAllowlist({
      defaultResourceIds: defaults,
      busyResourceIds,
    })
    const vehiclePick = resolveShiftStartVehicle({
      allowlist,
      requestedResourceId: parsed.resourceId,
    })
    if (!vehiclePick.ok) {
      if (!defaults.length) {
        throw new CrudHttpError(400, {
          error: translate(
            'taxi_fleet.errors.noDefaultVehicles',
            'No default vehicles on your profile. Ask dispatch to set them or create an assignment.',
          ),
          code: 'NO_DEFAULT_VEHICLES',
        })
      }
      if (!allowlist.length) {
        throw new CrudHttpError(400, {
          error: translate(
            'taxi_fleet.errors.noAvailableDefaultVehicles',
            'No available default vehicles. All are already assigned for today.',
          ),
          code: 'NO_AVAILABLE_DEFAULT_VEHICLES',
        })
      }
      if (vehiclePick.code === 'SHIFT_VEHICLE_REQUIRED') {
        throw new CrudHttpError(400, {
          error: translate(
            'taxi_fleet.errors.shiftVehicleRequired',
            'Select a vehicle before starting your shift.',
          ),
          code: 'SHIFT_VEHICLE_REQUIRED',
        })
      }
      throw new CrudHttpError(400, {
        error: translate(
          'taxi_fleet.errors.shiftVehicleNotAllowed',
          'Selected vehicle is not in your default vehicles list.',
        ),
        code: 'SHIFT_VEHICLE_NOT_ALLOWED',
      })
    }

    const conflict = await findAssignmentConflict(em, {
      tenantId,
      organizationId,
      assignmentDate: today,
      teamMemberId: driver.teamMemberId,
      resourceId: vehiclePick.resourceId,
    })
    if (conflict) {
      const message =
        conflict === 'member'
          ? translate('taxi_fleet.errors.memberAssigned', 'Driver already assigned for this date.')
          : translate('taxi_fleet.errors.resourceAssigned', 'Vehicle already assigned for this date.')
      throw new CrudHttpError(409, { error: message, code: 'ASSIGNMENT_CONFLICT' })
    }

    const now = new Date()
    const blockers = await findAssignmentUniqueBlockers(em, {
      tenantId,
      organizationId,
      assignmentDate: today,
      teamMemberId: driver.teamMemberId,
      resourceId: vehiclePick.resourceId,
    })
    const claim = resolveSelfStartAssignmentRow({
      blockers,
      teamMemberId: driver.teamMemberId,
      resourceId: vehiclePick.resourceId,
    })
    if (!claim.ok) {
      const message =
        claim.conflict === 'member'
          ? translate('taxi_fleet.errors.memberAssigned', 'Driver already assigned for this date.')
          : translate('taxi_fleet.errors.resourceAssigned', 'Vehicle already assigned for this date.')
      throw new CrudHttpError(409, { error: message, code: 'ASSIGNMENT_CONFLICT' })
    }

    for (const ghost of claim.remove) {
      em.remove(ghost)
    }

    let record: TaxiFleetDailyAssignment
    if (claim.row) {
      record = claim.row
      record.deletedAt = null
      record.teamMemberId = driver.teamMemberId
      record.resourceId = vehiclePick.resourceId
      record.plannedShiftStart = null
      record.plannedShiftEnd = null
      record.shiftStart = now
      record.shiftEnd = null
      record.gpsDistanceKm = null
      record.status = 'confirmed'
      record.notes = null
      record.updatedAt = now
    } else {
      record = em.create(TaxiFleetDailyAssignment, {
        tenantId,
        organizationId,
        teamMemberId: driver.teamMemberId,
        resourceId: vehiclePick.resourceId,
        assignmentDate: today,
        plannedShiftStart: null,
        plannedShiftEnd: null,
        shiftStart: now,
        shiftEnd: null,
        gpsDistanceKm: null,
        status: 'confirmed',
        notes: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      })
      em.persist(record)
    }
    await em.flush()
    const eventBus = ctx.container.resolve('eventBus') as {
      emitEvent: (event: string, data: unknown) => Promise<void>
    }
    await eventBus.emitEvent('taxi_fleet.assignment.created', {
      id: record.id,
      tenantId: record.tenantId,
      organizationId: record.organizationId,
      adHoc: true,
      restored: Boolean(claim.row),
    })
    await eventBus.emitEvent('taxi_fleet.assignment.updated', {
      id: record.id,
      tenantId: record.tenantId,
      organizationId: record.organizationId,
      shiftAction: 'start',
      adHoc: true,
    })
    return {
      assignmentId: record.id,
      shiftStart: record.shiftStart?.toISOString() ?? null,
      shiftEnd: null,
      plannedShiftStart: null,
      plannedShiftEnd: null,
      gpsDistanceKm: null,
      status: record.status,
      resourceId: record.resourceId,
    }
  },
}

registerCommand(createAssignmentCommand)
registerCommand(updateAssignmentCommand)
registerCommand(deleteAssignmentCommand)
registerCommand(shiftAssignmentCommand)
registerCommand(selfStartAssignmentCommand)
