import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { TaxiFleetTrip } from '../data/entities'
import { tripInjectSchema, type TripInjectInput } from '../data/validators'
import {
  buildTripNotesFromStrapi,
  buildTripScheduleFromStrapi,
  mapStrapiPayloadToTaxiRequest,
  STRAPI_TAXI_REQUEST_SOURCE,
  tripRequestDetailsFromStrapiMapped,
} from '../lib/strapiTaxiRequestMapper'
import { resolveTripInjectCustomer } from '../lib/resolveTripInjectCustomer'
import { buildTripRequestMetadata } from '../lib/tripRequestForm'
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

    const mapped = mapStrapiPayloadToTaxiRequest(parsed.payload)
    if (!mapped.requestId.length) {
      mapped.requestId = parsed.externalId
    }
    if (!mapped.fromAddress || !mapped.toAddress || !mapped.tripDate || !mapped.tripTime) {
      throw new CrudHttpError(400, {
        error: translate('taxi_fleet.trips.inject.error.invalidPayload', 'Invalid Strapi taxi request payload.'),
      })
    }
    if (!mapped.contactName || !mapped.contactEmail || !mapped.contactPhone) {
      throw new CrudHttpError(400, {
        error: translate('taxi_fleet.trips.inject.error.invalidContact', 'Contact details are required.'),
      })
    }

    const { startedAt, endedAt } = buildTripScheduleFromStrapi(mapped)
    const source = parsed.source?.trim() || STRAPI_TAXI_REQUEST_SOURCE

    let referringPartnerEntityId: string | null = null
    if (mapped.referralCode) {
      referringPartnerEntityId = await resolveReferringPartnerEntityId(ctx, translate, {
        organizationId: parsed.organizationId,
        tenantId: parsed.tenantId,
        referralCode: mapped.referralCode,
        ownerDisplayName: mapped.referralCode,
        source,
      })
    }

    const customer = await resolveTripInjectCustomer(ctx, translate, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      mapped,
      source,
    })

    const tripRequestMetadata = buildTripRequestMetadata(
      tripRequestDetailsFromStrapiMapped(mapped, referringPartnerEntityId),
    )

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
      distanceKm: mapped.distanceKm > 0 ? String(mapped.distanceKm) : null,
      revenueAmount: mapped.totalPrice != null ? String(mapped.totalPrice) : null,
      currencyCode: 'PLN',
      customerPersonId: customer.customerPersonId,
      customerCompanyId: customer.customerCompanyId,
      status: 'new',
      notes: buildTripNotesFromStrapi(mapped),
      metadata: {
        source,
        requestId: parsed.externalId,
        enquiryStatus: mapped.enquiryStatus,
        locale: mapped.locale,
        strapi: mapped.strapiPayload,
        quoteSnapshot: mapped.quoteSnapshot,
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
