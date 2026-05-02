import type {
  SearchBuildContext,
  SearchIndexSource,
  SearchModuleConfig,
  SearchResultPresenter,
} from '@open-mercato/shared/modules/search'
import type { TranslateFn } from '@open-mercato/shared/lib/i18n/context'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { ACCOUNTING_INVOICE_ENTITY_ID } from './lib/constants'

function pickString(...candidates: Array<unknown>): string | null {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    const trimmed = candidate.trim()
    if (trimmed.length > 0) return trimmed
  }
  return null
}

function appendLine(lines: string[], label: string, value: unknown) {
  if (value === null || value === undefined) return
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  if (!text.trim()) return
  lines.push(`${label}: ${text}`)
}

function appendCustomFieldLines(lines: string[], customFields: Record<string, unknown>) {
  for (const [key, value] of Object.entries(customFields)) {
    appendLine(lines, key.replace(/^cf:/, ''), value)
  }
}

function kindLabel(t: TranslateFn, raw: unknown): string {
  if (raw === 'imported_cost') return t('accounting.kinds.importedCost', 'Imported cost invoice')
  if (raw === 'imported_sales') return t('accounting.kinds.importedSales', 'Imported sales invoice')
  return t('accounting.kinds.issued', 'Issued invoice')
}

function buildInvoicePresenter(
  t: TranslateFn,
  record: Record<string, unknown>,
  customFields: Record<string, unknown>,
): SearchResultPresenter {
  const title = pickString(record.document_number, record.documentNumber, customFields.document_number) ?? String(record.id ?? '')
  const subtitleParts = [
    kindLabel(t, record.document_kind ?? record.documentKind),
    pickString(record.counterparty_name, record.counterpartyName, customFields.counterparty_name),
    pickString(record.issue_date, record.issueDate, customFields.issue_date),
  ].filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)

  return {
    title,
    subtitle: subtitleParts.length ? subtitleParts.join(' · ') : undefined,
    icon: 'receipt-text',
    badge: t('accounting.search.badge.invoice', 'Invoice'),
  }
}

function buildIndexSource(
  ctx: SearchBuildContext,
  presenter: SearchResultPresenter,
  lines: string[],
): SearchIndexSource | null {
  appendCustomFieldLines(lines, ctx.customFields)
  if (!lines.length) return null
  return {
    text: lines,
    presenter,
    checksumSource: { record: ctx.record, customFields: ctx.customFields },
  }
}

export const searchConfig: SearchModuleConfig = {
  entities: [
    {
      entityId: ACCOUNTING_INVOICE_ENTITY_ID,
      enabled: true,
      priority: 8,
      buildSource: async (ctx) => {
        const { t } = await resolveTranslations()
        const record = ctx.record
        const lines: string[] = []
        appendLine(lines, 'Document number', record.document_number ?? record.documentNumber)
        appendLine(lines, 'Document kind', record.document_kind ?? record.documentKind)
        appendLine(lines, 'Issue date', record.issue_date ?? record.issueDate)
        appendLine(lines, 'Counterparty', record.counterparty_name ?? record.counterpartyName)
        appendLine(lines, 'External reference', record.external_reference ?? record.externalReference)
        appendLine(lines, 'Notes', record.notes)
        if (record.is_draft === true || record.isDraft === true) {
          appendLine(lines, 'Draft', 'yes')
        }
        return buildIndexSource(ctx, buildInvoicePresenter(t, record, ctx.customFields), lines)
      },
      formatResult: async (ctx) => {
        const { t } = await resolveTranslations()
        return buildInvoicePresenter(t, ctx.record, ctx.customFields)
      },
      resolveUrl: async (ctx) => `/backend/accounting/invoices/${encodeURIComponent(String(ctx.record.id))}`,
      fieldPolicy: {
        searchable: ['document_number', 'document_kind', 'issue_date', 'counterparty_name', 'external_reference', 'notes'],
      },
    },
  ],
}

export default searchConfig
export const config = searchConfig
