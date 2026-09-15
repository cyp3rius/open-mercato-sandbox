'use client'

import * as React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { Label } from '@open-mercato/ui/primitives/label'
import {
  CRUD_FORM_SELECT_CLASS,
  CRUD_FORM_TEXT_INPUT_CLASS,
} from '@open-mercato/ui/backend/CrudForm'
import type { CatalogProductCaseTemplate } from '@open-mercato/core/modules/catalog/data/types'
import { PlaybookSearchField } from '@open-mercato/core/modules/cases/components/PlaybookSearchField'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

const RECURRENCE_UNITS = ['hours', 'days', 'weeks', 'months'] as const

export type OrderLineCasePlanDraft = {
  id: string
  title: string
  playbookId: string | null
  recurrenceEnabled: boolean
  recurrenceIntervalAmount: string
  recurrenceIntervalUnit: (typeof RECURRENCE_UNITS)[number] | null
  recurrenceLeadTimeAmount: string
  recurrenceLeadTimeUnit: (typeof RECURRENCE_UNITS)[number] | null
  startsAt: string
  sourceTemplateId: string | null
  startsAtTouched: boolean
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `case-plan-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function toDateInput(value: string | null | undefined): string {
  if (!value) return ''
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString().slice(0, 10)
}

export function draftFromTemplate(
  template: CatalogProductCaseTemplate,
  defaultStartsAt: string,
): OrderLineCasePlanDraft {
  const lead = template.recurrenceCreateLeadTime
  return {
    id: template.id || createId(),
    title: template.title ?? '',
    playbookId: template.playbookId ?? null,
    recurrenceEnabled: Boolean(template.recurrenceEnabled),
    recurrenceIntervalAmount:
      template.recurrenceIntervalAmount == null
        ? ''
        : String(template.recurrenceIntervalAmount),
    recurrenceIntervalUnit:
      template.recurrenceIntervalUnit &&
      RECURRENCE_UNITS.includes(template.recurrenceIntervalUnit)
        ? template.recurrenceIntervalUnit
        : null,
    recurrenceLeadTimeAmount:
      lead?.amount == null ? '' : String(lead.amount),
    recurrenceLeadTimeUnit:
      lead?.unit && RECURRENCE_UNITS.includes(lead.unit) ? lead.unit : null,
    startsAt: toDateInput(template.startsAt) || toDateInput(defaultStartsAt),
    sourceTemplateId: template.sourceTemplateId ?? template.id ?? null,
    startsAtTouched: Boolean(template.startsAt),
  }
}

export function draftsFromCasePlan(
  plan: CatalogProductCaseTemplate[] | null | undefined,
  defaultStartsAt: string,
): OrderLineCasePlanDraft[] {
  if (!Array.isArray(plan)) return []
  return plan.map((entry) => draftFromTemplate(entry, defaultStartsAt))
}

export function sanitizeCasePlanDrafts(
  drafts: OrderLineCasePlanDraft[],
): CatalogProductCaseTemplate[] | null {
  const out: CatalogProductCaseTemplate[] = []
  for (const draft of drafts) {
    const title = draft.title.trim()
    if (!title) continue
    const startsAt = toDateInput(draft.startsAt)
    const item: CatalogProductCaseTemplate = {
      id: draft.id,
      title,
      playbookId: draft.playbookId,
      recurrenceEnabled: draft.recurrenceEnabled,
      startsAt: startsAt || null,
      sourceTemplateId: draft.sourceTemplateId,
    }
    if (draft.recurrenceEnabled) {
      const amount = Number.parseInt(draft.recurrenceIntervalAmount, 10)
      if (Number.isFinite(amount) && amount > 0) {
        item.recurrenceIntervalAmount = amount
      }
      if (draft.recurrenceIntervalUnit) {
        item.recurrenceIntervalUnit = draft.recurrenceIntervalUnit
      }
      const leadAmount = Number.parseInt(draft.recurrenceLeadTimeAmount, 10)
      if (
        Number.isFinite(leadAmount) &&
        leadAmount > 0 &&
        draft.recurrenceLeadTimeUnit
      ) {
        item.recurrenceCreateLeadTime = {
          amount: leadAmount,
          unit: draft.recurrenceLeadTimeUnit,
        }
      }
    }
    out.push(item)
  }
  return out.length ? out : null
}

export async function fetchProductCaseTemplates(
  productId: string,
): Promise<CatalogProductCaseTemplate[]> {
  const res = await apiCall<{
    items?: Array<{ case_templates?: unknown; caseTemplates?: unknown }>
  }>(
    `/api/catalog/products?id=${encodeURIComponent(productId)}&page=1&pageSize=1`,
    undefined,
    { fallback: { items: [] } },
  )
  if (!res.ok) return []
  const record = res.result?.items?.[0]
  const raw = record?.case_templates ?? record?.caseTemplates
  return Array.isArray(raw) ? (raw as CatalogProductCaseTemplate[]) : []
}

type OrderLineCasePlanEditorProps = {
  value: OrderLineCasePlanDraft[]
  onChange: (next: OrderLineCasePlanDraft[]) => void
  subscriptionStartsAt: string
  disabled?: boolean
  i18nPrefix?: string
}

export function OrderLineCasePlanEditor({
  value,
  onChange,
  subscriptionStartsAt,
  disabled,
  i18nPrefix = 'sales.orders',
}: OrderLineCasePlanEditorProps) {
  const t = useT()
  const defaultStart = toDateInput(subscriptionStartsAt)

  React.useEffect(() => {
    if (!defaultStart) return
    const next = value.map((row) => {
      if (row.startsAtTouched) return row
      if (row.startsAt === defaultStart) return row
      return { ...row, startsAt: defaultStart }
    })
    const changed = next.some((row, index) => row.startsAt !== value[index]?.startsAt)
    if (changed) onChange(next)
    // Only sync defaults when subscription start changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultStart])

  const updateRow = (index: number, patch: Partial<OrderLineCasePlanDraft>) => {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">
            {t(`${i18nPrefix}.lines.casePlan.title`, 'Case plan')}
          </p>
          <p className="text-xs text-muted-foreground">
            {t(
              `${i18nPrefix}.lines.casePlan.description`,
              'Preloaded from the product. Set start dates and recurrence; the system creates cases automatically.',
            )}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() =>
            onChange([
              ...value,
              {
                id: createId(),
                title: '',
                playbookId: null,
                recurrenceEnabled: false,
                recurrenceIntervalAmount: '',
                recurrenceIntervalUnit: null,
                recurrenceLeadTimeAmount: '',
                recurrenceLeadTimeUnit: null,
                startsAt: defaultStart,
                sourceTemplateId: null,
                startsAtTouched: false,
              },
            ])
          }
        >
          <Plus className="size-4 mr-1" aria-hidden />
          {t(`${i18nPrefix}.lines.casePlan.add`, 'Add case')}
        </Button>
      </div>

      {!value.length ? (
        <p className="text-xs text-muted-foreground">
          {t(
            `${i18nPrefix}.lines.casePlan.empty`,
            'No cases yet. Add one or pick a product with templates.',
          )}
        </p>
      ) : null}

      {value.map((row, index) => (
        <div
          key={row.id}
          className="rounded-md border border-border/60 p-3 space-y-3 bg-background"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="grid flex-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>
                  {t(`${i18nPrefix}.lines.casePlan.caseTitle`, 'Case title')}
                </Label>
                <input
                  className={CRUD_FORM_TEXT_INPUT_CLASS}
                  value={row.title}
                  disabled={disabled}
                  onChange={(event) =>
                    updateRow(index, { title: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>
                  {t(`${i18nPrefix}.lines.casePlan.playbook`, 'Procedure')}
                </Label>
                <PlaybookSearchField
                  value={row.playbookId}
                  onChange={(next) => updateRow(index, { playbookId: next })}
                  disabled={disabled}
                  placeholder={t(
                    `${i18nPrefix}.lines.casePlan.playbookSearch`,
                    'Search procedures…',
                  )}
                  createInNewTabAriaLabel={t(
                    `${i18nPrefix}.lines.casePlan.openNewPlaybookTab`,
                    'Open new procedure in a new tab',
                  )}
                />
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              onClick={() => onChange(value.filter((_, i) => i !== index))}
              aria-label={t(`${i18nPrefix}.lines.casePlan.remove`, 'Remove')}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>
                {t(`${i18nPrefix}.lines.casePlan.startsAt`, 'Case start date')}
              </Label>
              <input
                type="date"
                className={CRUD_FORM_TEXT_INPUT_CLASS}
                value={row.startsAt}
                disabled={disabled}
                onChange={(event) =>
                  updateRow(index, {
                    startsAt: event.target.value,
                    startsAtTouched: true,
                  })
                }
              />
            </div>
            <div className="space-y-1 flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={row.recurrenceEnabled}
                  disabled={disabled}
                  onChange={(event) =>
                    updateRow(index, {
                      recurrenceEnabled: event.target.checked,
                    })
                  }
                />
                {t(
                  `${i18nPrefix}.lines.casePlan.recurrenceEnabled`,
                  'Recurring',
                )}
              </label>
            </div>
          </div>

          {row.recurrenceEnabled ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>
                  {t(
                    `${i18nPrefix}.lines.casePlan.recurrenceInterval`,
                    'Interval',
                  )}
                </Label>
                <div className="flex gap-2">
                  <input
                    className={CRUD_FORM_TEXT_INPUT_CLASS}
                    inputMode="numeric"
                    value={row.recurrenceIntervalAmount}
                    disabled={disabled}
                    onChange={(event) =>
                      updateRow(index, {
                        recurrenceIntervalAmount: event.target.value,
                      })
                    }
                  />
                  <select
                    className={CRUD_FORM_SELECT_CLASS}
                    value={row.recurrenceIntervalUnit ?? ''}
                    disabled={disabled}
                    onChange={(event) =>
                      updateRow(index, {
                        recurrenceIntervalUnit:
                          (event.target.value as OrderLineCasePlanDraft['recurrenceIntervalUnit']) ||
                          null,
                      })
                    }
                  >
                    <option value="">
                      {t(
                        `${i18nPrefix}.lines.casePlan.unitPlaceholder`,
                        'Unit',
                      )}
                    </option>
                    {RECURRENCE_UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {t(
                          `catalog.products.caseTemplates.recurrenceUnits.${unit}`,
                          unit,
                        )}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>
                  {t(
                    `${i18nPrefix}.lines.casePlan.recurrenceLeadTime`,
                    'Lead time',
                  )}
                </Label>
                <div className="flex gap-2">
                  <input
                    className={CRUD_FORM_TEXT_INPUT_CLASS}
                    inputMode="numeric"
                    value={row.recurrenceLeadTimeAmount}
                    disabled={disabled}
                    onChange={(event) =>
                      updateRow(index, {
                        recurrenceLeadTimeAmount: event.target.value,
                      })
                    }
                  />
                  <select
                    className={CRUD_FORM_SELECT_CLASS}
                    value={row.recurrenceLeadTimeUnit ?? ''}
                    disabled={disabled}
                    onChange={(event) =>
                      updateRow(index, {
                        recurrenceLeadTimeUnit:
                          (event.target.value as OrderLineCasePlanDraft['recurrenceLeadTimeUnit']) ||
                          null,
                      })
                    }
                  >
                    <option value="">
                      {t(
                        `${i18nPrefix}.lines.casePlan.unitPlaceholder`,
                        'Unit',
                      )}
                    </option>
                    {RECURRENCE_UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {t(
                          `catalog.products.caseTemplates.recurrenceUnits.${unit}`,
                          unit,
                        )}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}
