import type { EntityManager } from '@mikro-orm/postgresql'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import type { TaxiFleetPlatformSyncRun } from '../../data/entities'
import { resolveTaxiFleetPlatformSyncRunEntity } from '../resolveTaxiFleetOrmEntity'
import type { PlatformTripUpsertInput } from '../../data/validators'
import { loadTaxiFleetOrganizationSettings } from '../taxiFleetOrganizationSettings'
import type { TaxiFleetTripPlatform } from '../tripPlatforms'
import { resolvePlatformTripAdapter } from './adapters'
import { PlatformTripAdapterError } from './adapters/types'
import {
  parsePlatformTripCsv,
  PLATFORM_TRIP_CSV_CHUNK_SIZE,
} from './parsePlatformTripCsv'
import { parseUberFleetCsv } from './parseUberFleetCsv'
import { parseBoltTripHistoryCsv } from './parseBoltTripHistoryCsv'
import {
  listEnabledPlatformSyncPlatforms,
} from './platformSyncCredentials'
import {
  recalculateSettlementsAfterPlatformSync,
  type PlatformSyncTouchedTripRef,
} from './recalculateSettlementsAfterPlatformSync'
import {
  resolveManualPlatformSyncWindow,
  resolvePlatformSyncWindow,
  resolveScheduledPlatformSyncWindow,
} from './resolvePlatformSyncWindow'
import {
  filterPlatformTripRowsForKnownDrivers,
  loadKnownPlatformDriverIds,
} from './resolvePlatformDriver'
import type { PlatformTripIngestSource } from './types'

function platformSyncRunEntity(): typeof TaxiFleetPlatformSyncRun {
  return resolveTaxiFleetPlatformSyncRunEntity()
}

export type PlatformSyncRunResult = {
  runId: string
  status: 'succeeded' | 'failed' | 'partial'
  fetchedCount: number
  /** Newly created trips (CSV) or created+updated (live sync). */
  upsertedCount: number
  /** Newly created trips only (CSV import). */
  createdCount: number
  /** Existing platform trip IDs left unchanged (CSV import). */
  duplicateCount: number
  skippedCount: number
  unmappedDriverSkippedCount: number
  errorCount: number
}

type UpsertBatchStats = {
  fetchedCount: number
  upsertedCount: number
  createdCount: number
  duplicateCount: number
  skippedCount: number
  unmappedDriverSkippedCount: number
  errorCount: number
  touchedTrips: PlatformSyncTouchedTripRef[]
  rowErrors: Array<{ row?: number; message: string }>
}

export async function findRunningPlatformSyncRun(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string },
  options?: { includeQueued?: boolean },
): Promise<TaxiFleetPlatformSyncRun | null> {
  const statuses: Array<'queued' | 'running'> =
    options?.includeQueued === false ? ['running'] : ['queued', 'running']
  return findOneWithDecryption(
    em,
    platformSyncRunEntity(),
    {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      status: { $in: statuses },
      deletedAt: null,
    },
    undefined,
    { tenantId: scope.tenantId, organizationId: scope.organizationId },
  )
}

const QUEUED_STALE_MS = 5 * 60 * 1000
const RUNNING_STALE_MS = 2 * 60 * 60 * 1000

export async function reclaimStalePlatformSyncRuns(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string },
): Promise<number> {
  const now = Date.now()
  const rows = await em.find(platformSyncRunEntity(), {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    status: { $in: ['queued', 'running'] },
    deletedAt: null,
  })
  let reclaimed = 0
  for (const row of rows) {
    const referenceTime = row.updatedAt ?? row.startedAt ?? row.createdAt
    const ageMs = now - referenceTime.getTime()
    const wasQueued = row.status === 'queued'
    const stale =
      (wasQueued && ageMs > QUEUED_STALE_MS) || (!wasQueued && ageMs > RUNNING_STALE_MS)
    if (!stale) continue
    row.status = 'failed'
    row.finishedAt = new Date()
    row.errorCount = Math.max(row.errorCount, 1)
    row.errorSummary = {
      errors: [
        {
          message: wasQueued
            ? 'Timed out waiting for the sync worker.'
            : 'Sync timed out.',
        },
      ],
    }
    row.jobPayload = null
    row.updatedAt = new Date()
    reclaimed += 1
  }
  if (reclaimed > 0) await em.flush()
  return reclaimed
}

export async function findLastSuccessfulLivePlatformSyncWindowEnd(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string },
): Promise<Date | null> {
  const run = await em.findOne(
    platformSyncRunEntity(),
    {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      trigger: { $in: ['manual', 'schedule'] },
      status: { $in: ['succeeded', 'partial'] },
      deletedAt: null,
      finishedAt: { $ne: null },
    },
    { orderBy: { finishedAt: 'DESC' } },
  )
  if (!run) return null
  return run.windowTo ?? run.finishedAt ?? null
}

async function upsertPlatformTripBatch(params: {
  em: EntityManager
  commandBus: CommandBus
  ctx: CommandRuntimeContext
  tenantId: string
  organizationId: string
  rows: Array<Omit<PlatformTripUpsertInput, 'tenantId' | 'organizationId'>>
  ingestSource: PlatformTripIngestSource
  rowOffset?: number
  seenExternalTripIds?: Set<string>
}): Promise<UpsertBatchStats> {
  const stats: UpsertBatchStats = {
    fetchedCount: params.rows.length,
    upsertedCount: 0,
    createdCount: 0,
    duplicateCount: 0,
    skippedCount: 0,
    unmappedDriverSkippedCount: 0,
    errorCount: 0,
    touchedTrips: [],
    rowErrors: [],
  }
  const seenExternalTripIds = params.seenExternalTripIds ?? new Set<string>()

  for (let index = 0; index < params.rows.length; index += 1) {
    const row = params.rows[index]!
    const rowNumber = (params.rowOffset ?? 0) + index + 2
    const externalTripId = row.externalTripId.trim()

    if (params.ingestSource === 'platform_csv' && externalTripId) {
      if (seenExternalTripIds.has(externalTripId)) {
        stats.duplicateCount += 1
        continue
      }
      seenExternalTripIds.add(externalTripId)
    }

    try {
      const { result } = await params.commandBus.execute<
        PlatformTripUpsertInput,
        | { tripId: string; created: boolean; skipped: false; duplicate?: boolean }
        | { skipped: true; skipReason: string }
      >('taxi_fleet.platform_trip.upsert', {
        input: {
          ...row,
          tenantId: params.tenantId,
          organizationId: params.organizationId,
          ingestSource: params.ingestSource,
        },
        ctx: params.ctx,
      })

      if (result && 'skipped' in result && result.skipped) {
        stats.skippedCount += 1
        if (result.skipReason === 'unmapped_driver') {
          stats.unmappedDriverSkippedCount += 1
        }
        stats.rowErrors.push({
          row: rowNumber,
          message:
            result.skipReason === 'driver_reassignment_conflict'
              ? 'Driver reassignment conflict — trip skipped.'
              : 'Unmapped platform driver ID — set it on the driver profile.',
        })
        continue
      }

      if (result && 'duplicate' in result && result.duplicate) {
        stats.duplicateCount += 1
        continue
      }

      if (result && 'tripId' in result && result.tripId) {
        stats.upsertedCount += 1
        if (result.created) stats.createdCount += 1
        stats.touchedTrips.push({
          tripId: result.tripId,
          tenantId: params.tenantId,
          organizationId: params.organizationId,
        })
      }
    } catch (error) {
      stats.errorCount += 1
      stats.rowErrors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : 'Upsert failed.',
      })
    }
  }

  return stats
}

function resolveRunStatus(stats: {
  upsertedCount: number
  createdCount: number
  duplicateCount: number
  skippedCount: number
  errorCount: number
}): PlatformSyncRunResult['status'] {
  if (stats.errorCount > 0 && stats.upsertedCount === 0 && stats.createdCount === 0) return 'failed'
  if (stats.errorCount > 0 || stats.skippedCount > 0) return 'partial'
  return 'succeeded'
}

async function finalizePlatformSyncRun(params: {
  em: EntityManager
  run: TaxiFleetPlatformSyncRun
  stats: UpsertBatchStats
  eventBus: { emitEvent: (event: string, data: unknown) => Promise<void> }
}): Promise<PlatformSyncRunResult> {
  const status = resolveRunStatus(params.stats)
  params.run.status = status
  params.run.fetchedCount = params.stats.fetchedCount
  params.run.upsertedCount = params.stats.upsertedCount
  params.run.skippedCount = params.stats.skippedCount
  params.run.errorCount = params.stats.errorCount
  params.run.finishedAt = new Date()
  params.run.updatedAt = new Date()
  params.run.errorSummary = {
    ...(params.stats.rowErrors.length
      ? {
          errors: params.stats.rowErrors.slice(0, 100),
          truncated: params.stats.rowErrors.length > 100,
        }
      : {}),
    createdCount: params.stats.createdCount,
    duplicateCount: params.stats.duplicateCount,
    unmappedDriverSkippedCount: params.stats.unmappedDriverSkippedCount,
  }
  await params.em.flush()

  if (params.stats.touchedTrips.length) {
    await recalculateSettlementsAfterPlatformSync(params.em, params.stats.touchedTrips)
  }

  await params.eventBus.emitEvent('taxi_fleet.platform_sync.completed', {
    id: params.run.id,
    tenantId: params.run.tenantId,
    organizationId: params.run.organizationId,
    platform: params.run.platform,
    trigger: params.run.trigger,
    status: params.run.status,
    fetchedCount: params.run.fetchedCount,
    upsertedCount: params.run.upsertedCount,
    createdCount: params.stats.createdCount,
    duplicateCount: params.stats.duplicateCount,
    skippedCount: params.run.skippedCount,
    unmappedDriverSkippedCount: params.stats.unmappedDriverSkippedCount,
    errorCount: params.run.errorCount,
  })

  return {
    runId: params.run.id,
    status,
    fetchedCount: params.run.fetchedCount,
    upsertedCount: params.run.upsertedCount,
    createdCount: params.stats.createdCount,
    duplicateCount: params.stats.duplicateCount,
    skippedCount: params.run.skippedCount,
    unmappedDriverSkippedCount: params.stats.unmappedDriverSkippedCount,
    errorCount: params.run.errorCount,
  }
}

export type PlatformSyncCsvJobPayload = {
  kind: 'csv_import'
  platform: TaxiFleetTripPlatform
  csvText?: string
  tripActivityCsvText?: string
  paymentsCsvText?: string
}

export async function createQueuedPlatformCsvImportRun(params: {
  em: EntityManager
  tenantId: string
  organizationId: string
  platform: TaxiFleetTripPlatform
  csvText?: string
  tripActivityCsvText?: string
  paymentsCsvText?: string
}): Promise<TaxiFleetPlatformSyncRun> {
  const jobPayload: PlatformSyncCsvJobPayload = {
    kind: 'csv_import',
    platform: params.platform,
    ...(params.csvText != null ? { csvText: params.csvText } : {}),
    ...(params.tripActivityCsvText != null
      ? { tripActivityCsvText: params.tripActivityCsvText }
      : {}),
    ...(params.paymentsCsvText != null ? { paymentsCsvText: params.paymentsCsvText } : {}),
  }
  const run = params.em.create(platformSyncRunEntity(), {
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    platform: params.platform,
    trigger: 'csv',
    status: 'queued',
    startedAt: new Date(),
    fetchedCount: 0,
    upsertedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    jobPayload,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  })
  await params.em.persistAndFlush(run)
  return run
}

export async function executePlatformTripCsvImport(params: {
  em: EntityManager
  commandBus: CommandBus
  ctx: CommandRuntimeContext
  tenantId: string
  organizationId: string
  platform: TaxiFleetTripPlatform
  csvText?: string
  tripActivityCsvText?: string
  paymentsCsvText?: string
  existingRun?: TaxiFleetPlatformSyncRun
}): Promise<PlatformSyncRunResult> {
  const payload = params.existingRun?.jobPayload as PlatformSyncCsvJobPayload | null | undefined
  const platform = params.platform ?? payload?.platform
  if (!platform) {
    throw new CrudHttpError(400, { error: 'CSV import run is missing platform.' })
  }
  const csvText = params.csvText ?? payload?.csvText
  const tripActivityCsvText = params.tripActivityCsvText ?? payload?.tripActivityCsvText
  const paymentsCsvText = params.paymentsCsvText ?? payload?.paymentsCsvText

  const parseResult =
    platform === 'uber'
      ? parseUberFleetCsv({
          tripActivityCsvText: tripActivityCsvText ?? '',
          paymentsCsvText: paymentsCsvText ?? '',
          ingestSource: 'platform_csv',
        })
      : platform === 'bolt'
        ? parseBoltTripHistoryCsv({
            csvText: csvText ?? '',
            ingestSource: 'platform_csv',
          })
        : parsePlatformTripCsv({
            csvText: csvText ?? '',
            platform,
            ingestSource: 'platform_csv',
          })

  const run =
    params.existingRun ??
    params.em.create(platformSyncRunEntity(), {
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      platform,
      trigger: 'csv',
      status: 'running',
      startedAt: new Date(),
      fetchedCount: 0,
      upsertedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    })

  if (params.existingRun) {
    run.status = 'running'
    run.startedAt = new Date()
    run.updatedAt = new Date()
    // Clear CSV body once processing starts so it is not retained in the DB.
    run.jobPayload = null
    await params.em.flush()
  } else {
    await params.em.persistAndFlush(run)
  }

  const knownDriverIds = await loadKnownPlatformDriverIds(params.em, {
    tenantId: params.tenantId,
    organizationId: params.organizationId,
  }, platform)
  const driverFilter = filterPlatformTripRowsForKnownDrivers(parseResult.rows, knownDriverIds)

  const aggregate: UpsertBatchStats = {
    fetchedCount: parseResult.rows.length,
    upsertedCount: 0,
    createdCount: 0,
    duplicateCount: 0,
    skippedCount: driverFilter.skippedCount,
    unmappedDriverSkippedCount: driverFilter.skippedCount,
    errorCount: parseResult.errors.length,
    touchedTrips: [],
    rowErrors: [...parseResult.errors],
  }
  const seenExternalTripIds = new Set<string>()

  if (parseResult.errors.some((error) => error.row <= 1)) {
    run.fetchedCount = 0
    return finalizePlatformSyncRun({
      em: params.em,
      run,
      stats: aggregate,
      eventBus: params.ctx.container.resolve('eventBus') as {
        emitEvent: (event: string, data: unknown) => Promise<void>
      },
    })
  }

  for (let offset = 0; offset < driverFilter.rows.length; offset += PLATFORM_TRIP_CSV_CHUNK_SIZE) {
    const chunk = driverFilter.rows.slice(offset, offset + PLATFORM_TRIP_CSV_CHUNK_SIZE)
    const batchStats = await upsertPlatformTripBatch({
      em: params.em,
      commandBus: params.commandBus,
      ctx: params.ctx,
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      rows: chunk,
      ingestSource: 'platform_csv',
      rowOffset: offset,
      seenExternalTripIds,
    })
    aggregate.upsertedCount += batchStats.upsertedCount
    aggregate.createdCount += batchStats.createdCount
    aggregate.duplicateCount += batchStats.duplicateCount
    aggregate.skippedCount += batchStats.skippedCount
    aggregate.unmappedDriverSkippedCount += batchStats.unmappedDriverSkippedCount
    aggregate.errorCount += batchStats.errorCount
    aggregate.touchedTrips.push(...batchStats.touchedTrips)
    aggregate.rowErrors.push(...batchStats.rowErrors)
  }

  // CSV: upsertedCount mirrors newly created rows for operators/UI.
  aggregate.upsertedCount = aggregate.createdCount

  return finalizePlatformSyncRun({
    em: params.em,
    run,
    stats: aggregate,
    eventBus: params.ctx.container.resolve('eventBus') as {
      emitEvent: (event: string, data: unknown) => Promise<void>
    },
  })
}

function adapterErrorMessage(error: unknown): string {
  if (error instanceof PlatformTripAdapterError) return error.message
  if (error instanceof CrudHttpError) {
    const body = error.body as { error?: string } | undefined
    if (body?.error) return body.error
  }
  if (error instanceof Error && error.message.trim()) return error.message
  return 'Platform adapter request failed.'
}

export async function executeLivePlatformSync(params: {
  em: EntityManager
  commandBus: CommandBus
  ctx: CommandRuntimeContext
  tenantId: string
  organizationId: string
  platforms?: TaxiFleetTripPlatform[]
  windowFrom?: Date | null
  windowTo?: Date | null
  trigger: 'manual' | 'schedule'
  translate?: (key: string, fallback: string) => string
}): Promise<PlatformSyncRunResult> {
  const settings = await loadTaxiFleetOrganizationSettings(params.em, {
    tenantId: params.tenantId,
    organizationId: params.organizationId,
  })
  const enabledPlatforms = listEnabledPlatformSyncPlatforms(settings.platformSync, params.platforms)
  if (params.trigger === 'manual' && enabledPlatforms.length === 0) {
    throw new CrudHttpError(409, {
      error:
        params.translate?.(
          'taxi_fleet.platformSync.noCredentials',
          'No platform sync credentials are configured for the selected platforms.',
        ) ?? 'No platform sync credentials are configured.',
    })
  }

  const window =
    params.windowFrom != null || params.windowTo != null
      ? resolvePlatformSyncWindow({
          windowFrom: params.windowFrom ?? null,
          windowTo: params.windowTo ?? null,
        })
      : params.trigger === 'manual'
        ? resolveManualPlatformSyncWindow()
        : resolveScheduledPlatformSyncWindow(
            await findLastSuccessfulLivePlatformSyncWindowEnd(params.em, {
              tenantId: params.tenantId,
              organizationId: params.organizationId,
            }),
          )
  const platformLabel: TaxiFleetPlatformSyncRun['platform'] =
    enabledPlatforms.length === 1 ? enabledPlatforms[0]! : 'all'

  const run = params.em.create(platformSyncRunEntity(), {
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    platform: platformLabel,
    trigger: params.trigger,
    status: 'running',
    startedAt: new Date(),
    windowFrom: window.windowFrom,
    windowTo: window.windowTo,
    fetchedCount: 0,
    upsertedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  })
  await params.em.persistAndFlush(run)

  const aggregate: UpsertBatchStats = {
    fetchedCount: 0,
    upsertedCount: 0,
    createdCount: 0,
    duplicateCount: 0,
    skippedCount: 0,
    unmappedDriverSkippedCount: 0,
    errorCount: 0,
    touchedTrips: [],
    rowErrors: [],
  }

  for (const platform of enabledPlatforms) {
    try {
      const adapter = resolvePlatformTripAdapter(platform)
      const fetchResult = await adapter.fetchTrips({
        platform,
        credentials: settings.platformSync[platform],
        window: {
          from: window.windowFrom,
          to: window.windowTo,
        },
      })
      aggregate.fetchedCount += fetchResult.trips.length
      aggregate.errorCount += fetchResult.errors.length
      aggregate.rowErrors.push(...fetchResult.errors)

      const knownDriverIds = await loadKnownPlatformDriverIds(params.em, {
        tenantId: params.tenantId,
        organizationId: params.organizationId,
      }, platform)
      const driverFilter = filterPlatformTripRowsForKnownDrivers(fetchResult.trips, knownDriverIds)
      aggregate.skippedCount += driverFilter.skippedCount
      aggregate.unmappedDriverSkippedCount += driverFilter.skippedCount

      for (let offset = 0; offset < driverFilter.rows.length; offset += PLATFORM_TRIP_CSV_CHUNK_SIZE) {
        const chunk = driverFilter.rows.slice(offset, offset + PLATFORM_TRIP_CSV_CHUNK_SIZE)
        const batchStats = await upsertPlatformTripBatch({
          em: params.em,
          commandBus: params.commandBus,
          ctx: params.ctx,
          tenantId: params.tenantId,
          organizationId: params.organizationId,
          rows: chunk,
          ingestSource: 'platform_sync',
          rowOffset: offset,
        })
        aggregate.upsertedCount += batchStats.upsertedCount
        aggregate.createdCount += batchStats.createdCount
        aggregate.duplicateCount += batchStats.duplicateCount
        aggregate.skippedCount += batchStats.skippedCount
        aggregate.unmappedDriverSkippedCount += batchStats.unmappedDriverSkippedCount
        aggregate.errorCount += batchStats.errorCount
        aggregate.touchedTrips.push(...batchStats.touchedTrips)
        aggregate.rowErrors.push(...batchStats.rowErrors)
      }
    } catch (error) {
      aggregate.errorCount += 1
      aggregate.rowErrors.push({ message: `${platform}: ${adapterErrorMessage(error)}` })
    }
  }

  return finalizePlatformSyncRun({
    em: params.em,
    run,
    stats: aggregate,
    eventBus: params.ctx.container.resolve('eventBus') as {
      emitEvent: (event: string, data: unknown) => Promise<void>
    },
  })
}

export async function executeManualPlatformSync(params: {
  em: EntityManager
  commandBus: CommandBus
  ctx: CommandRuntimeContext
  tenantId: string
  organizationId: string
  platforms?: TaxiFleetTripPlatform[]
  windowFrom?: Date | null
  windowTo?: Date | null
  trigger?: 'manual' | 'schedule'
  translate?: (key: string, fallback: string) => string
}): Promise<PlatformSyncRunResult> {
  return executeLivePlatformSync({
    ...params,
    trigger: params.trigger ?? 'manual',
  })
}

export function serializePlatformSyncRun(row: TaxiFleetPlatformSyncRun): Record<string, unknown> {
  return {
    id: row.id,
    tenantId: row.tenantId,
    organizationId: row.organizationId,
    platform: row.platform,
    trigger: row.trigger,
    status: row.status,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
    fetchedCount: row.fetchedCount,
    upsertedCount: row.upsertedCount,
    createdCount:
      row.errorSummary && typeof row.errorSummary === 'object'
        ? Number((row.errorSummary as { createdCount?: unknown }).createdCount) || 0
        : 0,
    duplicateCount:
      row.errorSummary && typeof row.errorSummary === 'object'
        ? Number((row.errorSummary as { duplicateCount?: unknown }).duplicateCount) || 0
        : 0,
    skippedCount: row.skippedCount,
    unmappedDriverSkippedCount:
      row.errorSummary && typeof row.errorSummary === 'object'
        ? Number((row.errorSummary as { unmappedDriverSkippedCount?: unknown }).unmappedDriverSkippedCount) ||
          0
        : 0,
    errorCount: row.errorCount,
    windowFrom: row.windowFrom ? row.windowFrom.toISOString() : null,
    windowTo: row.windowTo ? row.windowTo.toISOString() : null,
    errorSummary: row.errorSummary ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
