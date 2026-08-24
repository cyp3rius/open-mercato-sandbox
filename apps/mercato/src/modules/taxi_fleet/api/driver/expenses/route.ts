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
import {
  buildFinancialEntryReceiptOcrExtras,
  loadExtractionsForFinancialEntries,
} from '@/modules/taxi_fleet/lib/financialEntryReceiptEnrichment'

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

async function loadExtractionsForEntries(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    entries: TaxiFleetFinancialEntry[]
  },
): Promise<Map<string, TaxiFleetReceiptExtraction>> {
  return loadExtractionsForFinancialEntries(em, params)
}

function serializeWithExtraction(
  entry: TaxiFleetFinancialEntry,
  extraction: TaxiFleetReceiptExtraction | null | undefined,
) {
  const extras = buildFinancialEntryReceiptOcrExtras(entry, extraction)
  return serializeDriverExpense(entry, {
    warnings: extras.warnings,
    ocrStatus: extras.ocrStatus,
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
