import { NextResponse } from 'next/server'
import type { EntityManager } from '@mikro-orm/postgresql'
import {
  createStoredAttachment,
  CreateStoredAttachmentError,
} from '@open-mercato/core/modules/attachments/lib/createStoredAttachment'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import { TaxiFleetTrip } from '@/modules/taxi_fleet/data/entities'
import {
  createPendingReceiptExtraction,
  linkReceiptExtractionToTrip,
  scheduleReceiptExtractionProcessing,
} from '@/modules/taxi_fleet/lib/receiptExtractionPipeline'
import { TAXI_FLEET_DRIVER_RECEIPTS_PARTITION } from '@/modules/taxi_fleet/lib/receiptPartition'
import { TAXI_FLEET_FINANCIAL_ENTRY_ENTITY_ID } from '@/modules/taxi_fleet/lib/financialEntryEntity'
import {
  isCompletedTripStatus,
  tripDetailLockMode,
} from '@/modules/taxi_fleet/lib/tripDetailWorkflow'
import { normalizeTripStatus } from '@/modules/taxi_fleet/lib/tripStatuses'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['taxi_fleet.manage_trips'] },
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

async function actorMayEditCompletedTrip(ctx: CommandRuntimeContext): Promise<boolean> {
  const userId = ctx.auth?.sub
  if (!userId) return false
  try {
    const rbac = ctx.container.resolve('rbacService') as {
      userHasAllFeatures: (
        userId: string,
        required: string[],
        scope: { tenantId: string | null; organizationId: string | null },
      ) => Promise<boolean>
    }
    return await rbac.userHasAllFeatures(
      userId,
      ['taxi_fleet.trips.edit_completed'],
      { tenantId: ctx.auth?.tenantId ?? null, organizationId: ctx.auth?.orgId ?? null },
    )
  } catch {
    return false
  }
}

export async function POST(req: Request, routeCtx: { params?: { id?: string } }) {
  try {
    const context = await buildContext(req)
    const { translate } = await resolveTranslations()
    const tripId = routeCtx.params?.id
    if (!tripId) throw new CrudHttpError(400, { error: 'Missing trip id' })

    const contentType = req.headers.get('content-type') || ''
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      throw new CrudHttpError(400, { error: 'Expected multipart/form-data' })
    }

    const em = context.container.resolve('em') as EntityManager
    const trip = await em.findOne(TaxiFleetTrip, { id: tripId, deletedAt: null })
    if (!trip) throw new CrudHttpError(404, { error: 'Not found' })

    const allowEditCompleted = await actorMayEditCompletedTrip(context)
    const lockMode = tripDetailLockMode(trip.status, { allowEditCompleted })
    if (lockMode === 'full') {
      throw new CrudHttpError(409, {
        error: translate(
          'taxi_fleet.trips.errors.locked',
          'This trip is completed or cancelled and cannot be edited.',
        ),
      })
    }
    if (isCompletedTripStatus(trip.status) && !allowEditCompleted) {
      throw new CrudHttpError(403, {
        error: translate(
          'taxi_fleet.trips.errors.editCompletedRequired',
          'Editing a completed trip requires the edit-completed permission.',
        ),
      })
    }

    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) {
      throw new CrudHttpError(400, {
        error: translate('taxi_fleet.receiptOcr.fileRequired', 'Receipt file is required.'),
      })
    }
    const mime = (file as { type?: string }).type || 'application/octet-stream'
    if (!mime.startsWith('image/') && mime !== 'application/pdf') {
      throw new CrudHttpError(400, {
        error: translate(
          'taxi_fleet.driverApp.receipt.invalidFile',
          'Only image or PDF receipts are allowed.',
        ),
      })
    }

    const tenantId = trip.tenantId
    const orgId = trip.organizationId
    const dataEngine = context.container.resolve('dataEngine') as DataEngine | undefined
    const buf = Buffer.from(await file.arrayBuffer())
    const safeName = String(file.name || 'receipt.jpg').replace(/[^a-zA-Z0-9._-]/g, '_')

    const { ensureTaxiFleetDriverReceiptsPartition } = await import(
      '@/modules/taxi_fleet/lib/receiptPartition'
    )
    await ensureTaxiFleetDriverReceiptsPartition(em)

    const { item } = await createStoredAttachment({
      em,
      dataEngine,
      auth: { tenantId, orgId },
      entityId: TAXI_FLEET_FINANCIAL_ENTRY_ENTITY_ID,
      recordId: trip.id,
      buffer: buf,
      fileName: safeName,
      mimeType: mime,
      tags: ['taxi_fleet', 'trip_receipt', 'operator_reupload'],
      partitionOverride: TAXI_FLEET_DRIVER_RECEIPTS_PARTITION,
    })

    const extraction = await createPendingReceiptExtraction(em, {
      tenantId,
      organizationId: orgId,
      attachmentId: item.id,
    })

    const existingMeta =
      trip.metadata && typeof trip.metadata === 'object'
        ? { ...(trip.metadata as Record<string, unknown>) }
        : {}
    trip.metadata = {
      ...existingMeta,
      receiptAttachmentId: item.id,
    }
    trip.updatedAt = new Date()
    await em.flush()

    await linkReceiptExtractionToTrip(em, {
      attachmentId: item.id,
      tenantId,
      organizationId: orgId,
      tripId: trip.id,
      tripRevenueAmount: trip.revenueAmount != null ? Number(trip.revenueAmount) : null,
    })
    scheduleReceiptExtractionProcessing(em, extraction.id)

    return NextResponse.json(
      {
        attachmentId: item.id,
        extractionId: extraction.id,
        status: normalizeTripStatus(trip.status),
      },
      { status: 201 },
    )
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    if (err instanceof CreateStoredAttachmentError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    console.error('taxi_fleet.trips.receipt.upload failed', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const openApi = {
  POST: {
    summary: 'Upload or replace receipt for a trip (CRM); triggers OCR',
    tags: ['Taxi fleet'],
  },
}
