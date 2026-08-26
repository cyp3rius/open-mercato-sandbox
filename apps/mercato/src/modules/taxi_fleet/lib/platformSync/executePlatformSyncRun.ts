import type { EntityManager } from '@mikro-orm/postgresql'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetPlatformSyncRun } from '../../data/entities'
import type { PlatformTripUpsertInput } from '../../data/validators'
import { loadTaxiFleetOrganizationSettings } from '../taxiFleetOrganizationSettings'
import type { TaxiFleetTripPlatform } from '../tripPlatforms'
import { resolvePlatformTripAdapter } from './adapters'
import { PlatformTripAdapterError } from './adapters/types'
import {
  parsePlatformTripCsv,
  PLATFORM_TRIP_CSV_CHUNK_SIZE,
} from './parsePlatformTripCsv'
import {
  listEnabledPlatformSyncPlatforms,
} from './platformSyncCredentials'
import {
  recalculateSettlementsAfterPlatformSync,
  type PlatformSyncTouchedTripRef,
} from './recalculateSettlementsAfterPlatformSync'
import { resolvePlatformSyncWindow } from './resolvePlatformSyncWindow'
import type { PlatformTripIngestSource } from './types'

export type PlatformSyncRunResult = {
  runId: string
  status: 'succeeded' | 'failed' | 'partial'
  fetchedCount: number
  upsertedCount: number
  skippedCount: number
  errorCount: number
}

type UpsertBatchStats = {
  fetchedCount: number
  upsertedCount: number
  skippedCount: number
  errorCount: number
  touchedTrips: PlatformSyncTouchedTripRef[]
  rowErrors: Array<{ row?: number; message: string }>
}

export async function findRunningPlatformSyncRun(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string },
): Promise<TaxiFleetPlatformSyncRun | null> {
  return findOneWithDecryption(
    em,
    TaxiFleetPlatformSyncRun,
    {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      status: 'running',
      deletedAt: null,
    },
    undefined,
    { tenantId: scope.tenantId, organizationId: scope.organizationId },
  )
}

export async function assertNoRunningPlatformSync(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string },
  translate: (key: string, fallback: string) => string,
): Promise<void> {
  const running = await findRunningPlatformSyncRun(em, scope)
  if (!running) return
  throw new CrudHttpError(409, {
    error: translate(
      'taxi_fleet.platformSync.runAlreadyInProgress',
      'Platform sync is already running for this organization.',
    ),
    runId: running.id,
  })
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
}): Promise<UpsertBatchStats> {
  const stats: UpsertBatchStats = {
    fetchedCount: params.rows.length,
    upsertedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    touchedTrips: [],
    rowErrors: [],
  }

  for (let index = 0; index < params.rows.length; index += 1) {
    const row = params.rows[index]!
    const rowNumber = (params.rowOffset ?? 0) + index + 2
    try {
      const { result } = await params.commandBus.execute<
        PlatformTripUpsertInput,
        | { tripId: string; created: boolean; skipped: false }
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
        stats.rowErrors.push({
          row: rowNumber,
          message:
            result.skipReason === 'driver_reassignment_conflict'
              ? 'Driver reassignment conflict — trip skipped.'
              : 'Unmapped platform driver ID — set it on the driver profile.',
        })
        continue
      }

      if (result && 'tripId' in result && result.tripId) {
        stats.upsertedCount += 1
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
  skippedCount: number
  errorCount: number
}): PlatformSyncRunResult['status'] {
  if (stats.errorCount > 0 && stats.upsertedCount === 0) return 'failed'
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
  if (params.stats.rowErrors.length) {
    params.run.errorSummary = {
      errors: params.stats.rowErrors.slice(0, 100),
      truncated: params.stats.rowErrors.length > 100,
    }
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
    skippedCount: params.run.skippedCount,
    errorCount: params.run.errorCount,
  })

  return {
    runId: params.run.id,
    status,
    fetchedCount: params.run.fetchedCount,
    upsertedCount: params.run.upsertedCount,
    skippedCount: params.run.skippedCount,
    errorCount: params.run.errorCount,
  }
}

export async function executePlatformTripCsvImport(params: {
  em: EntityManager
  commandBus: CommandBus
  ctx: CommandRuntimeContext
  tenantId: string
  organizationId: string
  platform: TaxiFleetTripPlatform
  csvText: string
}): Promise<PlatformSyncRunResult> {
  const parseResult = parsePlatformTripCsv({
    csvText: params.csvText,
    platform: params.platform,
    ingestSource: 'platform_csv',
  })

  const run = params.em.create(TaxiFleetPlatformSyncRun, {
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    platform: params.platform,
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
  await params.em.persistAndFlush(run)

  const aggregate: UpsertBatchStats = {
    fetchedCount: parseResult.rows.length,
    upsertedCount: 0,
    skippedCount: 0,
    errorCount: parseResult.errors.length,
    touchedTrips: [],
    rowErrors: [...parseResult.errors],
  }

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

  for (let offset = 0; offset < parseResult.rows.length; offset += PLATFORM_TRIP_CSV_CHUNK_SIZE) {
    const chunk = parseResult.rows.slice(offset, offset + PLATFORM_TRIP_CSV_CHUNK_SIZE)
    const batchStats = await upsertPlatformTripBatch({
      em: params.em,
      commandBus: params.commandBus,
      ctx: params.ctx,
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      rows: chunk,
      ingestSource: 'platform_csv',
      rowOffset: offset,
    })
    aggregate.upsertedCount += batchStats.upsertedCount
    aggregate.skippedCount += batchStats.skippedCount
    aggregate.errorCount += batchStats.errorCount
    aggregate.touchedTrips.push(...batchStats.touchedTrips)
    aggregate.rowErrors.push(...batchStats.rowErrors)
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

  const window = resolvePlatformSyncWindow({
    windowFrom: params.windowFrom ?? null,
    windowTo: params.windowTo ?? null,
  })
  const platformLabel: TaxiFleetPlatformSyncRun['platform'] =
    enabledPlatforms.length === 1 ? enabledPlatforms[0]! : 'all'

  const run = params.em.create(TaxiFleetPlatformSyncRun, {
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
    skippedCount: 0,
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
        window,
      })
      aggregate.fetchedCount += fetchResult.trips.length
      aggregate.errorCount += fetchResult.errors.length
      aggregate.rowErrors.push(...fetchResult.errors)

      for (let offset = 0; offset < fetchResult.trips.length; offset += PLATFORM_TRIP_CSV_CHUNK_SIZE) {
        const chunk = fetchResult.trips.slice(offset, offset + PLATFORM_TRIP_CSV_CHUNK_SIZE)
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
        aggregate.skippedCount += batchStats.skippedCount
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
    skippedCount: row.skippedCount,
    errorCount: row.errorCount,
    windowFrom: row.windowFrom ? row.windowFrom.toISOString() : null,
    windowTo: row.windowTo ? row.windowTo.toISOString() : null,
    errorSummary: row.errorSummary ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
