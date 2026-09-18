import { Resend } from 'resend'
import { parseBooleanWithDefault } from '@open-mercato/shared/lib/boolean'
import { resolveDefaultEmailFromAddress } from '@open-mercato/shared/lib/email/config'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { TaxiFleetTrip } from '../../data/entities'
import { taxiFleetDebugLog } from '../debugEnv'
import { loadTaxiFleetOrganizationSettings } from '../taxiFleetOrganizationSettings'
import type { TaxiFleetSettings } from '../taxiFleetSettings'
import { readContactEmail } from '../tripPaymentMetadata'
import { buildPaidCustomerEmail, buildPaymentLinkCustomerEmail } from './templates'

function normalizeEmail(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase() ?? ''
  if (!trimmed || !trimmed.includes('@')) return null
  return trimmed
}

async function loadTripEmailSettings(
  em: EntityManager,
  trip: TaxiFleetTrip,
): Promise<TaxiFleetSettings> {
  return loadTaxiFleetOrganizationSettings(em, {
    tenantId: trip.tenantId,
    organizationId: trip.organizationId,
  })
}

function resolveFromAddress(settings: TaxiFleetSettings): string {
  const from = settings.customerEmailFrom?.trim()
  const resolved = from || resolveDefaultEmailFromAddress()
  if (!resolved) {
    throw new Error('EMAIL_FROM_NOT_CONFIGURED: set taxi fleet customerEmailFrom or EMAIL_FROM')
  }
  return resolved
}

/** Public fleet contact for CC + reply-to; skip when empty or same as recipient. */
function resolvePublicContactCc(
  settings: TaxiFleetSettings,
  recipient: string,
): string | undefined {
  const contact = normalizeEmail(settings.publicContactEmail)
  if (!contact) return undefined
  if (contact === normalizeEmail(recipient)) return undefined
  return settings.publicContactEmail.trim()
}

async function sendHtmlEmail(params: {
  to: string
  subject: string
  html: string
  from: string
  cc?: string
  replyTo?: string
  kind: 'payment_link' | 'paid'
  tripId: string
}): Promise<void> {
  const emailDisabled =
    parseBooleanWithDefault(process.env.OM_DISABLE_EMAIL_DELIVERY, false) ||
    parseBooleanWithDefault(process.env.OM_TEST_MODE, false)
  if (emailDisabled) {
    taxiFleetDebugLog('customer_email', 'skipped — delivery disabled', {
      kind: params.kind,
      tripId: params.tripId,
      to: params.to,
      subject: params.subject,
      reason: process.env.OM_TEST_MODE ? 'OM_TEST_MODE' : 'OM_DISABLE_EMAIL_DELIVERY',
    })
    return
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    taxiFleetDebugLog('customer_email', 'missing RESEND_API_KEY', {
      kind: params.kind,
      tripId: params.tripId,
    })
    throw new Error('RESEND_API_KEY is not set')
  }

  taxiFleetDebugLog('customer_email', 'sending via Resend', {
    kind: params.kind,
    tripId: params.tripId,
    to: params.to,
    from: params.from,
    cc: params.cc ?? null,
    replyTo: params.replyTo ?? null,
    subject: params.subject,
    htmlBytes: Buffer.byteLength(params.html, 'utf8'),
  })

  const resend = new Resend(apiKey)
  const result = await resend.emails.send({
    to: params.to,
    subject: params.subject,
    from: params.from,
    html: params.html,
    ...(params.cc ? { cc: params.cc } : {}),
    ...(params.replyTo ? { reply_to: params.replyTo } : {}),
  })
  const err = (result as { error?: unknown }).error
  const errorMessage =
    typeof err === 'string'
      ? err
      : err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
        ? (err as { message: string }).message
        : null
  if (errorMessage) {
    taxiFleetDebugLog('customer_email', 'Resend error', {
      kind: params.kind,
      tripId: params.tripId,
      error: errorMessage,
      result,
    })
    throw new Error(`RESEND_SEND_FAILED: ${errorMessage}`)
  }

  const data = (result as { data?: { id?: string } | null }).data
  taxiFleetDebugLog('customer_email', 'sent ok', {
    kind: params.kind,
    tripId: params.tripId,
    to: params.to,
    resendId: data?.id ?? null,
  })
}

export async function sendPaymentLinkCustomerEmail(params: {
  em: EntityManager
  trip: TaxiFleetTrip
  paymentLink: string
}): Promise<void> {
  const to = readContactEmail(params.trip)
  if (!to) {
    console.warn('[taxi_fleet.customer_email] missing contact email for payment link', {
      tripId: params.trip.id,
    })
    taxiFleetDebugLog('customer_email', 'skip payment_link — no contact email', {
      tripId: params.trip.id,
    })
    return
  }
  const settings = await loadTripEmailSettings(params.em, params.trip)
  const currency = settings.paypal.currency || params.trip.currencyCode || 'PLN'
  const message = buildPaymentLinkCustomerEmail({
    trip: params.trip,
    currency,
    paymentLink: params.paymentLink,
  })
  const publicContact = resolvePublicContactCc(settings, to)
  taxiFleetDebugLog('customer_email', 'payment_link prepared', {
    tripId: params.trip.id,
    paymentLink: params.paymentLink,
    currency,
  })
  await sendHtmlEmail({
    to,
    subject: message.subject,
    html: message.html,
    from: resolveFromAddress(settings),
    cc: publicContact,
    replyTo: publicContact,
    kind: 'payment_link',
    tripId: params.trip.id,
  })
}

export async function sendPaidCustomerEmail(params: {
  em: EntityManager
  trip: TaxiFleetTrip
  driverPayment: boolean
  confirmationUrl?: string | null
}): Promise<void> {
  const to = readContactEmail(params.trip)
  if (!to) {
    console.warn('[taxi_fleet.customer_email] missing contact email for paid confirmation', {
      tripId: params.trip.id,
    })
    taxiFleetDebugLog('customer_email', 'skip paid — no contact email', {
      tripId: params.trip.id,
    })
    return
  }
  const settings = await loadTripEmailSettings(params.em, params.trip)
  const currency = settings.paypal.currency || params.trip.currencyCode || 'PLN'
  const message = buildPaidCustomerEmail({
    trip: params.trip,
    currency,
    driverPayment: params.driverPayment,
    confirmationUrl: params.confirmationUrl,
  })
  const publicContact = resolvePublicContactCc(settings, to)
  taxiFleetDebugLog('customer_email', 'paid confirmation prepared', {
    tripId: params.trip.id,
    driverPayment: params.driverPayment,
    confirmationUrl: params.confirmationUrl ?? null,
    currency,
  })
  await sendHtmlEmail({
    to,
    subject: message.subject,
    html: message.html,
    from: resolveFromAddress(settings),
    cc: publicContact,
    replyTo: publicContact,
    kind: 'paid',
    tripId: params.trip.id,
  })
}
