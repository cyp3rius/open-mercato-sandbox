import type { PlatformTripUpsertInput } from '../../data/validators'
import type { TaxiFleetTripPlatform } from '../tripPlatforms'
import type { PlatformTripIngestSource } from './types'

export const PLATFORM_TRIP_CSV_MAX_BYTES = 5 * 1024 * 1024
export const PLATFORM_TRIP_CSV_MAX_ROWS = 5_000
export const PLATFORM_TRIP_CSV_CHUNK_SIZE = 100

const REQUIRED_HEADERS = ['externalTripId', 'platformDriverId', 'startedAt', 'revenueAmount'] as const

const OPTIONAL_HEADERS = [
  'status',
  'endedAt',
  'distanceKm',
  'paymentType',
  'currencyCode',
  'platform',
] as const

export type PlatformTripCsvRowError = {
  row: number
  message: string
}

export type PlatformTripCsvParseResult = {
  rows: Array<Omit<PlatformTripUpsertInput, 'tenantId' | 'organizationId'>>
  errors: PlatformTripCsvRowError[]
}

function normalizeHeader(value: string): string {
  return value.trim().replace(/^\uFEFF/, '')
}

function detectDelimiter(headerLine: string): ',' | ';' {
  const commaCount = (headerLine.match(/,/g) ?? []).length
  const semicolonCount = (headerLine.match(/;/g) ?? []).length
  return semicolonCount > commaCount ? ';' : ','
}

function parseCsvLine(line: string, delimiter: ',' | ';'): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (char === delimiter && !inQuotes) {
      cells.push(current)
      current = ''
      continue
    }
    current += char
  }
  cells.push(current)
  return cells.map((cell) => cell.trim())
}

function parseDecimal(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.')
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function parseDateValue(value: string): Date | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const isoCandidate = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T')
  const parsed = new Date(isoCandidate)
  if (!Number.isNaN(parsed.getTime())) return parsed
  return null
}

function parseStatus(value: string | undefined): PlatformTripUpsertInput['status'] {
  const normalized = (value ?? 'completed').trim().toLowerCase()
  if (normalized === 'cancelled' || normalized === 'canceled') return 'cancelled'
  if (normalized === 'paid') return 'paid'
  return 'completed'
}

function parsePaymentType(value: string | undefined): PlatformTripUpsertInput['paymentType'] {
  const normalized = (value ?? 'electronic').trim().toLowerCase()
  if (normalized === 'cash') return 'cash'
  if (normalized === 'card') return 'card'
  if (normalized === 'electronic') return 'electronic'
  if (normalized === 'transfer') return 'transfer'
  if (normalized === 'other') return 'other'
  return 'electronic'
}

function buildHeaderIndex(headers: string[]): Map<string, number> {
  const index = new Map<string, number>()
  headers.forEach((header, position) => {
    const normalized = normalizeHeader(header)
    if (normalized) index.set(normalized, position)
  })
  return index
}

export function parsePlatformTripCsv(params: {
  csvText: string
  platform: TaxiFleetTripPlatform
  ingestSource: PlatformTripIngestSource
}): PlatformTripCsvParseResult {
  const trimmed = params.csvText.trim()
  if (!trimmed) {
    return {
      rows: [],
      errors: [{ row: 0, message: 'CSV file is empty.' }],
    }
  }

  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (!lines.length) {
    return {
      rows: [],
      errors: [{ row: 0, message: 'CSV file is empty.' }],
    }
  }

  const delimiter = detectDelimiter(lines[0]!)
  const headerCells = parseCsvLine(lines[0]!, delimiter).map(normalizeHeader)
  const headerIndex = buildHeaderIndex(headerCells)

  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headerIndex.has(header))
  if (missingHeaders.length) {
    return {
      rows: [],
      errors: [
        {
          row: 1,
          message: `Missing required columns: ${missingHeaders.join(', ')}`,
        },
      ],
    }
  }

  const dataLines = lines.slice(1)
  if (dataLines.length > PLATFORM_TRIP_CSV_MAX_ROWS) {
    return {
      rows: [],
      errors: [
        {
          row: 0,
          message: `Too many rows (max ${PLATFORM_TRIP_CSV_MAX_ROWS}).`,
        },
      ],
    }
  }

  const rows: PlatformTripCsvParseResult['rows'] = []
  const errors: PlatformTripCsvRowError[] = []

  dataLines.forEach((line, offset) => {
    const rowNumber = offset + 2
    const cells = parseCsvLine(line, delimiter)
    const readCell = (header: string): string => {
      const position = headerIndex.get(header)
      if (position == null) return ''
      return cells[position] ?? ''
    }

    const externalTripId = readCell('externalTripId').trim()
    const platformDriverId = readCell('platformDriverId').trim()
    const startedAtRaw = readCell('startedAt').trim()
    const revenueRaw = readCell('revenueAmount').trim()

    if (!externalTripId || !platformDriverId || !startedAtRaw || !revenueRaw) {
      errors.push({ row: rowNumber, message: 'Missing required field values.' })
      return
    }

    const rowPlatformRaw = readCell('platform').trim().toLowerCase()
    if (rowPlatformRaw && rowPlatformRaw !== params.platform) {
      errors.push({
        row: rowNumber,
        message: `Platform column must match import platform (${params.platform}).`,
      })
      return
    }

    const startedAt = parseDateValue(startedAtRaw)
    if (!startedAt) {
      errors.push({ row: rowNumber, message: 'Invalid startedAt date.' })
      return
    }

    const revenueAmount = parseDecimal(revenueRaw)
    if (revenueAmount == null) {
      errors.push({ row: rowNumber, message: 'Invalid revenueAmount.' })
      return
    }

    const endedAtRaw = readCell('endedAt').trim()
    const endedAt = endedAtRaw ? parseDateValue(endedAtRaw) : null
    if (endedAtRaw && !endedAt) {
      errors.push({ row: rowNumber, message: 'Invalid endedAt date.' })
      return
    }

    const distanceRaw = readCell('distanceKm').trim()
    const distanceKm = distanceRaw ? parseDecimal(distanceRaw) : null
    if (distanceRaw && distanceKm == null) {
      errors.push({ row: rowNumber, message: 'Invalid distanceKm.' })
      return
    }

    const currencyRaw = readCell('currencyCode').trim()
    rows.push({
      ingestSource: params.ingestSource,
      platform: params.platform,
      externalTripId,
      platformDriverId,
      status: parseStatus(readCell('status')),
      startedAt,
      endedAt,
      distanceKm,
      revenueAmount,
      currencyCode: currencyRaw ? currencyRaw.toUpperCase() : 'PLN',
      paymentType: parsePaymentType(readCell('paymentType')),
      rawExternalStatus: readCell('status').trim() || null,
    })
  })

  return { rows, errors }
}

export const PLATFORM_TRIP_CSV_HEADERS = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS]
