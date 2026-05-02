'use client'

import * as React from 'react'
import { Plus } from 'lucide-react'
import { createCrudFormApplyPatchBridgeField } from '@open-mercato/ui/backend/inputs'
import {
  CRUD_FORM_TEXT_INPUT_CLASS,
  type CrudField,
  type CrudFormGroup,
} from '@open-mercato/ui/backend/CrudForm'
import { Button } from '@open-mercato/ui/primitives/button'
import { normalizeBankAccountNumberForStorage } from '../lib/bankAccountLookup'
import { normalizeBankAccountLinesAtMostOneDefault } from '../lib/bankAccountsNormalize'
import { ACCOUNTING_INVOICE_NUMBERING_MODE_IDS } from '../lib/sellingEntityConstants'
import {
  createEmptyBankAccountRow,
  SellingEntityBankAccountsField,
  type SellingEntityBankAccountDraft,
} from './SellingEntityBankAccountsField'
import { InvoiceNumberingPreviewField } from './InvoiceNumberingPreviewField'

type Translate = (key: string, defaultValue?: string) => string

export type SellingEntityFormValues = {
  name: string
  nip: string
  regon: string
  address: string
  bankAccounts: SellingEntityBankAccountDraft[]
  invoiceNumberingMode: (typeof ACCOUNTING_INVOICE_NUMBERING_MODE_IDS)[number]
  invoiceNumberingCustom: string
  /** Sztuczne pole na podgląd numeru (brak w API). */
  numberingPreview?: string
}

function numberingModeLabel(t: Translate, id: string): string {
  switch (id) {
    case 'fv_year_seq':
      return t('accounting.settings.entities.numbering.fvYearSeq', 'FV/YYYY/0001')
    case 'year_seq':
      return t('accounting.settings.entities.numbering.yearSeq', 'YYYY/0001')
    case 'seq_only':
      return t('accounting.settings.entities.numbering.seqOnly', 'Sequential (0001)')
    case 'custom':
      return t('accounting.settings.entities.numbering.custom', 'Custom template')
    default:
      return id
  }
}

export function defaultSellingEntityInitialValues(): SellingEntityFormValues {
  return {
    name: '',
    nip: '',
    regon: '',
    address: '',
    bankAccounts: [],
    invoiceNumberingMode: 'fv_year_seq',
    invoiceNumberingCustom: '',
    numberingPreview: '',
  }
}

type SellingEntityFormFieldsOptions = {
  /** When set, adds an invisible field so `ref.current(patch)` can fill the form (MF VAT sync). */
  registrySyncApplyRef?: React.MutableRefObject<((patch: Record<string, unknown>) => void) | null>
}

export function buildSellingEntityFormFields(t: Translate, options?: SellingEntityFormFieldsOptions): CrudField[] {
  const modeOptions = ACCOUNTING_INVOICE_NUMBERING_MODE_IDS.map((id) => ({
    value: id,
    label: numberingModeLabel(t, id),
  }))

  const bridge: CrudField[] =
    options?.registrySyncApplyRef != null
      ? [createCrudFormApplyPatchBridgeField(options.registrySyncApplyRef, { fieldId: '__sellingEntityRegistrySync' })]
      : []

  return [
    ...bridge,
    {
      id: 'name',
      type: 'text',
      required: true,
      label: t('accounting.settings.entities.fields.name', 'Company name'),
      layout: 'full',
    },
    {
      id: 'nip',
      type: 'text',
      label: t('accounting.settings.entities.fields.nip', 'NIP'),
      layout: 'half',
    },
    {
      id: 'regon',
      type: 'text',
      label: t('accounting.settings.entities.fields.regon', 'REGON'),
      layout: 'half',
    },
    {
      id: 'address',
      type: 'textarea',
      label: t('accounting.settings.entities.fields.address', 'Address'),
      layout: 'full',
    },
    {
      id: 'bankAccounts',
      type: 'custom',
      label: '',
      layout: 'full',
      component: SellingEntityBankAccountsField,
    },
    {
      id: 'invoiceNumberingMode',
      type: 'select',
      required: true,
      label: t('accounting.settings.entities.fields.invoiceNumberingMode', 'Invoice number format'),
      layout: 'full',
      options: modeOptions,
    },
    {
      id: 'invoiceNumberingCustom',
      type: 'custom',
      label: t('accounting.settings.entities.fields.invoiceNumberingCustom', 'Custom template'),
      layout: 'full',
      component: (props) => {
        const mode = props.values?.invoiceNumberingMode
        if (mode !== 'custom') return null
        const v = typeof props.value === 'string' ? props.value : ''
        return (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {t(
                'accounting.settings.entities.customTemplateHint',
                'Placeholders: {YYYY} year, {SEQ} sequence, {SEQ:4} zero-padded width.',
              )}
            </p>
            <input
              type="text"
              className={CRUD_FORM_TEXT_INPUT_CLASS}
              value={v}
              disabled={props.disabled}
              onChange={(e) => props.setValue(e.target.value)}
              autoComplete="off"
            />
          </div>
        )
      },
    },
    {
      id: 'numberingPreview',
      type: 'custom',
      label: t('accounting.settings.entities.fields.numberingPreview', 'Preview'),
      layout: 'full',
      component: InvoiceNumberingPreviewField,
    },
  ]
}

type SellingEntityFormGroupsOptions = {
  includeRegistrySyncBridge?: boolean
}

export function buildSellingEntityFormGroups(t: Translate, options?: SellingEntityFormGroupsOptions): CrudFormGroup[] {
  const basicsFields: string[] = options?.includeRegistrySyncBridge
    ? ['__sellingEntityRegistrySync', 'name', 'nip', 'regon', 'address']
    : ['name', 'nip', 'regon', 'address']

  return [
    {
      id: 'basics',
      column: 1,
      title: t('accounting.settings.entities.groups.basics', 'Company'),
      fields: basicsFields,
    },
    {
      id: 'banking',
      column: 1,
      title: t('accounting.settings.entities.groups.banking', 'Bank accounts'),
      fields: ['bankAccounts'],
      headerActions: ({ setValue, values, disabled }) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => {
            const current = Array.isArray(values?.bankAccounts)
              ? ([...(values.bankAccounts as SellingEntityBankAccountDraft[])])
              : []
            if (current.length === 0) {
              setValue('bankAccounts', [createEmptyBankAccountRow(), createEmptyBankAccountRow()])
            } else {
              setValue('bankAccounts', [...current, createEmptyBankAccountRow()])
            }
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t('accounting.settings.entities.addBankAccount', 'Add account')}
        </Button>
      ),
    },
    {
      id: 'numbering',
      column: 2,
      title: t('accounting.settings.entities.groups.numbering', 'Invoice numbering'),
      fields: ['invoiceNumberingMode', 'invoiceNumberingCustom', 'numberingPreview'],
    },
  ]
}

export function bankAccountsToPayload(
  rows: SellingEntityBankAccountDraft[],
): Array<{
  accountNumber: string
  label?: string | null
  currencyCode?: string | null
  isDefault?: boolean | null
}> | null {
  const mapped = rows
    .map((r) => ({
      accountNumber: normalizeBankAccountNumberForStorage(r.accountNumber),
      label: r.label.trim() ? r.label.trim() : null,
      currencyCode: r.currencyCode.trim() ? r.currencyCode.trim().toUpperCase() : null,
      isDefault: r.isDefault === true ? true : null,
    }))
    .filter((r) => r.accountNumber.length > 0)
  const out = normalizeBankAccountLinesAtMostOneDefault(mapped)
  return out.length > 0 ? out : null
}

export function bankAccountsFromApi(
  rows: Array<{
    accountNumber?: string
    label?: string | null
    currencyCode?: string | null
    isDefault?: boolean | null
  }> | null | undefined,
): SellingEntityBankAccountDraft[] {
  if (!Array.isArray(rows) || rows.length === 0) return []
  const normalized = normalizeBankAccountLinesAtMostOneDefault(
    rows.map((r) => ({
      ...r,
      isDefault: r.isDefault === true ? true : null,
    })),
  )
  return normalized.map((r) => ({
    id: crypto.randomUUID(),
    accountNumber: normalizeBankAccountNumberForStorage(
      typeof r.accountNumber === 'string' ? r.accountNumber : '',
    ),
    label: typeof r.label === 'string' ? r.label : '',
    currencyCode: typeof r.currencyCode === 'string' ? r.currencyCode : 'PLN',
    isDefault: r.isDefault === true,
  }))
}
