import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { TaxiFleetTrip } from '../data/entities'
import { tripInjectSchema, type TripInjectInput } from '../data/validators'
import { resolveTripInjectCustomer } from '../lib/resolveTripInjectCustomer'
import { buildTripRequestMetadata } from '../lib/tripRequestForm'
import {
  buildTripNotesFromInjectInput,
  buildTripScheduleFromInjectInput,
  tripRequestDetailsFromInjectInput,
} from '../lib/tripInjectNative'
import { STRAPI_TAXI_REQUEST_SOURCE } from '../lib/strapiTaxiRequestMapper'
import { resolveReferringPartnerEntityId } from '../../insurance_desk/lib/resolveReferringPartner'
import { ensureOrganizationScope, ensureTenantScope } from './shared'

async function findTripByExternalId(
  em: EntityManager,
  params: { tenantId: string; organizationId: string; externalId: string },
): Promise<TaxiFleetTrip | null> {
  const rows = await em.find(TaxiFleetTrip, {
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    deletedAt: null,
  })
  return (
    rows.find((row) => {
      const metadata = row.metadata
      if (!metadata || typeof metadata !== 'object') return false
      return (metadata as Record<string, unknown>).requestId === params.externalId
    }) ?? null
  )
}

const injectTripCommand: CommandHandler<TripInjectInput, { tripId: string; created: boolean }> = {
  id: 'taxi_fleet.trips.inject',
  async execute(input, ctx) {
    const parsed = tripInjectSchema.parse(input)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const { translate } = await resolveTranslations()

    const existing = await findTripByExternalId(em, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      externalId: parsed.externalId,
    })
    if (existing) {
      return { tripId: existing.id, created: false }
    }

    let startedAt: Date
    let endedAt: Date
    try {
      ;({ startedAt, endedAt } = buildTripScheduleFromInjectInput(parsed))
    } catch {
      throw new CrudHttpError(400, {
        error: translate('taxi_fleet.trips.inject.error.invalidSchedule', 'Invalid trip schedule.'),
      })
    }

    const source = parsed.source?.trim() || STRAPI_TAXI_REQUEST_SOURCE

    let referringPartnerEntityId: string | null = null
    if (parsed.referralCode?.trim()) {
      referringPartnerEntityId = await resolveReferringPartnerEntityId(ctx, translate, {
        organizationId: parsed.organizationId,
        tenantId: parsed.tenantId,
        referralCode: parsed.referralCode.trim(),
        ownerDisplayName: parsed.referralCode.trim(),
        source,
      })
    }

    const customer = await resolveTripInjectCustomer(ctx, translate, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      input: parsed,
      source,
    })

    const tripRequestDetails = tripRequestDetailsFromInjectInput(parsed, referringPartnerEntityId)
    const tripRequestMetadata = buildTripRequestMetadata(tripRequestDetails)

    const now = new Date()
    const record = em.create(TaxiFleetTrip, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      teamMemberId: null,
      resourceId: null,
      assignmentId: null,
      tripType: 'client',
      startedAt,
      endedAt,
      distanceKm: parsed.distanceKm != null && parsed.distanceKm > 0 ? String(parsed.distanceKm) : null,
      revenueAmount: parsed.revenueAmount != null ? String(parsed.revenueAmount) : null,
      currencyCode: parsed.currencyCode ?? 'PLN',
      customerPersonId: customer.customerPersonId,
      customerCompanyId: customer.customerCompanyId,
      status: 'new',
      notes: buildTripNotesFromInjectInput(parsed),
      metadata: {
        source,
        requestId: parsed.externalId,
        enquiryStatus: parsed.enquiryStatus ?? 'new',
        locale: parsed.locale ?? 'pl',
        ...(parsed.transporterPayload ? { strapi: parsed.transporterPayload } : {}),
        ...(parsed.quoteSnapshot ? { quoteSnapshot: parsed.quoteSnapshot } : {}),
        ...tripRequestMetadata,
      },
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    await em.persistAndFlush(record)
    const eventBus = ctx.container.resolve('eventBus') as { emitEvent: (event: string, data: unknown) => Promise<void> }
    await eventBus.emitEvent('taxi_fleet.trip.created', {
      id: record.id,
      tenantId: record.tenantId,
      organizationId: record.organizationId,
      teamMemberId: record.teamMemberId ?? null,
      tripType: record.tripType,
      status: record.status,
      requestId: parsed.externalId,
    })
    return { tripId: record.id, created: true }
  },
}

registerCommand(injectTripCommand)
