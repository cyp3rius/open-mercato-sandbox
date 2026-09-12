import { createHash } from 'node:crypto'
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

const REQUIRED_HEADERS: ReadonlyArray<readonly string[]> = [
  ['Data'],
  ['Indywidualny numer identyfikacyjny'],
  ['Cena przejazdu|ZŁ', 'Cena przejazdu|ZL'],
  ['Status'],
]

const COMPLETED_STATUS = 'ukończone'

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

function mapBoltPaymentType(raw: string): PlatformTripUpsertInput['paymentType'] {
  const normalized = raw.trim().toLowerCase()
  if (normalized === 'gotówką' || normalized === 'gotowka' || normalized === 'cash') return 'cash'
  return 'electronic'
}

function isCompletedStatus(raw: string): boolean {
  return raw.trim().toLowerCase() === COMPLETED_STATUS
}

function splitRoute(route: string): { fromAddress: string | null; toAddress: string | null } {
  const trimmed = route.trim()
  if (!trimmed) return { fromAddress: null, toAddress: null }
  const parts = trimmed.split(/\s*→\s*/)
  if (parts.length < 2) {
    return { fromAddress: trimmed, toAddress: null }
  }
  const fromAddress = parts[0]?.trim() || null
  const toAddress = parts.slice(1).join(' → ').trim() || null
  return { fromAddress, toAddress }
}

/** Stable synthetic trip id — portal CSV has no order_reference. */
export function buildBoltCsvExternalTripId(params: {
  driverUuid: string
  startedAtRaw: string
  route: string
  revenueRaw: string
  statusRaw: string
}): string {
  const canonical = [
    params.driverUuid.trim(),
    params.startedAtRaw.trim(),
    params.route.trim(),
    params.revenueRaw.trim(),
    params.statusRaw.trim(),
  ].join('|')
  const digest = createHash('sha256').update(canonical, 'utf8').digest('hex').slice(0, 32)
  return `boltcsv:${digest}`
}

export function parseBoltTripHistoryCsv(params: {
  csvText: string
  ingestSource: PlatformTripIngestSource
}): PlatformTripCsvParseResult {
  const split = splitCsv(params.csvText)
  if (split.errors.length) return { rows: [], errors: split.errors }

  const missing = missingRequiredHeaders(split.headerIndex, REQUIRED_HEADERS)
  if (missing.length) {
    return {
      rows: [],
      errors: [
        {
          row: 1,
          message: `Bolt Historia przejazdów CSV missing required columns: ${missing.join(', ')}`,
        },
      ],
    }
  }

  const dataLines = split.lines.slice(1)
  if (dataLines.length > PLATFORM_TRIP_CSV_MAX_ROWS) {
    return {
      rows: [],
      errors: [{ row: 0, message: `Too many rows (max ${PLATFORM_TRIP_CSV_MAX_ROWS}).` }],
    }
  }

  const startedAtPos = findHeaderPosition(split.headerIndex, ['Data'])
  const endedAtPos = findHeaderPosition(split.headerIndex, ['Stawka sfinalizowana'])
  const driverIdPos = findHeaderPosition(split.headerIndex, [
    'Indywidualny numer identyfikacyjny',
  ])
  const revenuePos = findHeaderPosition(split.headerIndex, [
    'Cena przejazdu|ZŁ',
    'Cena przejazdu|ZL',
  ])
  const statusPos = findHeaderPosition(split.headerIndex, ['Status'])
  const distancePos = findHeaderPosition(split.headerIndex, ['Odległość|km', 'Odleglosc|km'])
  const paymentPos = findHeaderPosition(split.headerIndex, ['Rodzaj płatności', 'Rodzaj platnosci'])
  const platePos = findHeaderPosition(split.headerIndex, [
    'Numer rejestracyjny ',
    'Numer rejestracyjny',
  ])
  const routePos = findHeaderPosition(split.headerIndex, ['Trasa'])

  const rows: PlatformTripCsvParseResult['rows'] = []
  const errors: PlatformTripCsvRowError[] = []

  dataLines.forEach((line, offset) => {
    const rowNumber = offset + 2
    const cells = parseCsvLine(line, split.delimiter)
    const statusRaw = readCellAt(cells, statusPos)
    if (!isCompletedStatus(statusRaw)) return

    const platformDriverId = readCellAt(cells, driverIdPos)
    const startedAtRaw = readCellAt(cells, startedAtPos)
    const revenueRaw = readCellAt(cells, revenuePos)
    const route = readCellAt(cells, routePos)

    if (!platformDriverId || !startedAtRaw || !revenueRaw) {
      errors.push({
        row: rowNumber,
        message: 'Missing required Bolt Historia field values (driver id, date, or price).',
      })
      return
    }

    const startedAt = parseCsvDateValue(startedAtRaw)
    if (!startedAt) {
      errors.push({ row: rowNumber, message: 'Invalid Data (startedAt) date.' })
      return
    }

    const revenueAmount = parseCsvDecimal(revenueRaw)
    if (revenueAmount == null) {
      errors.push({ row: rowNumber, message: 'Invalid Cena przejazdu amount.' })
      return
    }

    const endedAtRaw = readCellAt(cells, endedAtPos)
    const endedAt = endedAtRaw ? parseCsvDateValue(endedAtRaw) : null
    if (endedAtRaw && !endedAt) {
      errors.push({ row: rowNumber, message: 'Invalid Stawka sfinalizowana (endedAt) date.' })
      return
    }

    const distanceRaw = readCellAt(cells, distancePos)
    const distanceKm = distanceRaw ? parseCsvDecimal(distanceRaw) : null
    if (distanceRaw && distanceKm == null) {
      errors.push({ row: rowNumber, message: 'Invalid Odległość|km value.' })
      return
    }

    const { fromAddress, toAddress } = splitRoute(route)
    const vehiclePlate = readCellAt(cells, platePos) || null
    const paymentRaw = readCellAt(cells, paymentPos)

    rows.push({
      ingestSource: params.ingestSource,
      platform: 'bolt',
      externalTripId: buildBoltCsvExternalTripId({
        driverUuid: platformDriverId,
        startedAtRaw,
        route,
        revenueRaw,
        statusRaw,
      }),
      platformDriverId,
      status: 'completed',
      startedAt,
      endedAt,
      distanceKm,
      revenueAmount,
      currencyCode: 'PLN',
      paymentType: mapBoltPaymentType(paymentRaw),
      rawExternalStatus: statusRaw || null,
      fromAddress,
      toAddress,
      vehiclePlate,
    })
  })

  return { rows, errors }
}
