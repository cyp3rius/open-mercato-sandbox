import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { requireId } from '@open-mercato/shared/lib/commands/helpers'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetDailyAssignment } from '../data/entities'
import {
  assignmentCreateSchema,
  assignmentDeleteSchema,
  assignmentShiftSchema,
  assignmentUpdateSchema,
  type AssignmentCreateInput,
  type AssignmentShiftInput,
  type AssignmentUpdateInput,
} from '../data/validators'
import { findAssignmentConflict } from '../lib/assignmentValidation'
import { assertTeamMemberHasDriverProfile } from '../lib/driverProfileGuard'
import { resolveDriverContext } from '../lib/driverContext'
import { computeAssignmentGpsDistanceKm } from '../lib/computeAssignmentGpsDistance'
import {
  checkShiftEndGrace,
  checkShiftStartGrace,
  isAssignmentClockEligible,
} from '../lib/shiftGraceWindow'
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

    const settings = await loadTaxiFleetOrganizationSettings(em, {
      tenantId: row.tenantId,
      organizationId: row.organizationId,
    })
    const grace = {
      hoursBeforeShift: settings.hoursBeforeShift,
      hoursAfterShift: settings.hoursAfterShift,
    }
    const timeZone = settings.calendar.timezone || 'Europe/Warsaw'
    const now = new Date()

    if (
      !isAssignmentClockEligible(
        {
          assignmentDate: row.assignmentDate,
          plannedShiftStart: row.plannedShiftStart,
          plannedShiftEnd: row.plannedShiftEnd,
        },
        now,
        grace,
        timeZone,
      )
    ) {
      throw new CrudHttpError(400, {
        error: translate(
          'taxi_fleet.errors.assignmentNotToday',
          'Clock in/out is only allowed for today’s assignment (or within the allowed early/late window).',
        ),
      })
    }

    let mutated = false
    if (parsed.action === 'start') {
      if (!row.shiftStart) {
        const startCheck = checkShiftStartGrace(
          now,
          { plannedShiftStart: row.plannedShiftStart, plannedShiftEnd: row.plannedShiftEnd },
          grace,
        )
        if (!startCheck.ok) {
          const message =
            startCheck.code === 'SHIFT_TOO_EARLY'
              ? translate(
                  'taxi_fleet.errors.shiftTooEarly',
                  'It is too early to start this shift. Try again closer to the planned start.',
                )
              : translate(
                  'taxi_fleet.errors.shiftTooLate',
                  'It is too late to start this shift.',
                )
          throw new CrudHttpError(400, { error: message, code: startCheck.code })
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
        const endCheck = checkShiftEndGrace(
          now,
          { plannedShiftStart: row.plannedShiftStart, plannedShiftEnd: row.plannedShiftEnd },
          grace,
        )
        if (!endCheck.ok) {
          throw new CrudHttpError(400, {
            error: translate(
              'taxi_fleet.errors.shiftEndTooLate',
              'It is too late to end this shift.',
            ),
            code: endCheck.code,
          })
        }
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
    }
  },
}

registerCommand(createAssignmentCommand)
registerCommand(updateAssignmentCommand)
registerCommand(deleteAssignmentCommand)
registerCommand(shiftAssignmentCommand)
