import type { CrudBuiltinField, CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'

type TranslateFn = (key: string, fallback: string, params?: Record<string, string>) => string
import { formatMoneyDisplay } from '@open-mercato/shared/lib/numeric'

export type DiscountCodeFormValues = {
  code: string
  label: string
  discountType: 'percent' | 'amount'
  value: string
  usageLimit: string
  usedAmount: string
  active: boolean
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
      fields: ['code', 'label', 'discountType', 'value', 'usageLimit', 'usedAmount', 'active'],
    },
  ]
}

export function buildDiscountCodeFormFields(
  t: TranslateFn,
  options?: { includeUsedAmount?: boolean },
): CrudBuiltinField[] {
  const includeUsedAmount = options?.includeUsedAmount ?? false
  const fields: CrudBuiltinField[] = [
    {
      id: 'code',
      label: t('taxi_fleet.discount_codes.form.code', 'Code'),
      type: 'text',
      required: true,
      description: t('taxi_fleet.discount_codes.form.codeHint', 'Stored uppercase; must be unique in this organization.'),
    },
    {
      id: 'label',
      label: t('taxi_fleet.discount_codes.form.label', 'Label'),
      type: 'text',
    },
    {
      id: 'discountType',
      label: t('taxi_fleet.discount_codes.form.discountType', 'Discount type'),
      type: 'select',
      required: true,
      options: [
        { value: 'percent', label: t('taxi_fleet.discount_codes.types.percent', 'Percent') },
        { value: 'amount', label: t('taxi_fleet.discount_codes.types.amount', 'Fixed amount') },
      ],
    },
    {
      id: 'value',
      label: t('taxi_fleet.discount_codes.form.value', 'Value'),
      type: 'text',
      required: true,
      description: t(
        'taxi_fleet.discount_codes.form.valueHint',
        'Percent (0–100) or fixed amount in PLN depending on type.',
      ),
    },
    {
      id: 'usageLimit',
      label: t('taxi_fleet.discount_codes.form.usageLimit', 'Usage limit (pool)'),
      type: 'text',
      visibleWhen: (values) => values.discountType === 'amount',
      description: t(
        'taxi_fleet.discount_codes.form.usageLimitHint',
        'Total discount budget for this code; required for amount type.',
      ),
    },
    {
      id: 'active',
      label: t('taxi_fleet.discount_codes.form.active', 'Active'),
      type: 'checkbox',
    },
  ]

  if (includeUsedAmount) {
    fields.splice(fields.length - 1, 0, {
      id: 'usedAmount',
      label: t('taxi_fleet.discount_codes.form.usedAmount', 'Used amount'),
      type: 'text',
      visibleWhen: (values) => values.discountType === 'amount',
      description: t('taxi_fleet.discount_codes.form.usedAmountHint', 'Consumed from the pool so far.'),
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
    value: row.value,
    usageLimit: row.usageLimit ?? '',
    usedAmount: row.usedAmount ?? '0',
    active: row.active,
  }
}

export function formatDiscountCodeListValue(row: { discountType: string; value: string }): string {
  if (row.discountType === 'percent') {
    return `${row.value}%`
  }
  const numeric = Number(row.value)
  if (Number.isFinite(numeric)) {
    return formatMoneyDisplay(numeric, { currency: 'PLN' })
  }
  return row.value
}
