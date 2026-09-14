import type { TripFormValues } from '../../components/tripFormConfig'
import { toDateTimeLocalValue } from '../datetimeLocal'
import type { QuoteInput } from './quote-types'

export function splitTripScheduleLocal(startedAtLocal: string): { date: string; time: string } | null {
  const trimmed = startedAtLocal.trim()
  if (!trimmed.length) return null
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/)
  if (match?.[1] && match[2]) {
    return { date: match[1], time: match[2] }
  }
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  // Always use local calendar date + clock (never UTC from toISOString) so NIGHT/HOLIDAY match the trip form.
  const local = toDateTimeLocalValue(parsed)
  const localMatch = local.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/)
  if (!localMatch?.[1] || !localMatch[2]) return null
  return { date: localMatch[1], time: localMatch[2] }
}

/**
 * Builds quote input for fleet pricing. Vehicle category is intentionally omitted so
 * `calculateQuote` always runs `selectVehicle` (same as the public RS Moto calculator).
 */
export function buildQuoteInputFromTripForm(values: TripFormValues): QuoteInput | null {
  const schedule = splitTripScheduleLocal(values.startedAtLocal)
  const distanceKm = Number(values.distanceKm)
  if (!schedule || !Number.isFinite(distanceKm) || distanceKm <= 0) return null

  const passengers = Math.max(1, Number(values.passengers) || 1)
  const serviceType = values.serviceType === 'airport' ? 'airport' : 'local'

  return {
    serviceType,
    passengers,
    distanceKm,
    date: schedule.date,
    time: schedule.time,
    handLuggage: Math.max(0, Number(values.handLuggage) || 0),
    holdLuggage: serviceType === 'airport' ? Math.max(0, Number(values.holdLuggage) || 0) : 0,
    childSeats: Math.max(0, Number(values.childSeats) || 0),
    boosterSeats: Math.max(0, Number(values.boosterSeats) || 0),
    meetAndGreet: serviceType === 'airport' ? values.meetAndGreet === true : false,
    englishSpeakingDriver: values.englishSpeakingDriver === true,
  }
}

/**
 * Driver-app quote defaults when luggage/passenger fields are not collected in the wizard.
 */
export function buildDriverQuoteInputFromRoute(input: {
  startedAtLocal: string
  distanceKm: string | number
}): QuoteInput | null {
  const schedule = splitTripScheduleLocal(input.startedAtLocal)
  const distanceKm = typeof input.distanceKm === 'number' ? input.distanceKm : Number(input.distanceKm)
  if (!schedule || !Number.isFinite(distanceKm) || distanceKm <= 0) return null

  return {
    serviceType: 'local',
    passengers: 1,
    distanceKm,
    date: schedule.date,
    time: schedule.time,
    handLuggage: 0,
    holdLuggage: 0,
    childSeats: 0,
    boosterSeats: 0,
    meetAndGreet: false,
    englishSpeakingDriver: false,
  }
}

export function readQuoteSnapshotFromMetadata(metadata: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== 'object') return null
  const snapshot = metadata.quoteSnapshot
  return snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
    ? (snapshot as Record<string, unknown>)
    : null
}
