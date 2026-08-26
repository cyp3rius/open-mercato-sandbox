import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { parseScopedCommandInput } from '@open-mercato/shared/lib/api/scoped'
import { platformTripImportCsvSchema } from '@/modules/taxi_fleet/data/validators'
import { PLATFORM_TRIP_CSV_MAX_BYTES } from '@/modules/taxi_fleet/lib/platformSync/parsePlatformTripCsv'
import { normalizeTripPlatform } from '@/modules/taxi_fleet/lib/tripPlatforms'
import type { PlatformSyncRunResult } from '@/modules/taxi_fleet/lib/platformSync/executePlatformSyncRun'

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

    const file = form.get('file')
    if (!(file instanceof File)) {
      throw new CrudHttpError(400, {
        error: translate('taxi_fleet.platformSync.import.fileRequired', 'CSV file is required.'),
      })
    }

    const mime = (file.type || 'application/octet-stream').toLowerCase()
    if (!allowedMimePrefixes.some((prefix) => mime.startsWith(prefix) || mime.includes(prefix))) {
      throw new CrudHttpError(400, {
        error: translate('taxi_fleet.platformSync.import.invalidFileType', 'Upload a CSV or plain-text file.'),
      })
    }

    if (file.size > PLATFORM_TRIP_CSV_MAX_BYTES) {
      throw new CrudHttpError(400, {
        error: translate(
          'taxi_fleet.platformSync.import.fileTooLarge',
          'CSV file exceeds the 5 MiB limit.',
        ),
      })
    }

    const csvText = await file.text()
    const tenantId = context.auth?.tenantId
    const organizationId = context.selectedOrganizationId ?? context.auth?.orgId
    if (!tenantId || !organizationId) throw new CrudHttpError(401, { error: 'Unauthorized' })

    const parsed = parseScopedCommandInput(
      platformTripImportCsvSchema,
      { platform, csvText, tenantId, organizationId },
      context,
      translate,
    )
    const commandBus = context.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute<typeof parsed, PlatformSyncRunResult>(
      'taxi_fleet.platform_trip.import_csv',
      { input: parsed, ctx: context },
    )
    return NextResponse.json(result ?? null, { status: 201 })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('taxi_fleet.platform_sync.import_csv failed', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('taxi_fleet.errors.generic', 'Operation failed.') }, { status: 500 })
  }
}

const responseSchema = z.object({
  runId: z.string().uuid(),
  status: z.enum(['succeeded', 'failed', 'partial']),
  fetchedCount: z.number().int(),
  upsertedCount: z.number().int(),
  skippedCount: z.number().int(),
  errorCount: z.number().int(),
})

export const openApi = {
  POST: {
    summary: 'Import platform trips from CSV',
    tags: ['Taxi fleet platform sync'],
    responses: { 201: { schema: responseSchema } },
  },
}
