import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import {
  TaxiFleetDriverCommunication,
  TaxiFleetDriverCommunicationRecipient,
  TaxiFleetDriverProfile,
} from '../data/entities'
import {
  driverCommunicationCancelSchema,
  driverCommunicationCreateSchema,
  driverCommunicationDeleteSchema,
  driverCommunicationRetryRecipientSchema,
  driverCommunicationScheduleSchema,
  driverCommunicationSendSchema,
  driverCommunicationUpdateSchema,
  type DriverCommunicationCancelInput,
  type DriverCommunicationCreateInput,
  type DriverCommunicationDeleteInput,
  type DriverCommunicationRetryRecipientInput,
  type DriverCommunicationScheduleInput,
  type DriverCommunicationSendInput,
  type DriverCommunicationUpdateInput,
} from '../data/validators'
import { resolveTeamMemberUserId } from '../lib/resolveTeamMemberUserId'
import {
  deliverCommunication,
  deliverCommunicationRecipient,
} from '../lib/driverCommunications/deliver'
import { ensureOrganizationScope, ensureTenantScope } from './shared'

async function replaceRecipients(
  em: EntityManager,
  communication: TaxiFleetDriverCommunication,
  teamMemberIds: string[],
): Promise<void> {
  const { translate } = await resolveTranslations()
  const uniqueIds = [...new Set(teamMemberIds)]
  if (!uniqueIds.length) {
    throw new CrudHttpError(400, {
      error: translate('taxi_fleet.communications.errors.recipientsRequired', 'Select at least one driver.'),
    })
  }

  const profiles = await em.find(TaxiFleetDriverProfile, {
    tenantId: communication.tenantId,
    organizationId: communication.organizationId,
    teamMemberId: { $in: uniqueIds },
    deletedAt: null,
  })
  const profileByMember = new Map(profiles.map((row) => [row.teamMemberId, row]))

  const resolved: Array<{ teamMemberId: string; userId: string }> = []
  for (const teamMemberId of uniqueIds) {
    if (!profileByMember.has(teamMemberId)) {
      throw new CrudHttpError(400, {
        error: translate(
          'taxi_fleet.communications.errors.invalidDriver',
          'One or more selected drivers are not fleet drivers.',
        ),
      })
    }
    const userId = await resolveTeamMemberUserId(em, teamMemberId, {
      tenantId: communication.tenantId,
      organizationId: communication.organizationId,
    })
    if (!userId) {
      throw new CrudHttpError(400, {
        error: translate(
          'taxi_fleet.communications.errors.driverNoUser',
          'A selected driver has no linked user account.',
        ),
      })
    }
    resolved.push({ teamMemberId, userId })
  }

  const existing = await em.find(TaxiFleetDriverCommunicationRecipient, {
    communicationId: communication.id,
  })
  for (const row of existing) {
    em.remove(row)
  }

  const now = new Date()
  for (const entry of resolved) {
    em.persist(
      em.create(TaxiFleetDriverCommunicationRecipient, {
        tenantId: communication.tenantId,
        organizationId: communication.organizationId,
        communicationId: communication.id,
        teamMemberId: entry.teamMemberId,
        userId: entry.userId,
        deliveryStatus: 'pending',
        readAt: null,
        lastError: null,
        attemptCount: 0,
        lastAttemptAt: null,
        createdAt: now,
        updatedAt: now,
      }),
    )
  }
}

function assertEditable(status: TaxiFleetDriverCommunication['status'], translate: (k: string, f: string) => string) {
  if (status !== 'draft' && status !== 'scheduled') {
    throw new CrudHttpError(400, {
      error: translate(
        'taxi_fleet.communications.errors.notEditable',
        'Only draft or scheduled communications can be edited.',
      ),
    })
  }
}

const createCommand: CommandHandler<DriverCommunicationCreateInput, { communicationId: string }> = {
  id: 'taxi_fleet.driver_communications.create',
  async execute(input, ctx) {
    const parsed = driverCommunicationCreateSchema.parse(input)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)
    const userId = ctx.auth?.sub
    if (!userId) throw new CrudHttpError(401, { error: 'Unauthorized' })

    const { translate } = await resolveTranslations()
    if (parsed.sendNow && parsed.scheduledAt) {
      throw new CrudHttpError(400, {
        error: translate(
          'taxi_fleet.communications.errors.sendOrSchedule',
          'Choose either send now or schedule, not both.',
        ),
      })
    }

    let scheduledAt: Date | null = null
    if (parsed.scheduledAt) {
      scheduledAt = new Date(parsed.scheduledAt)
      if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
        throw new CrudHttpError(400, {
          error: translate(
            'taxi_fleet.communications.errors.scheduleFuture',
            'Scheduled time must be in the future.',
          ),
        })
      }
    }

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const now = new Date()
    const record = em.create(TaxiFleetDriverCommunication, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      kind: parsed.kind,
      title: parsed.title,
      body: parsed.body,
      status: parsed.sendNow ? 'draft' : scheduledAt ? 'scheduled' : 'draft',
      scheduledAt,
      sentAt: null,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    await em.persistAndFlush(record)
    await replaceRecipients(em, record, parsed.teamMemberIds)
    await em.flush()

    if (parsed.sendNow) {
      await deliverCommunication(em, record.id)
    }

    return { communicationId: record.id }
  },
}

const updateCommand: CommandHandler<DriverCommunicationUpdateInput, { communicationId: string }> = {
  id: 'taxi_fleet.driver_communications.update',
  async execute(input, ctx) {
    const parsed = driverCommunicationUpdateSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await findOneWithDecryption(em, TaxiFleetDriverCommunication, {
      id: parsed.id,
      deletedAt: null,
    })
    if (!row) throw new CrudHttpError(404, { error: 'Not found' })
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)
    const { translate } = await resolveTranslations()
    assertEditable(row.status, translate)

    if (parsed.kind !== undefined) row.kind = parsed.kind
    if (parsed.title !== undefined) row.title = parsed.title
    if (parsed.body !== undefined) row.body = parsed.body
    row.updatedAt = new Date()
    em.persist(row)
    if (parsed.teamMemberIds) {
      await replaceRecipients(em, row, parsed.teamMemberIds)
    }
    await em.flush()
    return { communicationId: row.id }
  },
}

const deleteCommand: CommandHandler<DriverCommunicationDeleteInput, { ok: true }> = {
  id: 'taxi_fleet.driver_communications.delete',
  async execute(input, ctx) {
    const parsed = driverCommunicationDeleteSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await findOneWithDecryption(em, TaxiFleetDriverCommunication, {
      id: parsed.id,
      deletedAt: null,
    })
    if (!row) throw new CrudHttpError(404, { error: 'Not found' })
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)
    row.deletedAt = new Date()
    row.updatedAt = new Date()
    em.persist(row)
    await em.flush()
    return { ok: true }
  },
}

const sendCommand: CommandHandler<DriverCommunicationSendInput, { ok: true }> = {
  id: 'taxi_fleet.driver_communications.send',
  async execute(input, ctx) {
    const parsed = driverCommunicationSendSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await findOneWithDecryption(em, TaxiFleetDriverCommunication, {
      id: parsed.id,
      deletedAt: null,
    })
    if (!row) throw new CrudHttpError(404, { error: 'Not found' })
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)
    const { translate } = await resolveTranslations()
    if (row.status === 'sent' || row.status === 'sending') {
      throw new CrudHttpError(400, {
        error: translate('taxi_fleet.communications.errors.alreadySent', 'Communication already sent.'),
      })
    }
    if (row.status === 'cancelled') {
      throw new CrudHttpError(400, {
        error: translate('taxi_fleet.communications.errors.cancelled', 'Communication was cancelled.'),
      })
    }
    await deliverCommunication(em, row.id)
    return { ok: true }
  },
}

const scheduleCommand: CommandHandler<DriverCommunicationScheduleInput, { ok: true }> = {
  id: 'taxi_fleet.driver_communications.schedule',
  async execute(input, ctx) {
    const parsed = driverCommunicationScheduleSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await findOneWithDecryption(em, TaxiFleetDriverCommunication, {
      id: parsed.id,
      deletedAt: null,
    })
    if (!row) throw new CrudHttpError(404, { error: 'Not found' })
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)
    const { translate } = await resolveTranslations()
    assertEditable(row.status, translate)
    const scheduledAt = new Date(parsed.scheduledAt)
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
      throw new CrudHttpError(400, {
        error: translate(
          'taxi_fleet.communications.errors.scheduleFuture',
          'Scheduled time must be in the future.',
        ),
      })
    }
    row.scheduledAt = scheduledAt
    row.status = 'scheduled'
    row.updatedAt = new Date()
    em.persist(row)
    await em.flush()
    return { ok: true }
  },
}

const cancelCommand: CommandHandler<DriverCommunicationCancelInput, { ok: true }> = {
  id: 'taxi_fleet.driver_communications.cancel',
  async execute(input, ctx) {
    const parsed = driverCommunicationCancelSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await findOneWithDecryption(em, TaxiFleetDriverCommunication, {
      id: parsed.id,
      deletedAt: null,
    })
    if (!row) throw new CrudHttpError(404, { error: 'Not found' })
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)
    const { translate } = await resolveTranslations()
    if (row.status !== 'scheduled' && row.status !== 'draft') {
      throw new CrudHttpError(400, {
        error: translate(
          'taxi_fleet.communications.errors.cannotCancel',
          'Only draft or scheduled communications can be cancelled.',
        ),
      })
    }
    row.status = 'cancelled'
    row.updatedAt = new Date()
    em.persist(row)
    await em.flush()
    return { ok: true }
  },
}

const retryRecipientCommand: CommandHandler<DriverCommunicationRetryRecipientInput, { ok: true }> = {
  id: 'taxi_fleet.driver_communications.retry_recipient',
  async execute(input, ctx) {
    const parsed = driverCommunicationRetryRecipientSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const communication = await findOneWithDecryption(em, TaxiFleetDriverCommunication, {
      id: parsed.communicationId,
      deletedAt: null,
    })
    if (!communication) throw new CrudHttpError(404, { error: 'Not found' })
    ensureTenantScope(ctx, communication.tenantId)
    ensureOrganizationScope(ctx, communication.organizationId)

    const recipient = await em.findOne(TaxiFleetDriverCommunicationRecipient, {
      id: parsed.recipientId,
      communicationId: communication.id,
    })
    if (!recipient) throw new CrudHttpError(404, { error: 'Recipient not found' })
    const { translate } = await resolveTranslations()
    if (recipient.deliveryStatus !== 'failed' && recipient.deliveryStatus !== 'pending') {
      throw new CrudHttpError(400, {
        error: translate(
          'taxi_fleet.communications.errors.retryNotFailed',
          'Only failed or pending recipients can be retried.',
        ),
      })
    }
    await deliverCommunicationRecipient(em, communication, recipient)
    await em.flush()
    return { ok: true }
  },
}

registerCommand(createCommand)
registerCommand(updateCommand)
registerCommand(deleteCommand)
registerCommand(sendCommand)
registerCommand(scheduleCommand)
registerCommand(cancelCommand)
registerCommand(retryRecipientCommand)
