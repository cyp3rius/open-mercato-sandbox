import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { GoogleAuth } from 'google-auth-library'
import { google } from 'googleapis'
import { TaxiFleetTrip } from '../../data/entities'
import { loadTaxiFleetOrganizationSettings } from '../taxiFleetOrganizationSettings'
import { normalizeTripStatus } from '../tripStatuses'
import { tripRequestDetailsFromMetadata } from '../tripRequestForm'
import { scheduleAfterResponse } from '../scheduleAfterResponse'

const GOOGLE_CALENDAR_EVENT_META_KEY = 'googleCalendarEventId'
const CALENDAR_SCOPES = ['https://www.googleapis.com/auth/calendar']

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readGoogleCalendarEventId(metadata: Record<string, unknown> | null | undefined): string | null {
  const root = asRecord(metadata)
  const value = root?.[GOOGLE_CALENDAR_EVENT_META_KEY]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function withGoogleCalendarEventId(
  metadata: Record<string, unknown> | null | undefined,
  eventId: string | null,
): Record<string, unknown> {
  const root = metadata && typeof metadata === 'object' ? { ...metadata } : {}
  if (eventId) {
    root[GOOGLE_CALENDAR_EVENT_META_KEY] = eventId
  } else {
    delete root[GOOGLE_CALENDAR_EVENT_META_KEY]
  }
  return root
}

function normalizePrivateKey(raw: string): string {
  return raw.replace(/\\n/g, '\n').trim()
}

async function createCalendarClient(params: {
  serviceAccountEmail: string
  serviceAccountPrivateKey: string
}) {
  const auth = new GoogleAuth({
    credentials: {
      client_email: params.serviceAccountEmail,
      private_key: normalizePrivateKey(params.serviceAccountPrivateKey),
    },
    scopes: CALENDAR_SCOPES,
  })
  const authClient = await auth.getClient()
  return google.calendar({ version: 'v3', auth: authClient as never })
}

function buildEventTimes(trip: TaxiFleetTrip, defaultDurationMinutes: number, timeZone: string) {
  const start = trip.startedAt
  if (!start || Number.isNaN(start.getTime())) return null
  const end =
    trip.endedAt && !Number.isNaN(trip.endedAt.getTime()) && trip.endedAt.getTime() > start.getTime()
      ? trip.endedAt
      : new Date(start.getTime() + Math.max(15, defaultDurationMinutes) * 60_000)
  return {
    start: { dateTime: start.toISOString(), timeZone },
    end: { dateTime: end.toISOString(), timeZone },
  }
}

function buildEventSummary(trip: TaxiFleetTrip): string {
  const request = tripRequestDetailsFromMetadata(trip.metadata ?? null)
  const from = request.fromAddress.trim()
  const to = request.toAddress.trim()
  if (from && to) return `${from} → ${to}`
  if (from) return from
  if (to) return to
  return `Taxi trip (${normalizeTripStatus(trip.status)})`
}

function buildEventDescription(trip: TaxiFleetTrip): string {
  const request = tripRequestDetailsFromMetadata(trip.metadata ?? null)
  const lines: string[] = [
    `Status: ${normalizeTripStatus(trip.status)}`,
    `Type: ${trip.tripType}`,
  ]
  if (request.contactName) lines.push(`Contact: ${request.contactName}`)
  if (request.companyName) lines.push(`Company: ${request.companyName}`)
  if (request.contactPhone) lines.push(`Phone: ${request.contactPhone}`)
  if (trip.notes?.trim()) lines.push(`Notes: ${trip.notes.trim()}`)
  lines.push(`Trip ID: ${trip.id}`)
  return lines.join('\n')
}

export async function syncTripGoogleCalendarEvent(
  em: EntityManager,
  tripId: string,
): Promise<void> {
  const trip = await findOneWithDecryption(em, TaxiFleetTrip, { id: tripId })
  if (!trip) return

  const settings = await loadTaxiFleetOrganizationSettings(em, {
    tenantId: trip.tenantId,
    organizationId: trip.organizationId,
  })
  const calendar = settings.calendar
  if (!calendar.enabled) return

  const email = calendar.serviceAccountEmail?.trim() ?? ''
  const privateKey = calendar.serviceAccountPrivateKey?.trim() ?? ''
  const calendarId = calendar.calendarId?.trim() || 'primary'
  if (!email || !privateKey) {
    console.warn('[taxi_fleet.google_calendar] enabled but credentials missing', {
      tripId,
      organizationId: trip.organizationId,
    })
    return
  }

  const existingEventId = readGoogleCalendarEventId(trip.metadata ?? null)
  const status = normalizeTripStatus(trip.status)
  const shouldDelete = Boolean(trip.deletedAt) || status === 'cancelled' || !trip.startedAt

  try {
    const client = await createCalendarClient({
      serviceAccountEmail: email,
      serviceAccountPrivateKey: privateKey,
    })

    if (shouldDelete) {
      if (existingEventId) {
        await client.events.delete({ calendarId, eventId: existingEventId }).catch(() => undefined)
        trip.metadata = withGoogleCalendarEventId(trip.metadata ?? null, null)
        trip.updatedAt = new Date()
        await em.flush()
      }
      return
    }

    const times = buildEventTimes(trip, calendar.defaultDurationMinutes, calendar.timezone || 'Europe/Warsaw')
    if (!times) return

    const body = {
      summary: buildEventSummary(trip),
      description: buildEventDescription(trip),
      start: times.start,
      end: times.end,
    }

    if (existingEventId) {
      try {
        await client.events.patch({
          calendarId,
          eventId: existingEventId,
          requestBody: body,
        })
        return
      } catch (error) {
        console.warn('[taxi_fleet.google_calendar] patch failed, recreating', {
          tripId,
          eventId: existingEventId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    const created = await client.events.insert({
      calendarId,
      requestBody: body,
    })
    const eventId = created.data.id?.trim() || null
    if (!eventId) return
    trip.metadata = withGoogleCalendarEventId(trip.metadata ?? null, eventId)
    trip.updatedAt = new Date()
    await em.flush()
  } catch (error) {
    console.error('[taxi_fleet.google_calendar] sync failed', {
      tripId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

async function runTripGoogleCalendarJob(tripId: string): Promise<void> {
  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager
  const workerEm = typeof em.fork === 'function' ? em.fork() : em
  await syncTripGoogleCalendarEvent(workerEm, tripId)
}

/** Fire-and-forget Google Calendar upsert/delete. Never blocks trip save. */
export function scheduleTripGoogleCalendarSync(tripId: string): void {
  if (!tripId.trim()) return
  const run = () => {
    void runTripGoogleCalendarJob(tripId).catch((error) => {
      console.error('[taxi_fleet.google_calendar] background sync failed', {
        tripId,
        error: error instanceof Error ? error.message : String(error),
      })
    })
  }
  scheduleAfterResponse(run)
}
