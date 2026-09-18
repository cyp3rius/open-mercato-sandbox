'use client'

import * as React from 'react'
import type { CrudField, CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { CRUD_FORM_SELECT_CLASS } from '@open-mercato/ui/backend/CrudForm'
import { formatMoneyDisplay, formatPercentInputValue, parseNumericValue } from '@open-mercato/shared/lib/numeric'
import { MoneyInputField } from '@open-mercato/ui/backend/inputs/MoneyInputField'
import { PercentInputField } from '@open-mercato/ui/backend/inputs/PercentInputField'

type TranslateFn = (key: string, fallback: string, params?: Record<string, string>) => string

export type DiscountCodeFormValues = {
  code: string
  label: string
  discountType: 'percent' | 'amount'
  value: string
  usageLimit: string
  usedAmount: string
  active: boolean
}

function formatMoneyInputValue(value: string | number | null | undefined): string {
  const parsed = parseNumericValue(value)
  if (parsed === null) return ''
  if (Number.isInteger(parsed)) return String(parsed)
  return String(parsed)
}

export function defaultDiscountCodeFormValues(): DiscountCodeFormValues {
  return {
    code: '',
    label: '',
    discountType: 'percent',
    value: '',
    usageLimit: '',
    usedAmount: '0',
    active: true,
  }
}

export function buildDiscountCodeFormGroups(t: TranslateFn): CrudFormGroup[] {
  return [
    {
      id: 'basics',
      title: t('taxi_fleet.discount_codes.form.groups.basics', 'Basics'),
      column: 1 as const,
      fields: ['code', 'label'],
    },
    {
      id: 'discount',
      title: t('taxi_fleet.discount_codes.form.groups.discount', 'Discount'),
      column: 1 as const,
      fields: ['discountType', 'value', 'usageLimit', 'usedAmount'],
    },
    {
      id: 'status',
      title: t('taxi_fleet.discount_codes.form.groups.status', 'Status'),
      column: 2 as const,
      fields: ['active'],
    },
  ]
}

export function buildDiscountCodeFormFields(
  t: TranslateFn,
  options?: { includeUsedAmount?: boolean },
): CrudField[] {
  const includeUsedAmount = options?.includeUsedAmount ?? false
  const fields: CrudField[] = [
    {
      id: 'code',
      label: t('taxi_fleet.discount_codes.form.code', 'Code'),
      type: 'text',
      required: true,
      layout: 'half',
      description: t(
        'taxi_fleet.discount_codes.form.codeHint',
        'Stored uppercase; must be unique in this organization.',
      ),
    },
    {
      id: 'label',
      label: t('taxi_fleet.discount_codes.form.label', 'Label'),
      type: 'text',
      layout: 'half',
    },
    {
      id: 'discountType',
      label: t('taxi_fleet.discount_codes.form.discountType', 'Discount type'),
      type: 'custom',
      required: true,
      layout: 'half',
      component: ({ value, setValue, setFormValue, disabled, readOnly }) => {
        const current = value === 'amount' ? 'amount' : 'percent'
        return (
          <select
            className={CRUD_FORM_SELECT_CLASS}
            value={current}
            disabled={disabled || readOnly}
            data-crud-focus-target=""
            onChange={(event) => {
              const next = event.target.value === 'amount' ? 'amount' : 'percent'
              setValue(next)
              if (next === 'percent') {
                setFormValue?.('usageLimit', '')
                setFormValue?.('usedAmount', '0')
              }
            }}
          >
            <option value="percent">{t('taxi_fleet.discount_codes.types.percent', 'Percent')}</option>
            <option value="amount">{t('taxi_fleet.discount_codes.types.amount', 'Fixed amount')}</option>
          </select>
        )
      },
    },
    {
      id: 'value',
      label: t('taxi_fleet.discount_codes.form.value', 'Value'),
      type: 'custom',
      required: true,
      layout: 'half',
      description: t(
        'taxi_fleet.discount_codes.form.valueHint',
        'Percent (0–100) or fixed amount in PLN depending on type.',
      ),
      component: ({ value, setValue, values, disabled, readOnly }) => {
        const raw = typeof value === 'string' ? value : value == null ? '' : String(value)
        if (values?.discountType === 'amount') {
          return (
            <MoneyInputField
              value={raw}
              onChange={(next) => setValue(next)}
              disabled={disabled || readOnly}
              currency="PLN"
              placeholder="0"
            />
          )
        }
        return (
          <PercentInputField
            value={raw}
            onChange={(next) => setValue(next)}
            disabled={disabled || readOnly}
            placeholder="0"
          />
        )
      },
    },
    {
      id: 'usageLimit',
      label: t('taxi_fleet.discount_codes.form.usageLimit', 'Usage limit (pool)'),
      type: 'custom',
      layout: 'half',
      visibleWhen: (values) => values.discountType === 'amount',
      description: t(
        'taxi_fleet.discount_codes.form.usageLimitHint',
        'Total discount budget for this code; required for amount type.',
      ),
      component: ({ value, setValue, disabled, readOnly }) => (
        <MoneyInputField
          value={typeof value === 'string' ? value : value == null ? '' : String(value)}
          onChange={(next) => setValue(next)}
          disabled={disabled || readOnly}
          currency="PLN"
          placeholder="0"
        />
      ),
    },
    {
      id: 'active',
      label: t('taxi_fleet.discount_codes.form.active', 'Active'),
      type: 'checkbox',
      layout: 'full',
    },
  ]

  if (includeUsedAmount) {
    fields.splice(fields.length - 1, 0, {
      id: 'usedAmount',
      label: t('taxi_fleet.discount_codes.form.usedAmount', 'Used amount'),
      type: 'custom',
      layout: 'half',
      visibleWhen: (values) => values.discountType === 'amount',
      description: t('taxi_fleet.discount_codes.form.usedAmountHint', 'Consumed from the pool so far.'),
      component: ({ value, setValue, disabled, readOnly }) => (
        <MoneyInputField
          value={typeof value === 'string' ? value : value == null ? '' : String(value)}
          onChange={(next) => setValue(next)}
          disabled={disabled || readOnly}
          currency="PLN"
          placeholder="0"
        />
      ),
    })
  }

  return fields
}

export function mapDiscountCodeRowToFormValues(row: {
  code: string
  label?: string | null
  discountType: 'percent' | 'amount'
  value: string
  usageLimit?: string | null
  usedAmount?: string | null
  active: boolean
}): DiscountCodeFormValues {
  return {
    code: row.code,
    label: row.label ?? '',
    discountType: row.discountType,
    value:
      row.discountType === 'percent'
        ? formatPercentInputValue(row.value)
        : formatMoneyInputValue(row.value),
    usageLimit: formatMoneyInputValue(row.usageLimit),
    usedAmount: formatMoneyInputValue(row.usedAmount ?? '0') || '0',
    active: row.active,
  }
}

export function formatDiscountCodeListValue(row: { discountType: string; value: string }): string {
  if (row.discountType === 'percent') {
    return `${formatPercentInputValue(row.value)}%`
  }
  const numeric = Number(row.value)
  if (Number.isFinite(numeric)) {
    return formatMoneyDisplay(numeric, { currency: 'PLN' })
  }
  return row.value
}
