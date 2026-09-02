import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { PLATFORM_TRIP_CSV_MAX_BYTES } from '@/modules/taxi_fleet/lib/platformSync/parsePlatformTripCsv'
import { normalizeTripPlatform } from '@/modules/taxi_fleet/lib/tripPlatforms'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import {
  createQueuedPlatformCsvImportRun,
  executePlatformTripCsvImport,
  reclaimStalePlatformSyncRuns,
} from '@/modules/taxi_fleet/lib/platformSync/executePlatformSyncRun'
import { enqueuePlatformSyncJob, isAsyncPlatformSyncQueue } from '@/modules/taxi_fleet/lib/platformSync/queue'
import { uberFleetCsvFilenameRangesMatch } from '@/modules/taxi_fleet/lib/platformSync/uberFleetCsvFilename'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['taxi_fleet.manage_platform_sync'] },
}

async function buildContext(req: Request): Promise<CommandRuntimeContext> {
  const container = await createRequestContainer()
  const auth = await getAuthFromRequest(req)
  if (!auth) throw new CrudHttpError(401, { error: 'Unauthorized' })
  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  return {
    container,
    auth,
    organizationScope: scope,
    selectedOrganizationId: scope?.selectedId ?? auth.orgId ?? null,
    organizationIds: scope?.filterIds ?? (auth.orgId ? [auth.orgId] : null),
    request: req,
  }
}

const allowedMimePrefixes = ['text/csv', 'text/plain', 'application/vnd.ms-excel', 'application/octet-stream']

function assertCsvUpload(
  value: FormDataEntryValue | null,
  translate: (key: string, fallback: string) => string,
): File {
  if (!(value instanceof File)) {
    throw new CrudHttpError(400, {
      error: translate('taxi_fleet.platformSync.import.fileRequired', 'CSV file is required.'),
    })
  }
  const mime = (value.type || 'application/octet-stream').toLowerCase()
  if (!allowedMimePrefixes.some((prefix) => mime.startsWith(prefix) || mime.includes(prefix))) {
    throw new CrudHttpError(400, {
      error: translate('taxi_fleet.platformSync.import.invalidFileType', 'Upload a CSV or plain-text file.'),
    })
  }
  if (value.size > PLATFORM_TRIP_CSV_MAX_BYTES) {
    throw new CrudHttpError(400, {
      error: translate(
        'taxi_fleet.platformSync.import.fileTooLarge',
        'CSV file exceeds the 5 MiB limit.',
      ),
    })
  }
  return value
}

export async function POST(req: Request) {
  try {
    const context = await buildContext(req)
    const { translate } = await resolveTranslations()
    const contentType = req.headers.get('content-type') || ''
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      throw new CrudHttpError(400, {
        error: translate('taxi_fleet.platformSync.import.expectedMultipart', 'Expected multipart/form-data.'),
      })
    }

    const form = await req.formData()
    const platformRaw = String(form.get('platform') || '').trim()
    const platform = normalizeTripPlatform(platformRaw)
    if (!platform) {
      throw new CrudHttpError(400, {
        error: translate('taxi_fleet.platformSync.import.platformRequired', 'Platform is required.'),
      })
    }

    const tenantId = context.auth?.tenantId
    const organizationId = context.selectedOrganizationId ?? context.auth?.orgId
    if (!tenantId || !organizationId) throw new CrudHttpError(401, { error: 'Unauthorized' })

    const em = (context.container.resolve('em') as EntityManager).fork()
    await reclaimStalePlatformSyncRuns(em, { tenantId, organizationId })

    let csvText: string | undefined
    let tripActivityCsvText: string | undefined
    let paymentsCsvText: string | undefined

    if (platform === 'uber') {
      const tripActivityFile = assertCsvUpload(form.get('tripActivityFile'), translate)
      const paymentsFile = assertCsvUpload(form.get('paymentsFile'), translate)
      const rangeCheck = uberFleetCsvFilenameRangesMatch(tripActivityFile.name, paymentsFile.name)
      if (!rangeCheck.ok) {
        throw new CrudHttpError(400, {
          error: translate(
            'taxi_fleet.platformSync.import.dateRangeMismatch',
            'Trip Activity and Payments files cover different date ranges ({left} vs {right}). Export both for the same period.',
            {
              left: `${rangeCheck.left.from}-${rangeCheck.left.to}`,
              right: `${rangeCheck.right.from}-${rangeCheck.right.to}`,
            },
          ),
        })
      }
      tripActivityCsvText = await tripActivityFile.text()
      paymentsCsvText = await paymentsFile.text()
    } else {
      const file = assertCsvUpload(form.get('file'), translate)
      csvText = await file.text()
    }

    const run = await createQueuedPlatformCsvImportRun({
      em,
      tenantId,
      organizationId,
      platform,
      csvText,
      tripActivityCsvText,
      paymentsCsvText,
    })

    if (isAsyncPlatformSyncQueue()) {
      await enqueuePlatformSyncJob({
        tenantId,
        organizationId,
        runId: run.id,
        kind: 'csv_import',
      })

      return NextResponse.json(
        {
          runId: run.id,
          status: 'queued' as const,
          platform: run.platform,
        },
        { status: 202 },
      )
    }

    const commandBus = context.container.resolve('commandBus') as CommandBus
    const result = await executePlatformTripCsvImport({
      em,
      commandBus,
      ctx: context,
      tenantId,
      organizationId,
      platform,
      csvText,
      tripActivityCsvText,
      paymentsCsvText,
      existingRun: run,
    })

    return NextResponse.json(
      {
        runId: result.runId,
        status: result.status,
        platform: run.platform,
        fetchedCount: result.fetchedCount,
        upsertedCount: result.upsertedCount,
        createdCount: result.createdCount,
        duplicateCount: result.duplicateCount,
        skippedCount: result.skippedCount,
        unmappedDriverSkippedCount: result.unmappedDriverSkippedCount,
        errorCount: result.errorCount,
      },
      { status: 201 },
    )
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('taxi_fleet.platform_sync.import_csv failed', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('taxi_fleet.errors.generic', 'Operation failed.') }, { status: 500 })
  }
}

const queuedResponseSchema = z.object({
  runId: z.string().uuid(),
  status: z.literal('queued'),
  platform: z.string(),
})

const completedResponseSchema = queuedResponseSchema.extend({
  status: z.enum(['succeeded', 'failed', 'partial']),
  fetchedCount: z.number().int(),
  upsertedCount: z.number().int(),
  createdCount: z.number().int(),
  duplicateCount: z.number().int(),
  skippedCount: z.number().int(),
  unmappedDriverSkippedCount: z.number().int(),
  errorCount: z.number().int(),
})

export const openApi = {
  POST: {
    summary: 'Queue platform trips CSV import',
    tags: ['Taxi fleet platform sync'],
    responses: {
      202: { schema: queuedResponseSchema, description: 'Queued (async Redis queue)' },
      201: { schema: completedResponseSchema, description: 'Completed inline (local queue)' },
    },
  },
}
