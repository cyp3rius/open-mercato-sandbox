'use client'

import * as React from 'react'
import { Trash2 } from 'lucide-react'
import { CRUD_FORM_TEXT_INPUT_CLASS, type CrudCustomFieldRenderProps } from '@open-mercato/ui/backend/CrudForm'
import { IconButton } from '@open-mercato/ui/primitives/icon-button'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { normalizeDraftBankAccountsSingleDefault } from '../lib/bankAccountsNormalize'
import { BankAccountValidationHints } from './BankAccountValidationHints'

export type SellingEntityBankAccountDraft = {
  id: string
  accountNumber: string
  label: string
  /** ISO 4217 */
  currencyCode: string
  isDefault: boolean
}

export function createEmptyBankAccountRow(): SellingEntityBankAccountDraft {
  return { id: crypto.randomUUID(), accountNumber: '', label: '', currencyCode: 'PLN', isDefault: false }
}

function newRow(): SellingEntityBankAccountDraft {
  return createEmptyBankAccountRow()
}

/**
 * Wiele kont bankowych dla spółki sprzedającej (ustawienia księgowości).
 */
export function SellingEntityBankAccountsField(props: CrudCustomFieldRenderProps) {
  const t = useT()
  const defaultRadioGroup = React.useId()
  const { value, setValue, disabled } = props
  const rows = Array.isArray(value) ? (value as SellingEntityBankAccountDraft[]) : []

  React.useEffect(() => {
    if (!Array.isArray(value)) return
    const list = value as SellingEntityBankAccountDraft[]
    const next = normalizeDraftBankAccountsSingleDefault(list)
    const changed = next.some((r, i) => r.isDefault !== list[i]?.isDefault)
    if (changed) setValue(next)
  }, [value, setValue])

  const safeRows = rows.length > 0 ? rows : [newRow()]

  const setRows = (next: SellingEntityBankAccountDraft[]) => {
    setValue(next)
  }

  const selectedDefaultId = React.useMemo(() => safeRows.find((r) => r.isDefault)?.id ?? '', [safeRows])

  const setDefaultRowId = React.useCallback(
    (id: string | null) => {
      setRows(safeRows.map((r) => ({ ...r, isDefault: id !== null && r.id === id })))
    },
    [safeRows, setRows],
  )

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {t(
          'accounting.settings.entities.bankAccountDefaultHint',
          'Only one account can be marked as the default.',
        )}
      </p>
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed border-border/80 bg-muted/30 px-3 py-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <input
            type="radio"
            name={defaultRadioGroup}
            className={cn('h-4 w-4 border border-input text-primary', disabled && 'opacity-50')}
            checked={selectedDefaultId === ''}
            disabled={disabled}
            onChange={() => setDefaultRowId(null)}
          />
          {t('accounting.settings.entities.bankAccountDefaultNone', 'No default account')}
        </label>
      </div>
      {safeRows.map((row) => (
        <div
          key={row.id}
          className="relative grid grid-cols-1 gap-3 rounded-lg border border-border bg-card p-3 pt-10 sm:grid-cols-12"
        >
          <div className="absolute right-2 top-2">
            <IconButton
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              className="text-muted-foreground hover:text-destructive"
              title={t('accounting.settings.entities.removeBankAccount', 'Remove account')}
              aria-label={t('accounting.settings.entities.removeBankAccount', 'Remove account')}
              onClick={() => {
                const next = safeRows.filter((r) => r.id !== row.id)
                setRows(next.length ? next : [newRow()])
              }}
            >
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </div>
          <div className="space-y-1.5 sm:col-span-8">
            <label className="text-sm font-medium">
              {t('accounting.settings.entities.bankAccountNumber', 'Account number (IBAN)')}
            </label>
            <input
              type="text"
              className={CRUD_FORM_TEXT_INPUT_CLASS}
              value={row.accountNumber}
              disabled={disabled}
              onChange={(e) =>
                setRows(
                  safeRows.map((r) => (r.id === row.id ? { ...r, accountNumber: e.target.value } : r)),
                )
              }
              autoComplete="off"
            />
            <BankAccountValidationHints accountNumber={row.accountNumber} disabled={disabled} />
          </div>
          <div className="space-y-1.5 sm:col-span-4">
            <label className="text-sm font-medium">
              {t('accounting.settings.entities.bankAccountCurrency', 'Currency')}
            </label>
            <input
              type="text"
              maxLength={3}
              className={CRUD_FORM_TEXT_INPUT_CLASS}
              value={row.currencyCode}
              disabled={disabled}
              onChange={(e) =>
                setRows(
                  safeRows.map((r) =>
                    r.id === row.id ? { ...r, currencyCode: e.target.value.toUpperCase() } : r,
                  ),
                )
              }
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-12">
            <label className="text-sm font-medium">
              {t('accounting.settings.entities.bankAccountLabel', 'Label (optional)')}
            </label>
            <input
              type="text"
              className={CRUD_FORM_TEXT_INPUT_CLASS}
              value={row.label}
              disabled={disabled}
              onChange={(e) =>
                setRows(
                  safeRows.map((r) => (r.id === row.id ? { ...r, label: e.target.value } : r)),
                )
              }
              autoComplete="off"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 sm:col-span-12">
            <input
              type="radio"
              name={defaultRadioGroup}
              className={cn('h-4 w-4 border border-input text-primary', disabled && 'opacity-50')}
              checked={selectedDefaultId === row.id}
              disabled={disabled}
              onChange={() => setDefaultRowId(row.id)}
            />
            <span className="text-sm font-medium leading-none">
              {t('accounting.settings.entities.bankAccountDefault', 'Default bank account')}
            </span>
          </label>
        </div>
      ))}
    </div>
  )
}
