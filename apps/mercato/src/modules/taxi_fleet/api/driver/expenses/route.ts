import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import {
  findAndCountWithDecryption,
  findOneWithDecryption,
  findWithDecryption,
} from '@open-mercato/shared/lib/encryption/find'
import {
  TaxiFleetFinancialEntry,
  TaxiFleetReceiptExtraction,
} from '@/modules/taxi_fleet/data/entities'
import { driverExpenseCreateSchema } from '@/modules/taxi_fleet/data/validators'
import { resolveDriverContext } from '@/modules/taxi_fleet/lib/driverContext'
import {
  mapDriverExpenseToCreateInput,
  parseDriverExpenseWarnings,
  resolveDriverExpenseSortField,
  serializeDriverExpense,
} from '@/modules/taxi_fleet/lib/driverExpenses'
import {
  applyReceiptExtractionToLinkedRecords,
  linkReceiptExtractionToFinancialEntry,
} from '@/modules/taxi_fleet/lib/receiptExtractionPipeline'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['taxi_fleet.driver'] },
  POST: { requireAuth: true, requireFeatures: ['taxi_fleet.driver'] },
  DELETE: { requireAuth: true, requireFeatures: ['taxi_fleet.driver'] },
}

const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 50

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

async function loadExtractionsByEntryId(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    entryIds: string[]
    attachmentIds?: string[]
  },
): Promise<Map<string, TaxiFleetReceiptExtraction>> {
  const map = new Map<string, TaxiFleetReceiptExtraction>()
  if (!params.entryIds.length && !params.attachmentIds?.length) return map

  const filters: Array<Record<string, unknown>> = []
  if (params.entryIds.length) {
    filters.push({ financialEntryId: { $in: params.entryIds } })
  }
  if (params.attachmentIds?.length) {
    filters.push({ attachmentId: { $in: params.attachmentIds } })
  }

  const rows = await findWithDecryption(
    em,
    TaxiFleetReceiptExtraction,
    {
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      deletedAt: null,
      ...(filters.length === 1 ? filters[0]! : { $or: filters }),
    },
    { orderBy: { updatedAt: 'DESC' } },
    { tenantId: params.tenantId, organizationId: params.organizationId },
  )

  for (const row of rows) {
    const entryId = row.financialEntryId
    if (entryId && !map.has(entryId)) {
      map.set(entryId, row)
    }
  }
  return map
}

async function loadExtractionsForEntries(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    entries: TaxiFleetFinancialEntry[]
  },
): Promise<Map<string, TaxiFleetReceiptExtraction>> {
  const entryIds = params.entries.map((row) => row.id)
  const attachmentIds = params.entries
    .map((row) => row.receiptAttachmentId)
    .filter((id): id is string => Boolean(id))
  const byEntry = await loadExtractionsByEntryId(em, {
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    entryIds,
    attachmentIds,
  })

  // Attach by attachment id when financialEntryId was never persisted (OCR race).
  if (attachmentIds.length) {
    const rows = await findWithDecryption(
      em,
      TaxiFleetReceiptExtraction,
      {
        tenantId: params.tenantId,
        organizationId: params.organizationId,
        attachmentId: { $in: attachmentIds },
        deletedAt: null,
      },
      { orderBy: { updatedAt: 'DESC' } },
      { tenantId: params.tenantId, organizationId: params.organizationId },
    )
    const entryIdByAttachment = new Map(
      params.entries
        .filter((row) => row.receiptAttachmentId)
        .map((row) => [row.receiptAttachmentId!, row.id] as const),
    )
    for (const row of rows) {
      const entryId = row.financialEntryId || entryIdByAttachment.get(row.attachmentId)
      if (!entryId || byEntry.has(entryId)) continue
      byEntry.set(entryId, row)
    }
  }
  return byEntry
}

function serializeWithExtraction(
  entry: TaxiFleetFinancialEntry,
  extraction: TaxiFleetReceiptExtraction | null | undefined,
) {
  const warnings = parseDriverExpenseWarnings(extraction?.warningsJson)
  return serializeDriverExpense(entry, {
    warnings,
    ocrStatus: extraction?.status ?? null,
  })
}

async function repairOcrApplyIfNeeded(
  em: EntityManager,
  entries: TaxiFleetFinancialEntry[],
  extractions: Map<string, TaxiFleetReceiptExtraction>,
): Promise<boolean> {
  let repaired = false
  for (const entry of entries) {
    const extraction = extractions.get(entry.id)
    if (!extraction) continue
    if (!extraction.financialEntryId) {
      extraction.financialEntryId = entry.id
    }
    const amount = Number(entry.amount)
    const amountEmpty = !Number.isFinite(amount) || amount <= 0
    const missingDocument =
      !entry.documentNumber?.trim() &&
      Boolean(extraction.ocrDocumentNumber || extraction.appliedDocumentNumber)
    const ready =
      extraction.status === 'applied' ||
      extraction.status === 'needs_review' ||
      extraction.status === 'extracted'
    if (!ready) continue
    if (!amountEmpty && !missingDocument && entry.documentNip) continue
    await applyReceiptExtractionToLinkedRecords(em, extraction.id)
    repaired = true
  }
  return repaired
}

export async function GET(req: Request) {
  try {
    const context = await buildContext(req)
    const { translate } = await resolveTranslations()
    const driver = await resolveDriverContext(context, translate, { requireExternalApp: true })
    const em = context.container.resolve('em') as EntityManager
    const url = new URL(req.url)
    const pageRaw = Number(url.searchParams.get('page') ?? '1')
    const pageSizeRaw = Number(url.searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE))
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number.isFinite(pageSizeRaw) ? Math.floor(pageSizeRaw) : DEFAULT_PAGE_SIZE),
    )
    const sort = resolveDriverExpenseSortField(url.searchParams.get('sort'))
    const order = url.searchParams.get('order') === 'asc' ? 'ASC' : 'DESC'
    const offset = (page - 1) * pageSize

    const scope = {
      tenantId: driver.teamMember.tenantId,
      organizationId: driver.teamMember.organizationId,
    }
    const [rows, total] = await findAndCountWithDecryption(
      em,
      TaxiFleetFinancialEntry,
      {
        teamMemberId: driver.teamMemberId,
        kind: 'expense',
        deletedAt: null,
      },
      {
        orderBy: { [sort]: order },
        limit: pageSize,
        offset,
      },
      scope,
    )
    const extractions = await loadExtractionsForEntries(em, {
      ...scope,
      entries: rows,
    })
    const repaired = await repairOcrApplyIfNeeded(em, rows, extractions)
    const refreshedRows = repaired
      ? (
          await findAndCountWithDecryption(
            em,
            TaxiFleetFinancialEntry,
            {
              teamMemberId: driver.teamMemberId,
              kind: 'expense',
              deletedAt: null,
            },
            {
              orderBy: { [sort]: order },
              limit: pageSize,
              offset,
            },
            scope,
          )
        )[0]
      : rows
    const refreshedExtractions = repaired
      ? await loadExtractionsForEntries(em, {
          ...scope,
          entries: refreshedRows,
        })
      : extractions

    return NextResponse.json({
      items: refreshedRows.map((row) =>
        serializeWithExtraction(row, refreshedExtractions.get(row.id)),
      ),
      page,
      pageSize,
      total,
      sort,
      order: order.toLowerCase(),
    })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const context = await buildContext(req)
    const { translate } = await resolveTranslations()
    const driver = await resolveDriverContext(context, translate, { requireExternalApp: true })
    const body = await req.json().catch(() => ({}))
    const parsed = driverExpenseCreateSchema.parse(body)
    const commandBus = context.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute<
      ReturnType<typeof mapDriverExpenseToCreateInput>,
      { entryId: string }
    >('taxi_fleet.financial_entries.create', {
      input: mapDriverExpenseToCreateInput(parsed, {
        tenantId: driver.teamMember.tenantId,
        organizationId: driver.teamMember.organizationId,
        teamMemberId: driver.teamMemberId,
      }),
      ctx: context,
    })

    if (result?.entryId && parsed.receiptAttachmentId) {
      const em = context.container.resolve('em') as EntityManager
      await linkReceiptExtractionToFinancialEntry(em, {
        attachmentId: parsed.receiptAttachmentId,
        tenantId: driver.teamMember.tenantId,
        organizationId: driver.teamMember.organizationId,
        financialEntryId: result.entryId,
        driverDocumentNumber: parsed.documentNumber ?? null,
        driverAmount: parsed.amount ?? null,
      })
    }

    return NextResponse.json({ id: result?.entryId ?? null }, { status: 201 })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', details: err.flatten() }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const context = await buildContext(req)
    const { translate } = await resolveTranslations()
    const driver = await resolveDriverContext(context, translate, { requireExternalApp: true })
    const url = new URL(req.url)
    const id = url.searchParams.get('id')?.trim() || null
    if (!id) throw new CrudHttpError(400, { error: 'Missing expense id' })

    const em = context.container.resolve('em') as EntityManager
    const scope = {
      tenantId: driver.teamMember.tenantId,
      organizationId: driver.teamMember.organizationId,
    }
    const row = await findOneWithDecryption(em, TaxiFleetFinancialEntry, {
      id,
      teamMemberId: driver.teamMemberId,
      kind: 'expense',
      deletedAt: null,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    })
    if (!row) throw new CrudHttpError(404, { error: 'Not found' })

    const extractions = await loadExtractionsForEntries(em, {
      ...scope,
      entries: [row],
    })
    const extraction = extractions.get(row.id)
    const warnings = parseDriverExpenseWarnings(extraction?.warningsJson)
    const serialized = serializeDriverExpense(row, {
      warnings,
      ocrStatus: extraction?.status ?? null,
    })
    if (!serialized.canDelete) {
      throw new CrudHttpError(403, {
        error: translate(
          'taxi_fleet.driverApp.expenses.deleteNotAllowed',
          'Only duplicate or flagged costs can be deleted.',
        ),
      })
    }

    const commandBus = context.container.resolve('commandBus') as CommandBus
    await commandBus.execute('taxi_fleet.financial_entries.delete', {
      input: { id: row.id },
      ctx: context,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const openApi = {
  GET: {
    summary: 'List own driver expense entries',
    tags: ['Taxi fleet driver'],
  },
  POST: {
    summary: 'Register a driver expense (fuel, parking, …)',
    tags: ['Taxi fleet driver'],
    requestBody: { schema: driverExpenseCreateSchema },
  },
  DELETE: {
    summary: 'Delete own driver expense entry (duplicate or warned only)',
    tags: ['Taxi fleet driver'],
  },
}
