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
import { resolveDriverContext } from '@/modules/taxi_fleet/lib/driverContext'
import { TAXI_FLEET_FINANCIAL_ENTRY_ENTITY_ID } from '@/modules/taxi_fleet/lib/financialEntryEntity'
import {
  createPendingReceiptExtraction,
  scheduleReceiptExtractionProcessing,
} from '@/modules/taxi_fleet/lib/receiptExtractionPipeline'
import { TAXI_FLEET_DRIVER_RECEIPTS_PARTITION } from '@/modules/taxi_fleet/lib/receiptPartition'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['taxi_fleet.driver'] },
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

export async function POST(req: Request) {
  try {
    const context = await buildContext(req)
    const { translate } = await resolveTranslations()
    await resolveDriverContext(context, translate, { requireExternalApp: true })

    const auth = context.auth
    const tenantId = auth?.tenantId
    const orgId = auth?.orgId
    if (!tenantId || !orgId) throw new CrudHttpError(401, { error: 'Unauthorized' })

    const contentType = req.headers.get('content-type') || ''
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      throw new CrudHttpError(400, { error: 'Expected multipart/form-data' })
    }

    const form = await req.formData()
    const recordId = String(form.get('recordId') || '').trim()
    const file = form.get('file') as File | null
    if (!recordId || !file) {
      throw new CrudHttpError(400, {
        error: translate('taxi_fleet.driverApp.receipt.fileRequired', 'Receipt photo is required.'),
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

    const em = context.container.resolve('em') as EntityManager
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
      recordId,
      buffer: buf,
      fileName: safeName,
      mimeType: mime,
      tags: ['taxi_fleet', 'driver_receipt'],
      partitionOverride: TAXI_FLEET_DRIVER_RECEIPTS_PARTITION,
    })

    const extraction = await createPendingReceiptExtraction(em, {
      tenantId,
      organizationId: orgId,
      attachmentId: item.id,
    })
    scheduleReceiptExtractionProcessing(em, extraction.id)
    console.info('[taxi_fleet.driver.attachments] upload accepted', {
      attachmentId: item.id,
      extractionId: extraction.id,
      recordId,
    })

    return NextResponse.json(
      {
        id: item.id,
        fileName: item.fileName,
        url: item.url,
        extractionId: extraction.id,
      },
      { status: 201 },
    )
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    if (err instanceof CreateStoredAttachmentError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    console.error('taxi_fleet.driver.attachments.upload failed', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const openApi = {
  POST: {
    summary: 'Upload receipt photo for driver trip form',
    tags: ['Taxi fleet driver'],
  },
}
