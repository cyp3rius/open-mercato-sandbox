import { NextResponse } from 'next/server'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { TaxiFleetTrip } from '@/modules/taxi_fleet/data/entities'
import { loadTaxiFleetOrganizationSettings } from '@/modules/taxi_fleet/lib/taxiFleetOrganizationSettings'
import {
  buildConfirmationRedirectUrl,
  capturePayPalOrder,
} from '@/modules/taxi_fleet/lib/paypal/client'
import {
  readPaypalOrderId,
  readRequestId,
  readTripMetadata,
} from '@/modules/taxi_fleet/lib/tripPaymentMetadata'
import { sendPaidCustomerEmail } from '@/modules/taxi_fleet/lib/customerEmails/send'
import { scheduleAfterResponse } from '@/modules/taxi_fleet/lib/scheduleAfterResponse'
import { normalizeTripStatus } from '@/modules/taxi_fleet/lib/tripStatuses'
import { scheduleTripGoogleCalendarSync } from '@/modules/taxi_fleet/lib/googleCalendar/tripGoogleCalendarSync'

export const metadata = {
  GET: { requireAuth: false },
}

async function findTripIdByPaymentHash(em: EntityManager, paymentHash: string): Promise<string | null> {
  const rows = (await em.getConnection().execute(
    `select id from taxi_fleet_trips
     where deleted_at is null
       and metadata->>'paymentHash' = ?
     limit 1`,
    [paymentHash],
  )) as Array<{ id?: string }>
  const id = rows[0]?.id
  return typeof id === 'string' && id.trim() ? id.trim() : null
}

function extractPayPalToken(url: URL): string {
  return url.searchParams.get('token')?.trim() || ''
}

export async function GET(req: Request, ctx: { params: Promise<{ hash: string }> }) {
  const { hash: rawHash } = await ctx.params
  const paymentHash = typeof rawHash === 'string' ? rawHash.trim() : ''
  if (!paymentHash) {
    return NextResponse.json({ error: 'Missing payment hash.' }, { status: 400 })
  }

  const url = new URL(req.url)
  const container = await createRequestContainer()
  const em = (container.resolve('em') as EntityManager).fork()

  try {
    const tripId = await findTripIdByPaymentHash(em, paymentHash)
    if (!tripId) {
      return NextResponse.json({ error: 'Trip not found for payment hash.' }, { status: 404 })
    }

    const trip = await findOneWithDecryption(em, TaxiFleetTrip, { id: tripId, deletedAt: null })
    if (!trip) {
      return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })
    }

    const settings = await loadTaxiFleetOrganizationSettings(em, {
      tenantId: trip.tenantId,
      organizationId: trip.organizationId,
    })
    const requestId = readRequestId(trip)

    const redirect = (payment: string) => {
      try {
        return NextResponse.redirect(
          buildConfirmationRedirectUrl(settings.paypal, requestId, { payment }),
          302,
        )
      } catch {
        return NextResponse.json({ ok: true, payment, requestId })
      }
    }

    if (url.searchParams.get('cancelled') === '1') {
      return redirect('cancelled')
    }

    if (normalizeTripStatus(trip.status) === 'paid') {
      return redirect('already-paid')
    }

    if (normalizeTripStatus(trip.status) !== 'approved') {
      return redirect('failed')
    }

    const orderId = extractPayPalToken(url) || readPaypalOrderId(trip) || ''
    if (!orderId) {
      return redirect('failed')
    }

    const capture = await capturePayPalOrder(settings.paypal, orderId)
    if (capture.status !== 'COMPLETED') {
      return redirect('failed')
    }

    const meta = readTripMetadata(trip)
    meta.paypalOrderId = orderId
    meta.enquiryStatus = 'paid'
    trip.metadata = meta
    await em.flush()

    const commandBus = container.resolve('commandBus') as CommandBus
    const runtimeCtx: CommandRuntimeContext = {
      container,
      auth: {
        sub: 'system:paypal-confirm',
        tenantId: trip.tenantId,
        orgId: trip.organizationId,
        roles: [],
      },
      organizationScope: null,
      selectedOrganizationId: trip.organizationId,
      organizationIds: [trip.organizationId],
      request: req,
    }

    await commandBus.execute('taxi_fleet.trips.mark_paid', {
      input: {
        id: trip.id,
        paymentMethod: 'paypal',
        paymentReference: orderId,
      },
      ctx: runtimeCtx,
    })

    const refreshed = await findOneWithDecryption(em, TaxiFleetTrip, { id: trip.id, deletedAt: null })
    if (refreshed) {
      const confirmationUrl = settings.paypal.confirmationPageBase?.trim()
        ? buildConfirmationRedirectUrl(settings.paypal, requestId, { payment: 'success' })
        : null
      scheduleAfterResponse(() => {
        void sendPaidCustomerEmail({
          em,
          trip: refreshed,
          driverPayment: false,
          confirmationUrl,
        }).catch((error) => {
          console.error('[taxi_fleet.payment.confirm] paid email failed', {
            tripId: trip.id,
            error: error instanceof Error ? error.message : String(error),
          })
        })
      })
    }

    scheduleTripGoogleCalendarSync(trip.id)
    return redirect('success')
  } catch (error) {
    console.error('[taxi_fleet.payment.confirm] failed', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Payment confirmation failed.' },
      { status: 500 },
    )
  }
}

export const openApi = {
  GET: {
    summary: 'Confirm PayPal payment for an injected trip (public return URL)',
    tags: ['Taxi fleet'],
  },
}
