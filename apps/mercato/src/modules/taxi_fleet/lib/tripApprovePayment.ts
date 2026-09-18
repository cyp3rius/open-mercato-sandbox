import type { EntityManager } from '@mikro-orm/postgresql'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { TaxiFleetTrip } from '../data/entities'
import { loadTaxiFleetOrganizationSettings } from './taxiFleetOrganizationSettings'
import {
  buildConfirmationRedirectUrl,
  createPayPalOrder,
} from './paypal/client'
import {
  ensurePaymentHash,
  isDriverPaymentType,
  readPaymentHash,
  readRequestId,
  readTripLocale,
  readTripPaymentType,
  readTripTotalPrice,
  withPaymentOrderMetadata,
} from './tripPaymentMetadata'
import { sendPaidCustomerEmail, sendPaymentLinkCustomerEmail } from './customerEmails/send'
import { taxiFleetDebugLog } from './debugEnv'
import { scheduleAfterResponse } from './scheduleAfterResponse'

function resolveAppBaseUrl(ctx: CommandRuntimeContext): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    ''
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  const req = ctx.request
  if (req?.url) {
    try {
      const url = new URL(req.url)
      return `${url.protocol}//${url.host}`
    } catch {
      // fall through
    }
  }
  throw new CrudHttpError(500, {
    error: 'APP_URL is not configured for PayPal return URLs.',
  })
}

/**
 * After status is set to `approved`: create PayPal order + payment-link email for electronic,
 * or send offline "pay the driver" email for cash/card. Never transitions to paid.
 */
export async function runTripApprovePaymentSideEffects(
  ctx: CommandRuntimeContext,
  em: EntityManager,
  trip: TaxiFleetTrip,
): Promise<{ paymentLink: string | null }> {
  const { translate } = await resolveTranslations()
  const paymentType = readTripPaymentType(trip)
  const settings = await loadTaxiFleetOrganizationSettings(em, {
    tenantId: trip.tenantId,
    organizationId: trip.organizationId,
  })

  taxiFleetDebugLog('approve_payment', 'start', {
    tripId: trip.id,
    paymentType,
    paypalEnabled: settings.paypal.enabled,
    paypalMode: settings.paypal.mode,
  })

  if (isDriverPaymentType(paymentType)) {
    const confirmationUrl = settings.paypal.confirmationPageBase?.trim()
      ? buildConfirmationRedirectUrl(settings.paypal, readRequestId(trip), {
          payment: 'confirmed',
        })
      : null
    taxiFleetDebugLog('approve_payment', 'offline driver payment — schedule customer email', {
      tripId: trip.id,
      confirmationUrl,
    })
    scheduleAfterResponse(() => {
      void sendPaidCustomerEmail({
        em,
        trip,
        driverPayment: true,
        confirmationUrl,
      }).catch((error) => {
        console.error('[taxi_fleet.approve] offline customer email failed', {
          tripId: trip.id,
          error: error instanceof Error ? error.message : String(error),
        })
      })
    })
    return { paymentLink: null }
  }

  if (paymentType !== 'electronic') {
    taxiFleetDebugLog('approve_payment', 'skip — payment type has no PayPal/email side effects', {
      tripId: trip.id,
      paymentType,
    })
    return { paymentLink: null }
  }

  if (!settings.paypal.enabled) {
    throw new CrudHttpError(400, {
      error: translate(
        'taxi_fleet.trips.errors.paypalDisabled',
        'PayPal is disabled. Enable it in taxi fleet settings before approving electronic trips.',
      ),
    })
  }

  const ensured = ensurePaymentHash(trip.metadata ?? null)
  trip.metadata = ensured.metadata
  const paymentHash = ensured.paymentHash || readPaymentHash(trip)
  if (!paymentHash) {
    throw new CrudHttpError(500, {
      error: translate('taxi_fleet.trips.errors.paymentHashMissing', 'Payment hash is missing.'),
    })
  }

  const totalPrice = readTripTotalPrice(trip)
  if (!(totalPrice > 0)) {
    throw new CrudHttpError(400, {
      error: translate(
        'taxi_fleet.trips.errors.invalidTotalForPaypal',
        'Trip total must be greater than zero for PayPal.',
      ),
    })
  }

  const appBaseUrl = resolveAppBaseUrl(ctx)
  taxiFleetDebugLog('approve_payment', 'creating PayPal order', {
    tripId: trip.id,
    requestId: readRequestId(trip),
    paymentHash,
    totalPrice,
    appBaseUrl,
  })
  const { orderId, approvalUrl } = await createPayPalOrder({
    settings: settings.paypal,
    requestId: readRequestId(trip),
    paymentHash,
    totalPrice,
    locale: readTripLocale(trip),
    appBaseUrl,
  })

  trip.metadata = withPaymentOrderMetadata(trip.metadata ?? null, {
    paymentLink: approvalUrl,
    paypalOrderId: orderId,
  })
  await em.flush()

  taxiFleetDebugLog('approve_payment', 'PayPal order saved — schedule payment link email', {
    tripId: trip.id,
    orderId,
    approvalUrl,
  })

  scheduleAfterResponse(() => {
    void sendPaymentLinkCustomerEmail({
      em,
      trip,
      paymentLink: approvalUrl,
    }).catch((error) => {
      console.error('[taxi_fleet.approve] payment link email failed', {
        tripId: trip.id,
        error: error instanceof Error ? error.message : String(error),
      })
    })
  })

  return { paymentLink: approvalUrl }
}
