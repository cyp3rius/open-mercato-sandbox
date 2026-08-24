import { execFileSync } from 'node:child_process'
import path from 'node:path'
import type { EntityManager } from '@mikro-orm/postgresql'
import { bootstrapFromAppRoot } from '@open-mercato/shared/lib/bootstrap/dynamicLoader'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'

const args = process.argv.slice(2)
const PNG_ONLY = args.includes('--png-only')
const positional = args.filter((arg) => !arg.startsWith('--'))
const TRIP_ID = positional[0] ?? '1f4dfe4e-09fa-4ad8-ab87-93dc0db0b5f4'
const DOCUMENT_NUMBER =
  positional[1] ?? `TEST/${new Date().getFullYear()}/${String(Math.floor(Math.random() * 900000) + 100000)}`

function buildFakeReceiptSvg(params: {
  documentNumber: string
  grossAmount: string
  routeFrom: string
  routeTo: string
  occurredAt: Date
}): Buffer {
  const dateLabel = params.occurredAt.toLocaleDateString('pl-PL')
  const timeLabel = params.occurredAt.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="520" viewBox="0 0 320 520">
  <rect width="320" height="520" fill="#fafafa"/>
  <rect x="16" y="16" width="288" height="488" fill="#fff" stroke="#ccc" stroke-width="2"/>
  <text x="160" y="52" text-anchor="middle" font-family="monospace" font-size="16" font-weight="bold">RS MOTO TAXI</text>
  <text x="160" y="72" text-anchor="middle" font-family="monospace" font-size="11" fill="#666">PARAGON TESTOWY</text>
  <line x1="32" y1="88" x2="288" y2="88" stroke="#ddd"/>
  <text x="32" y="112" font-family="monospace" font-size="12">Data: ${dateLabel} ${timeLabel}</text>
  <text x="32" y="132" font-family="monospace" font-size="12">Nr: ${params.documentNumber}</text>
  <text x="32" y="160" font-family="monospace" font-size="12" font-weight="bold">Trasa:</text>
  <text x="32" y="180" font-family="monospace" font-size="11">${params.routeFrom}</text>
  <text x="32" y="198" font-family="monospace" font-size="11">→ ${params.routeTo}</text>
  <line x1="32" y1="220" x2="288" y2="220" stroke="#ddd"/>
  <text x="32" y="244" font-family="monospace" font-size="12">Usługa transportowa</text>
  <text x="288" y="244" text-anchor="end" font-family="monospace" font-size="12">${params.grossAmount} PLN</text>
  <text x="32" y="268" font-family="monospace" font-size="11" fill="#666">w tym VAT 23%</text>
  <line x1="32" y1="292" x2="288" y2="292" stroke="#ddd"/>
  <text x="32" y="320" font-family="monospace" font-size="14" font-weight="bold">RAZEM</text>
  <text x="288" y="320" text-anchor="end" font-family="monospace" font-size="14" font-weight="bold">${params.grossAmount} PLN</text>
  <text x="32" y="360" font-family="monospace" font-size="10" fill="#666">NIP: 1234567890</text>
  <text x="32" y="378" font-family="monospace" font-size="10" fill="#666">Płatność: gotówka</text>
  <text x="160" y="460" text-anchor="middle" font-family="monospace" font-size="10" fill="#999">*** FAKE / TEST ***</text>
</svg>`
  return Buffer.from(svg, 'utf8')
}

function svgToPng(svgBuffer: Buffer): Buffer {
  return execFileSync('rsvg-convert', ['-f', 'png'], { input: svgBuffer })
}

async function main(): Promise<void> {
  const appRoot = path.resolve(__dirname, '../apps/mercato')
  process.chdir(appRoot)
  await bootstrapFromAppRoot(appRoot)

  const { createStoredAttachment } = await import('@open-mercato/core/modules/attachments/lib/createStoredAttachment')
  const { TaxiFleetTrip } = await import('../apps/mercato/src/modules/taxi_fleet/data/entities')
  const {
    createPendingReceiptExtraction,
    linkReceiptExtractionToTrip,
  } = await import('../apps/mercato/src/modules/taxi_fleet/lib/receiptExtractionPipeline')
  const { TAXI_FLEET_DRIVER_RECEIPTS_PARTITION } = await import(
    '../apps/mercato/src/modules/taxi_fleet/lib/receiptPartition'
  )
  const { TAXI_FLEET_FINANCIAL_ENTRY_ENTITY_ID } = await import(
    '../apps/mercato/src/modules/taxi_fleet/lib/financialEntryEntity'
  )

  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager
  const dataEngine = container.resolve('dataEngine')

  const trip = await em.findOne(TaxiFleetTrip, { id: TRIP_ID, deletedAt: null })
  if (!trip) {
    throw new Error(`Trip not found: ${TRIP_ID}`)
  }

  const metadata = trip.metadata && typeof trip.metadata === 'object' ? trip.metadata : {}
  const tripRequest =
    metadata.tripRequest && typeof metadata.tripRequest === 'object'
      ? (metadata.tripRequest as Record<string, unknown>)
      : {}
  const routeFrom = typeof tripRequest.fromAddress === 'string' ? tripRequest.fromAddress : 'Kraków'
  const routeTo = typeof tripRequest.toAddress === 'string' ? tripRequest.toAddress : 'Zakopane'
  const grossAmount = Number(trip.revenueAmount ?? 175).toFixed(2)
  const occurredAt = trip.startedAt ?? trip.endedAt ?? new Date()

  const receiptSvg = buildFakeReceiptSvg({
    documentNumber: DOCUMENT_NUMBER,
    grossAmount,
    routeFrom,
    routeTo,
    occurredAt,
  })
  const receiptBuffer = svgToPng(receiptSvg)
  const localPngPath = path.resolve(
    __dirname,
    `fake-receipt-${trip.id.slice(0, 8)}.png`,
  )
  await import('node:fs/promises').then((fs) => fs.writeFile(localPngPath, receiptBuffer))

  if (PNG_ONLY) {
    console.log(
      JSON.stringify(
        {
          mode: 'png-only',
          tripId: trip.id,
          documentNumber: DOCUMENT_NUMBER,
          grossAmount,
          routeFrom,
          routeTo,
          occurredAt: occurredAt.toISOString(),
          localPngPath,
        },
        null,
        2,
      ),
    )
    return
  }

  const { item } = await createStoredAttachment({
    em,
    dataEngine,
    auth: { tenantId: trip.tenantId, orgId: trip.organizationId },
    entityId: TAXI_FLEET_FINANCIAL_ENTRY_ENTITY_ID,
    recordId: trip.id,
    buffer: receiptBuffer,
    fileName: `fake-receipt-${trip.id.slice(0, 8)}.png`,
    mimeType: 'image/png',
    tags: ['taxi_fleet', 'driver_receipt', 'fake_test'],
    partitionOverride: TAXI_FLEET_DRIVER_RECEIPTS_PARTITION,
  })

  const extraction = await createPendingReceiptExtraction(em, {
    tenantId: trip.tenantId,
    organizationId: trip.organizationId,
    attachmentId: item.id,
    driverDocumentNumber: DOCUMENT_NUMBER,
    driverAmount: Number(grossAmount),
  })

  const now = new Date()
  extraction.status = 'extracted'
  extraction.ocrDocumentNumber = DOCUMENT_NUMBER
  extraction.ocrGrossAmount = grossAmount
  extraction.ocrVatRatePercent = '23'
  extraction.ocrOccurredAt = occurredAt
  extraction.ocrSellerNip = '1234567890'
  extraction.confidence = '0.990'
  extraction.rawTextExcerpt = `FAKE TEST RECEIPT ${DOCUMENT_NUMBER} ${grossAmount} PLN`
  extraction.model = 'fake/test'
  extraction.processedAt = now
  extraction.updatedAt = now
  await em.flush()

  await linkReceiptExtractionToTrip(em, {
    attachmentId: item.id,
    tenantId: trip.tenantId,
    organizationId: trip.organizationId,
    tripId: trip.id,
    driverDocumentNumber: DOCUMENT_NUMBER,
    tripRevenueAmount: Number(grossAmount),
  })

  await em.refresh(trip)
  await em.refresh(extraction)

  console.log(
    JSON.stringify(
      {
        tripId: trip.id,
        attachmentId: item.id,
        attachmentUrl: item.url,
        extractionId: extraction.id,
        extractionStatus: extraction.status,
        documentNumber: DOCUMENT_NUMBER,
        grossAmount,
        localPngPath,
        receiptAttachmentId:
          trip.metadata && typeof trip.metadata === 'object'
            ? (trip.metadata as Record<string, unknown>).receiptAttachmentId
            : null,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
