import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import type { EntitySearchComboboxOption } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import type { AccountingSellingEntityBankAccount } from '../data/entities'

type SellingEntityListRow = {
  id: string
  name: string
  nip: string | null
  regon: string | null
  address: string | null
  bankAccounts: AccountingSellingEntityBankAccount[] | null
}

/** JSON z API / migracji może mieć snake_case lub stringowe flagi — normalizujemy pod wybór domyślnego konta. */
function coerceBankAccountsJson(raw: unknown): AccountingSellingEntityBankAccount[] | null {
  if (!Array.isArray(raw)) return null
  const out: AccountingSellingEntityBankAccount[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const o = entry as Record<string, unknown>
    const numRaw =
      (typeof o.accountNumber === 'string' && o.accountNumber) ||
      (typeof o.account_number === 'string' && o.account_number) ||
      ''
    const accountNumber = String(numRaw).trim()
    if (!accountNumber) continue
    const label =
      typeof o.label === 'string' ? o.label : typeof o.account_label === 'string' ? o.account_label : undefined
    const currencyRaw =
      typeof o.currencyCode === 'string'
        ? o.currencyCode
        : typeof o.currency_code === 'string'
          ? o.currency_code
          : ''
    const isDefault =
      o.isDefault === true ||
      o.is_default === true ||
      (typeof o.isDefault === 'string' && o.isDefault.toLowerCase() === 'true') ||
      (typeof o.is_default === 'string' && o.is_default.toLowerCase() === 'true')
    out.push({
      accountNumber,
      ...(label !== undefined ? { label } : {}),
      ...(currencyRaw.trim() ? { currencyCode: currencyRaw.trim().toUpperCase() } : {}),
      ...(isDefault ? { isDefault: true } : {}),
    })
  }
  return out.length > 0 ? out : null
}

type ListResponse = {
  items?: SellingEntityListRow[]
}

/**
 * Wyszukiwanie spółek sprzedających (Ustawienia księgowości) — combobox na fakturze.
 */
export async function searchSellingEntities(query: string): Promise<EntitySearchComboboxOption[]> {
  const params = new URLSearchParams({
    page: '1',
    pageSize: '20',
    sortField: 'name',
    sortDir: 'asc',
  })
  const q = query.trim()
  if (q) params.set('search', q)

  const call = await apiCall<ListResponse>(`/api/accounting/selling-entities?${params.toString()}`)
  if (!call.ok) return []
  const rows = Array.isArray(call.result?.items) ? call.result.items : []
  const out: EntitySearchComboboxOption[] = []
  for (const row of rows) {
    const id = typeof row.id === 'string' ? row.id : ''
    if (!id) continue
    const name = typeof row.name === 'string' && row.name.trim() ? row.name.trim() : id
    const nip = typeof row.nip === 'string' && row.nip.trim() ? row.nip.trim() : ''
    const regon = typeof row.regon === 'string' && row.regon.trim() ? row.regon.trim() : ''
    const desc = [nip ? `NIP: ${nip}` : '', regon ? `REGON: ${regon}` : ''].filter(Boolean).join(' · ')
    out.push({ value: id, label: name, ...(desc ? { description: desc } : {}) })
  }
  return out
}

export type SellingEntitySnapshot = {
  entityId: string
  name: string
  nip: string
  regon: string
  address: string
  /** Numery kont do listy płatności na fakturze. */
  bankAccountNumbers: string[]
  /** Jednoznaczny wybór konta (jedno konto lub jedno domyślne); null — użytkownik wybiera z listy. */
  suggestedPaymentBankAccount: string | null
}

function compactAccountNumber(raw: string): string {
  return raw.trim().replace(/[\s-]+/g, '').toUpperCase()
}

/** Wartość `<option value>` musi być identyczna z jednym z `numbers` (np. ten sam IBAN ze spacjami). */
export function canonicalBankAccountForSelect(raw: string, numbers: string[]): string {
  const t = raw.trim()
  if (!t) return ''
  if (numbers.includes(t)) return t
  const compact = compactAccountNumber(t)
  const hit = numbers.find((n) => compactAccountNumber(n) === compact)
  return hit ?? t
}

function toBankAccountNumbers(accounts: AccountingSellingEntityBankAccount[] | null | undefined): string[] {
  if (!Array.isArray(accounts)) return []
  const withDefault: string[] = []
  const rest: string[] = []
  for (const a of accounts) {
    if (a && typeof a === 'object' && typeof a.accountNumber === 'string' && a.accountNumber.trim().length > 0) {
      const n = typeof a.accountNumber === 'string' ? a.accountNumber.trim() : ''
      if (a.isDefault === true) withDefault.push(n)
      else rest.push(n)
    }
  }
  return [...new Set(withDefault), ...new Set(rest)]
}

/**
 * Konto do automatycznego wyboru na fakturze: jedyne zdefiniowane lub jedyne oznaczone jako domyślne.
 */
export function pickSuggestedSellerBankAccount(
  accounts: AccountingSellingEntityBankAccount[] | null | undefined,
): string | null {
  if (!Array.isArray(accounts)) return null
  const nonempty = accounts.filter(
    (a): a is AccountingSellingEntityBankAccount =>
      Boolean(a && typeof a === 'object' && typeof a.accountNumber === 'string' && a.accountNumber.trim().length > 0),
  )
  if (nonempty.length === 1) return nonempty[0].accountNumber.trim()
  const defaults = nonempty.filter((a) => a.isDefault === true)
  if (defaults.length === 1) return defaults[0].accountNumber.trim()
  return null
}

/**
 * Pełne dane spółki sprzedającej (GET z id) — autouzupełnianie faktury.
 */
export async function readSellingEntitySnapshot(entityId: string): Promise<SellingEntitySnapshot | null> {
  const params = new URLSearchParams({ id: entityId, pageSize: '1', page: '1' })
  const call = await apiCall<ListResponse>(`/api/accounting/selling-entities?${params.toString()}`)
  if (!call.ok) return null
  const items = Array.isArray(call.result?.items) ? call.result.items : []
  const row = items[0]
  if (!row || typeof row !== 'object') return null
  const id = typeof row.id === 'string' ? row.id : ''
  if (!id) return null
  const name = typeof row.name === 'string' && row.name.trim() ? row.name.trim() : id
  const nip = typeof row.nip === 'string' ? row.nip.trim() : ''
  const regon = typeof row.regon === 'string' ? row.regon.trim() : ''
  const address = typeof row.address === 'string' ? row.address.trim() : ''

  const bankAccountsNormalized =
    coerceBankAccountsJson(row.bankAccounts) ??
    (Array.isArray(row.bankAccounts) ? (row.bankAccounts as AccountingSellingEntityBankAccount[]) : null)

  const bankAccountNumbers = toBankAccountNumbers(bankAccountsNormalized)
  const picked = pickSuggestedSellerBankAccount(bankAccountsNormalized)
  const canon =
    picked != null && picked.trim().length > 0
      ? canonicalBankAccountForSelect(picked, bankAccountNumbers)
      : ''
  const suggestedPaymentBankAccount = canon.length > 0 ? canon : null

  return {
    entityId: id,
    name,
    nip,
    regon,
    address,
    bankAccountNumbers,
    suggestedPaymentBankAccount,
  }
}
