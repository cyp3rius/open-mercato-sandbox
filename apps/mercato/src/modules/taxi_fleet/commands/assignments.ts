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
  assignmentUpdateSchema,
  type AssignmentCreateInput,
  type AssignmentUpdateInput,
} from '../data/validators'
import { findAssignmentConflict } from '../lib/assignmentValidation'
import { assertTeamMemberHasDriverProfile } from '../lib/driverProfileGuard'
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

registerCommand(createAssignmentCommand)
registerCommand(updateAssignmentCommand)
registerCommand(deleteAssignmentCommand)
