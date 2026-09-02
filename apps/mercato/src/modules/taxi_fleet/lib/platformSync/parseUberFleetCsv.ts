import type { PlatformTripUpsertInput } from '../../data/validators'
import {
  PLATFORM_TRIP_CSV_MAX_ROWS,
  type PlatformTripCsvParseResult,
  type PlatformTripCsvRowError,
  buildCsvHeaderIndex,
  detectCsvDelimiter,
  normalizeCsvHeader,
  parseCsvDateValue,
  parseCsvDecimal,
  parseCsvLine,
} from './parsePlatformTripCsv'
import type { PlatformTripIngestSource } from './types'

const TRIP_ACTIVITY_REQUIRED: ReadonlyArray<readonly string[]> = [
  ['Identyfikator UUID przejazdu', 'Trip UUID'],
  ['Identyfikator UUID kierowcy', 'Driver UUID'],
  ['Czas zamówienia przejazdu', 'Trip request time'],
  ['Odległość przejazdu', 'Trip distance'],
  ['Status przejazdu', 'Trip status'],
]

const PAYMENTS_REQUIRED: ReadonlyArray<readonly string[]> = [
  ['Identyfikator UUID przejazdu', 'Trip UUID'],
  ['Identyfikator UUID kierowcy', 'Driver UUID'],
  ['Opis', 'Description'],
  ['Wypłacono Ci : Twój przychód', 'Paid to you : Your earnings'],
]

const PAYMENT_TRIP_DESCRIPTIONS = new Set(['trip completed order', 'trip fare adjust order'])

type PaymentAggregate = {
  revenueAmount: number
  cashCollectedAbs: number
}

function normalizeHeaderKey(value: string): string {
  return normalizeCsvHeader(value)
    .toLowerCase()
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function findHeaderPosition(headerIndex: Map<string, number>, candidates: string[]): number | null {
  for (const candidate of candidates) {
    const exact = headerIndex.get(candidate)
    if (exact != null) return exact
  }
  const normalizedCandidates = candidates.map(normalizeHeaderKey)
  for (const [header, position] of headerIndex.entries()) {
    const normalized = normalizeHeaderKey(header)
    if (normalizedCandidates.includes(normalized)) return position
  }
  for (const candidate of normalizedCandidates) {
    for (const [header, position] of headerIndex.entries()) {
      const normalized = normalizeHeaderKey(header)
      if (normalized === candidate) return position
      if (candidate.length >= 12 && normalized.includes(candidate)) return position
    }
  }
  return null
}

function readCellAt(cells: string[], position: number | null): string {
  if (position == null) return ''
  return (cells[position] ?? '').trim()
}

function splitCsv(csvText: string): {
  lines: string[]
  delimiter: ',' | ';'
  headerIndex: Map<string, number>
  errors: PlatformTripCsvRowError[]
} {
  const trimmed = csvText.trim()
  if (!trimmed) {
    return {
      lines: [],
      delimiter: ',',
      headerIndex: new Map(),
      errors: [{ row: 0, message: 'CSV file is empty.' }],
    }
  }
  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (!lines.length) {
    return {
      lines: [],
      delimiter: ',',
      headerIndex: new Map(),
      errors: [{ row: 0, message: 'CSV file is empty.' }],
    }
  }
  const delimiter = detectCsvDelimiter(lines[0]!)
  const headerCells = parseCsvLine(lines[0]!, delimiter).map(normalizeCsvHeader)
  return {
    lines,
    delimiter,
    headerIndex: buildCsvHeaderIndex(headerCells),
    errors: [],
  }
}

function missingRequiredHeaders(
  headerIndex: Map<string, number>,
  required: ReadonlyArray<readonly string[]>,
): string[] {
  return required
    .filter((candidates) => findHeaderPosition(headerIndex, [...candidates]) == null)
    .map((candidates) => candidates[0]!)
}

function mapUberStatus(raw: string): PlatformTripUpsertInput['status'] {
  const normalized = raw.trim().toLowerCase()
  if (
    normalized === 'cancelled' ||
    normalized === 'canceled' ||
    normalized === 'rider_cancelled' ||
    normalized === 'rider_canceled' ||
    normalized === 'driver_cancelled' ||
    normalized === 'driver_canceled'
  ) {
    return 'cancelled'
  }
  if (normalized === 'paid') return 'paid'
  return 'completed'
}

function isTripPaymentDescription(description: string): boolean {
  return PAYMENT_TRIP_DESCRIPTIONS.has(description.trim().toLowerCase())
}

function buildPaymentAggregates(params: {
  lines: string[]
  delimiter: ',' | ';'
  headerIndex: Map<string, number>
}): { aggregates: Map<string, PaymentAggregate>; errors: PlatformTripCsvRowError[] } {
  const tripIdPos = findHeaderPosition(params.headerIndex, [
    'Identyfikator UUID przejazdu',
    'Trip UUID',
  ])
  const descriptionPos = findHeaderPosition(params.headerIndex, ['Opis', 'Description'])
  const revenuePos = findHeaderPosition(params.headerIndex, [
    'Wypłacono Ci : Twój przychód',
    'Paid to you : Your earnings',
  ])
  const cashPos = findHeaderPosition(params.headerIndex, [
    'Wypłacono Ci : Bilans przejazdu : Wypłaty : Odebrana gotówka',
    'Paid to you : Trip balance : Payouts : Cash collected',
  ])

  const aggregates = new Map<string, PaymentAggregate>()
  const errors: PlatformTripCsvRowError[] = []

  params.lines.slice(1).forEach((line, offset) => {
    const rowNumber = offset + 2
    const cells = parseCsvLine(line, params.delimiter)
    const tripId = readCellAt(cells, tripIdPos)
    const description = readCellAt(cells, descriptionPos)
    if (!tripId || !isTripPaymentDescription(description)) return

    const revenueRaw = readCellAt(cells, revenuePos)
    const revenueAmount = parseCsvDecimal(revenueRaw)
    if (revenueAmount == null) {
      errors.push({ row: rowNumber, message: 'Invalid payment revenue amount.' })
      return
    }

    const cashRaw = readCellAt(cells, cashPos)
    const cashAmount = cashRaw ? parseCsvDecimal(cashRaw) : 0
    const cashCollectedAbs = cashAmount == null ? 0 : Math.abs(cashAmount)

    const existing = aggregates.get(tripId)
    if (existing) {
      existing.revenueAmount += revenueAmount
      existing.cashCollectedAbs += cashCollectedAbs
      return
    }
    aggregates.set(tripId, { revenueAmount, cashCollectedAbs })
  })

  return { aggregates, errors }
}

export function parseUberFleetCsv(params: {
  tripActivityCsvText: string
  paymentsCsvText: string
  ingestSource: PlatformTripIngestSource
}): PlatformTripCsvParseResult {
  const activity = splitCsv(params.tripActivityCsvText)
  if (activity.errors.length) return { rows: [], errors: activity.errors }

  const payments = splitCsv(params.paymentsCsvText)
  if (payments.errors.length) return { rows: [], errors: payments.errors }

  const missingActivity = missingRequiredHeaders(activity.headerIndex, TRIP_ACTIVITY_REQUIRED)
  if (missingActivity.length) {
    return {
      rows: [],
      errors: [
        {
          row: 1,
          message: `Trip Activity CSV missing required columns: ${missingActivity.join(', ')}`,
        },
      ],
    }
  }

  const missingPayments = missingRequiredHeaders(payments.headerIndex, PAYMENTS_REQUIRED)
  if (missingPayments.length) {
    return {
      rows: [],
      errors: [
        {
          row: 1,
          message: `Payments CSV missing required columns: ${missingPayments.join(', ')}`,
        },
      ],
    }
  }

  const activityDataLines = activity.lines.slice(1)
  if (activityDataLines.length > PLATFORM_TRIP_CSV_MAX_ROWS) {
    return {
      rows: [],
      errors: [{ row: 0, message: `Too many rows (max ${PLATFORM_TRIP_CSV_MAX_ROWS}).` }],
    }
  }

  const { aggregates, errors: paymentErrors } = buildPaymentAggregates({
    lines: payments.lines,
    delimiter: payments.delimiter,
    headerIndex: payments.headerIndex,
  })

  const tripIdPos = findHeaderPosition(activity.headerIndex, [
    'Identyfikator UUID przejazdu',
    'Trip UUID',
  ])
  const driverIdPos = findHeaderPosition(activity.headerIndex, [
    'Identyfikator UUID kierowcy',
    'Driver UUID',
  ])
  const startedAtPos = findHeaderPosition(activity.headerIndex, [
    'Czas zamówienia przejazdu',
    'Trip request time',
  ])
  const endedAtPos = findHeaderPosition(activity.headerIndex, [
    'Czas zakończenia przejazdu',
    'Dropoff time',
  ])
  const distancePos = findHeaderPosition(activity.headerIndex, [
    'Odległość przejazdu',
    'Trip distance',
  ])
  const statusPos = findHeaderPosition(activity.headerIndex, ['Status przejazdu', 'Trip status'])
  const fromAddressPos = findHeaderPosition(activity.headerIndex, [
    'Adres odbioru',
    'Pickup address',
  ])
  const toAddressPos = findHeaderPosition(activity.headerIndex, [
    'Adres miejsca docelowego',
    'Dropoff address',
  ])
  const vehicleIdPos = findHeaderPosition(activity.headerIndex, [
    'UUID pojazdu',
    'Vehicle UUID',
  ])
  const vehiclePlatePos = findHeaderPosition(activity.headerIndex, [
    'Numer tablicy rejestracyjnej',
    'License plate',
  ])

  const rows: PlatformTripCsvParseResult['rows'] = []
  const errors: PlatformTripCsvRowError[] = [...paymentErrors]

  activityDataLines.forEach((line, offset) => {
    const rowNumber = offset + 2
    const cells = parseCsvLine(line, activity.delimiter)
    const externalTripId = readCellAt(cells, tripIdPos)
    const platformDriverId = readCellAt(cells, driverIdPos)
    const startedAtRaw = readCellAt(cells, startedAtPos)
    const statusRaw = readCellAt(cells, statusPos)

    if (!externalTripId || !platformDriverId || !startedAtRaw) {
      errors.push({ row: rowNumber, message: 'Missing required Trip Activity field values.' })
      return
    }

    const payment = aggregates.get(externalTripId)
    if (!payment) {
      errors.push({
        row: rowNumber,
        message: 'No matching payment revenue for trip.',
      })
      return
    }

    const startedAt = parseCsvDateValue(startedAtRaw)
    if (!startedAt) {
      errors.push({ row: rowNumber, message: 'Invalid Trip Activity startedAt date.' })
      return
    }

    const endedAtRaw = readCellAt(cells, endedAtPos)
    const endedAt = endedAtRaw ? parseCsvDateValue(endedAtRaw) : null
    if (endedAtRaw && !endedAt) {
      errors.push({ row: rowNumber, message: 'Invalid Trip Activity endedAt date.' })
      return
    }

    const distanceRaw = readCellAt(cells, distancePos)
    const distanceKm = distanceRaw ? parseCsvDecimal(distanceRaw) : null
    if (distanceRaw && distanceKm == null) {
      errors.push({ row: rowNumber, message: 'Invalid Trip Activity distance.' })
      return
    }

    const fromAddress = readCellAt(cells, fromAddressPos) || null
    const toAddress = readCellAt(cells, toAddressPos) || null
    const platformVehicleId = readCellAt(cells, vehicleIdPos) || null
    const vehiclePlate = readCellAt(cells, vehiclePlatePos) || null

    rows.push({
      ingestSource: params.ingestSource,
      platform: 'uber',
      externalTripId,
      platformDriverId,
      status: mapUberStatus(statusRaw),
      startedAt,
      endedAt,
      distanceKm,
      revenueAmount: payment.revenueAmount,
      currencyCode: 'PLN',
      paymentType: payment.cashCollectedAbs > 0 ? 'cash' : 'electronic',
      rawExternalStatus: statusRaw || null,
      fromAddress,
      toAddress,
      platformVehicleId,
      vehiclePlate,
    })
  })

  return { rows, errors }
}
