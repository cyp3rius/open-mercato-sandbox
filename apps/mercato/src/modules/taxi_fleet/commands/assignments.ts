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
import { ensureOrganizationScope, ensureTenantScope } from './shared'

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
    const now = new Date()
    const record = em.create(TaxiFleetDailyAssignment, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      teamMemberId: parsed.teamMemberId,
      resourceId: parsed.resourceId,
      assignmentDate: parsed.assignmentDate,
      shiftStart: parsed.shiftStart ?? null,
      shiftEnd: parsed.shiftEnd ?? null,
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
    if (parsed.shiftStart !== undefined) row.shiftStart = parsed.shiftStart
    if (parsed.shiftEnd !== undefined) row.shiftEnd = parsed.shiftEnd
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
  { assignmentId: string; shiftStart: string | null; shiftEnd: string | null; status: string }
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

    const today = new Date().toISOString().slice(0, 10)
    if (row.assignmentDate !== today) {
      throw new CrudHttpError(400, {
        error: translate('taxi_fleet.errors.assignmentNotToday', 'Clock in/out is only allowed for today’s assignment.'),
      })
    }

    const now = new Date()
    let mutated = false
    if (parsed.action === 'start') {
      if (!row.shiftStart) {
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
      status: row.status,
    }
  },
}

registerCommand(createAssignmentCommand)
registerCommand(updateAssignmentCommand)
registerCommand(deleteAssignmentCommand)
registerCommand(shiftAssignmentCommand)
