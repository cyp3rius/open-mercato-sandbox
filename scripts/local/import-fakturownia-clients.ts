/**
 * Local-only Fakturownia clients → Open Mercato CRM import / backfill.
 * Do NOT commit. Default is dry-run; pass --apply to write.
 *
 * Usage:
 *   yarn tsx scripts/local/import-fakturownia-clients.ts --file ~/Downloads/….xls
 *   yarn tsx scripts/local/import-fakturownia-clients.ts --file … --apply
 *   yarn tsx scripts/local/import-fakturownia-clients.ts --file … --backfill --apply
 *   yarn tsx scripts/local/import-fakturownia-clients.ts --file … --backfill --apply --force-mf
 *
 * Requires: python3 + xlrd (e.g. /tmp/xls-venv).
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { config as loadDotenv } from 'dotenv'
import type { EntityManager } from '@mikro-orm/postgresql'
import { bootstrapFromAppRoot } from '@open-mercato/shared/lib/bootstrap/dynamicLoader'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { isValidPhoneNumber } from '@open-mercato/shared/lib/phone'
import { isValidNip, normalizeNipDigits } from '@open-mercato/shared/lib/pl/nip'
import {
  CustomerAddress,
  CustomerCompanyProfile,
  CustomerEntity,
  CustomerPersonProfile,
} from '@open-mercato/core/modules/customers/data/entities'
import { isValidPesel, normalizePeselDigits } from '@open-mercato/core/modules/customers/lib/pesel'
import { normalizeIbanForStorage } from '../../packages/core/src/modules/customers/lib/iban'
import {
  fetchCompanyFromMfVatRegistry,
  type MfRegistryCompanyData,
} from '@open-mercato/core/modules/customers/lib/mfVatRegistry'

type ParsedRow = {
  rowNumber: number
  fakturowniaId: string
  shortName: string
  clientName: string
  taxIdRaw: string
  taxIdDigits: string
  city: string
  postalCode: string
  street: string
  country: string
  correspondenceAddress: string
  isCompanyFlag: boolean
  email: string
  website: string
  phone: string
  mobile: string
  fax: string
  firstName: string
  lastName: string
  bankName: string
  bankAccount: string
  bankAccountSuffix: string
  extraDescription: string
  clientCode: string
  role: string
}

type Kind = 'company' | 'person'

type PlannedRecord = {
  rowNumber: number
  kind: Kind
  fakturowniaId: string
  displayName: string
  payload: {
    displayName: string
    legalName?: string
    firstName?: string
    lastName?: string
    primaryEmail?: string
    primaryPhone?: string
    websiteUrl?: string
    description?: string
    nip?: string
    regon?: string
    bankName?: string
    iban?: string
    pesel?: string
    residenceStreet?: string
    residencePostalCode?: string
    residenceCity?: string
    residenceCountry?: string
  }
  address: null | {
    addressLine1: string
    city?: string
    postalCode?: string
    country?: string
  }
  needsMf: boolean
  skipReason?: string
  warnings: string[]
}

const DEFAULT_XLS = '/Users/mziarko/Downloads/slaweksuder-clients-1788847564.xls'
const DEFAULT_TENANT_ID = '76fcb140-7026-487c-98aa-de90539f795c'
const DEFAULT_ORG_ID = 'ad539bfb-1847-4801-8937-c42ec76fa94d'
const SOURCE = 'fakturownia'
const MF_THROTTLE_MS = 250

const SKIP_NAME_PATTERNS = [/^brak\s+nabywcy/i, /^nabywca\s+oddział/i]

function parseArgs(argv: string[]) {
  const out: Record<string, string | boolean> = {}
  for (let i = 0; i < argv.length; i += 1) {
    const part = argv[i]
    if (!part?.startsWith('--')) continue
    const eq = part.indexOf('=')
    if (eq !== -1) {
      out[part.slice(2, eq)] = part.slice(eq + 1)
      continue
    }
    const key = part.slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      out[key] = next
      i += 1
    } else {
      out[key] = true
    }
  }
  return out
}

function asString(value: string | boolean | undefined, fallback = ''): string {
  if (typeof value === 'string' && value.trim()) return value.trim()
  return fallback
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeCountryIso(country: string): string | undefined {
  const raw = country.trim()
  if (!raw) return undefined
  const lower = raw.toLowerCase()
  if (lower === 'polska' || lower === 'poland' || lower === 'pl') return 'PL'
  if (/^[a-z]{2}$/i.test(raw)) return raw.toUpperCase()
  return undefined
}

function normalizePhone(raw: string): { phone?: string; warning?: string } {
  const trimmed = raw.trim()
  if (!trimmed) return {}
  if (isValidPhoneNumber(trimmed)) return { phone: trimmed }

  const digits = trimmed.replace(/\D/g, '')
  let candidate = ''
  if (digits.startsWith('48') && digits.length >= 11) candidate = `+${digits}`
  else if (digits.startsWith('0') && digits.length >= 10) candidate = `+48${digits.slice(1)}`
  else if (digits.length >= 7) candidate = `+48${digits}`

  if (candidate && isValidPhoneNumber(candidate)) return { phone: candidate }
  return { warning: `Pominięto telefon (nieprzechodzi walidacji OM): ${trimmed}` }
}

function normalizeEmail(raw: string): { email?: string; warning?: string } {
  const email = raw.trim().toLowerCase()
  if (!email) return {}
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { warning: `Pominięto e-mail (nieprawidłowy): ${raw}` }
  }
  return { email }
}

function normalizeWebsite(raw: string): { websiteUrl?: string; warning?: string } {
  const trimmed = raw.trim()
  if (!trimmed) return {}
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(withProtocol)
    if (!url.hostname.includes('.')) {
      return { warning: `Pominięto stronę WWW (nieprawidłowa): ${raw}` }
    }
    return { websiteUrl: url.toString() }
  } catch {
    return { warning: `Pominięto stronę WWW (nieprawidłowa): ${raw}` }
  }
}

function mapBankFields(row: ParsedRow): { bankName?: string; iban?: string } {
  const bankName = row.bankName.trim() || undefined
  const account = [row.bankAccount, row.bankAccountSuffix].filter(Boolean).join(' ').trim()
  const iban = account ? normalizeIbanForStorage(account) ?? undefined : undefined
  return { bankName, iban }
}

function buildDescription(row: ParsedRow, omitBank: boolean): string | undefined {
  const parts: string[] = []
  parts.push(`fakturowniaId:${row.fakturowniaId}`)
  if (row.clientCode) parts.push(`clientCode:${row.clientCode}`)
  if (!omitBank && (row.bankName || row.bankAccount)) {
    parts.push(
      `bank:${[row.bankName, row.bankAccount, row.bankAccountSuffix].filter(Boolean).join(' | ')}`,
    )
  }
  if (row.fax) parts.push(`fax:${row.fax}`)
  if (row.correspondenceAddress) parts.push(`korespondencja:${row.correspondenceAddress}`)
  if (row.extraDescription) parts.push(row.extraDescription)
  if (row.mobile && row.phone) parts.push(`tel.kom:${row.mobile}`)
  return parts.length ? parts.join('\n') : undefined
}

function classify(row: ParsedRow): { kind: Kind } | { skip: string } {
  const name = (row.clientName || row.shortName).trim()
  if (!name) return { skip: 'Brak nazwy klienta' }
  if (SKIP_NAME_PATTERNS.some((re) => re.test(name))) {
    return { skip: `Pominięto wiersz-śmieć: ${name.slice(0, 60)}` }
  }

  const digits = row.taxIdDigits
  if (digits.length === 10) {
    const nip = normalizeNipDigits(digits)
    if (!nip || !isValidNip(nip)) return { skip: `Nieprawidłowy NIP: ${digits}` }
    return { kind: 'company' }
  }
  if (digits.length === 11) {
    const pesel = normalizePeselDigits(digits)
    if (!pesel || !isValidPesel(pesel)) return { skip: `Nieprawidłowy PESEL: ${digits}` }
    return { kind: 'person' }
  }
  if (row.firstName && row.lastName) return { kind: 'person' }
  if (row.isCompanyFlag) return { kind: 'company' }
  return { skip: 'Brak NIP/PESEL i brak Imię+Nazwisko' }
}

function splitPersonName(row: ParsedRow): { firstName: string; lastName: string } {
  if (row.firstName && row.lastName) {
    return { firstName: row.firstName.slice(0, 120), lastName: row.lastName.slice(0, 120) }
  }
  const full = (row.clientName || row.shortName).trim()
  const parts = full.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return { firstName: parts[0]!.slice(0, 120), lastName: '-' }
  return {
    firstName: parts[0]!.slice(0, 120),
    lastName: parts.slice(1).join(' ').slice(0, 120),
  }
}

function buildAddress(row: ParsedRow): PlannedRecord['address'] {
  const line1 = row.street.trim()
  if (!line1) return null
  return {
    addressLine1: line1.slice(0, 300),
    city: row.city.trim() ? row.city.trim().slice(0, 150) : undefined,
    postalCode: row.postalCode.trim() ? row.postalCode.trim().slice(0, 30) : undefined,
    country: row.country.trim() ? row.country.trim().slice(0, 150) : undefined,
  }
}

function companyNeedsMf(row: ParsedRow, nip?: string): boolean {
  if (!nip) return false
  return !row.street.trim() || !row.city.trim() || !row.postalCode.trim() || !(row.shortName || row.clientName).trim()
}

function planRow(row: ParsedRow): PlannedRecord {
  const warnings: string[] = []
  const classified = classify(row)
  if ('skip' in classified) {
    return {
      rowNumber: row.rowNumber,
      kind: 'company',
      fakturowniaId: row.fakturowniaId,
      displayName: row.clientName || row.shortName || `(row ${row.rowNumber})`,
      payload: { displayName: '' },
      address: null,
      needsMf: false,
      skipReason: classified.skip,
      warnings,
    }
  }

  const emailInfo = normalizeEmail(row.email)
  if (emailInfo.warning) warnings.push(emailInfo.warning)
  const phoneInfo = normalizePhone(row.phone || row.mobile)
  if (phoneInfo.warning) warnings.push(phoneInfo.warning)
  const websiteInfo = normalizeWebsite(row.website)
  if (websiteInfo.warning) warnings.push(websiteInfo.warning)

  const bank = mapBankFields(row)
  const description = buildDescription(row, Boolean(bank.bankName || bank.iban))
  const address = buildAddress(row)
  const displayName = (row.clientName || row.shortName).trim().slice(0, 200)

  if (classified.kind === 'company') {
    const nip =
      row.taxIdDigits.length === 10 && isValidNip(row.taxIdDigits) ? row.taxIdDigits : undefined
    const legalName = (row.shortName || row.clientName).trim().slice(0, 200) || undefined
    return {
      rowNumber: row.rowNumber,
      kind: 'company',
      fakturowniaId: row.fakturowniaId,
      displayName,
      warnings,
      address,
      needsMf: companyNeedsMf(row, nip),
      payload: {
        displayName,
        legalName,
        primaryEmail: emailInfo.email,
        primaryPhone: phoneInfo.phone,
        websiteUrl: websiteInfo.websiteUrl,
        description,
        nip,
        bankName: bank.bankName,
        iban: bank.iban,
      },
    }
  }

  const { firstName, lastName } = splitPersonName(row)
  const pesel =
    row.taxIdDigits.length === 11 && isValidPesel(row.taxIdDigits) ? row.taxIdDigits : undefined
  const countryIso = normalizeCountryIso(row.country)
  if (row.country && !countryIso) {
    warnings.push(`Kraj nie zmapowany do ISO-2 (residenceCountry pominięte): ${row.country}`)
  }

  return {
    rowNumber: row.rowNumber,
    kind: 'person',
    fakturowniaId: row.fakturowniaId,
    displayName: displayName || `${firstName} ${lastName}`.trim(),
    warnings,
    address,
    needsMf: false,
    payload: {
      displayName: displayName || `${firstName} ${lastName}`.trim(),
      firstName,
      lastName,
      primaryEmail: emailInfo.email,
      primaryPhone: phoneInfo.phone,
      description,
      pesel,
      residenceStreet: row.street.trim() || undefined,
      residencePostalCode: row.postalCode.trim() || undefined,
      residenceCity: row.city.trim() || undefined,
      residenceCountry: countryIso,
    },
  }
}

function parseXls(filePath: string): ParsedRow[] {
  const parser = path.resolve(__dirname, 'parse-fakturownia-xls.py')
  const pythonCandidates = ['/tmp/xls-venv/bin/python', process.env.PYTHON, 'python3'].filter(
    Boolean,
  ) as string[]

  let lastError = ''
  for (const python of pythonCandidates) {
    const result = spawnSync(python, [parser, filePath], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    })
    if (result.status === 0 && result.stdout) {
      return (JSON.parse(result.stdout) as { rows: ParsedRow[] }).rows
    }
    lastError = result.stderr || result.error?.message || `exit ${result.status}`
  }
  throw new Error(`Nie udało się odczytać XLS. Ostatni błąd: ${lastError}`)
}

function applyMfToCompanyPayload(
  plan: PlannedRecord,
  mf: MfRegistryCompanyData,
  forceMf: boolean,
): void {
  if (!plan.payload.legalName || forceMf) {
    if (mf.legalName) plan.payload.legalName = mf.legalName.slice(0, 200)
  }
  if ((!plan.payload.displayName || forceMf) && mf.displayName) {
    plan.payload.displayName = mf.displayName.slice(0, 200)
    plan.displayName = plan.payload.displayName
  }
  if ((!plan.payload.regon || forceMf) && mf.regon) plan.payload.regon = mf.regon
  if ((!plan.address || forceMf) && mf.addressLine1) {
    plan.address = {
      addressLine1: mf.addressLine1.slice(0, 300),
      city: mf.city?.slice(0, 150) || undefined,
      postalCode: mf.postalCode?.slice(0, 30) || undefined,
      country: (mf.country || 'Polska').slice(0, 150),
    }
  } else if (plan.address && !forceMf) {
    if (!plan.address.city && mf.city) plan.address.city = mf.city.slice(0, 150)
    if (!plan.address.postalCode && mf.postalCode) plan.address.postalCode = mf.postalCode.slice(0, 30)
    if (!plan.address.country && mf.country) plan.address.country = mf.country.slice(0, 150)
  }
}

async function enrichWithMf(plans: PlannedRecord[], forceMf: boolean, apply: boolean): Promise<void> {
  const targets = plans.filter((p) => !p.skipReason && p.kind === 'company' && (p.needsMf || forceMf) && p.payload.nip)
  console.log(`MF lookup candidates: ${targets.length}`)
  for (const plan of targets) {
    try {
      if (!apply && !forceMf) {
        // Still fetch in dry-run so logs show what would be filled; throttle either way.
      }
      const mf = await fetchCompanyFromMfVatRegistry({ nip: plan.payload.nip })
      await sleep(MF_THROTTLE_MS)
      if (!mf) {
        plan.warnings.push(`MF: brak danych dla NIP ${plan.payload.nip}`)
        continue
      }
      applyMfToCompanyPayload(plan, mf, forceMf)
      console.log(`MF ok row ${plan.rowNumber} nip=${plan.payload.nip} → ${mf.legalName}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      plan.warnings.push(`MF error: ${message}`)
      console.warn(`MF fail row ${plan.rowNumber}: ${message}`)
      await sleep(MF_THROTTLE_MS)
    }
  }
}

async function findExisting(
  em: EntityManager,
  tenantId: string,
  organizationId: string,
  plan: PlannedRecord,
): Promise<{ entity: CustomerEntity; profile: CustomerCompanyProfile | CustomerPersonProfile | null; via: string } | null> {
  if (plan.kind === 'company' && plan.payload.nip) {
    const profile = await em.findOne(
      CustomerCompanyProfile,
      {
        tenantId,
        organizationId,
        nip: plan.payload.nip,
        entity: { deletedAt: null },
      },
      { populate: ['entity'] },
    )
    if (profile) {
      const entity = typeof profile.entity === 'object' ? profile.entity : await em.findOneOrFail(CustomerEntity, profile.entity)
      return { entity, profile, via: `nip=${plan.payload.nip}` }
    }
  }
  if (plan.kind === 'person' && plan.payload.pesel) {
    const profile = await em.findOne(
      CustomerPersonProfile,
      {
        tenantId,
        organizationId,
        pesel: plan.payload.pesel,
        entity: { deletedAt: null },
      },
      { populate: ['entity'] },
    )
    if (profile) {
      const entity = typeof profile.entity === 'object' ? profile.entity : await em.findOneOrFail(CustomerEntity, profile.entity)
      return { entity, profile, via: `pesel=${plan.payload.pesel}` }
    }
  }

  const marker = `fakturowniaId:${plan.fakturowniaId}`
  if (plan.fakturowniaId) {
    const existing = await em.findOne(CustomerEntity, {
      tenantId,
      organizationId,
      deletedAt: null,
      kind: plan.kind,
      source: SOURCE,
      description: { $like: `%${marker}%` },
    })
    if (existing) {
      const profile =
        plan.kind === 'company'
          ? await em.findOne(CustomerCompanyProfile, { entity: existing })
          : await em.findOne(CustomerPersonProfile, { entity: existing })
      return { entity: existing, profile, via: marker }
    }
  }
  return null
}

async function upsertBillingAddress(
  em: EntityManager,
  tenantId: string,
  organizationId: string,
  entity: CustomerEntity,
  address: NonNullable<PlannedRecord['address']>,
  forceMf: boolean,
): Promise<boolean> {
  const existing = await em.findOne(CustomerAddress, {
    entity,
    purpose: 'billing',
  })
  if (existing) {
    if (!forceMf) {
      let changed = false
      if (!existing.addressLine1 && address.addressLine1) {
        existing.addressLine1 = address.addressLine1
        changed = true
      }
      if (!existing.city && address.city) {
        existing.city = address.city
        changed = true
      }
      if (!existing.postalCode && address.postalCode) {
        existing.postalCode = address.postalCode
        changed = true
      }
      if (!existing.country && address.country) {
        existing.country = address.country
        changed = true
      }
      if (changed) {
        existing.updatedAt = new Date()
        await em.flush()
        return true
      }
      return false
    }
    existing.addressLine1 = address.addressLine1
    existing.city = address.city ?? null
    existing.postalCode = address.postalCode ?? null
    existing.country = address.country ?? null
    existing.updatedAt = new Date()
    await em.flush()
    return true
  }

  const now = new Date()
  em.persist(
    em.create(CustomerAddress, {
      organizationId,
      tenantId,
      entity,
      name: 'Główny',
      purpose: 'billing',
      addressLine1: address.addressLine1,
      city: address.city ?? null,
      postalCode: address.postalCode ?? null,
      country: address.country ?? null,
      isPrimary: true,
      createdAt: now,
      updatedAt: now,
    }),
  )
  await em.flush()
  return true
}

async function createOne(
  em: EntityManager,
  tenantId: string,
  organizationId: string,
  plan: PlannedRecord,
): Promise<string> {
  const now = new Date()
  if (plan.kind === 'company') {
    const entity = em.create(CustomerEntity, {
      organizationId,
      tenantId,
      kind: 'company',
      crmRecordType: 'customer',
      displayName: plan.payload.displayName,
      description: plan.payload.description ?? null,
      primaryEmail: plan.payload.primaryEmail ?? null,
      primaryPhone: plan.payload.primaryPhone ?? null,
      status: 'customer',
      source: SOURCE,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    const profile = em.create(CustomerCompanyProfile, {
      organizationId,
      tenantId,
      entity,
      legalName: plan.payload.legalName ?? null,
      brandName: null,
      domain: null,
      websiteUrl: plan.payload.websiteUrl ?? null,
      industry: null,
      sizeBucket: null,
      annualRevenue: null,
      nip: plan.payload.nip ?? null,
      regon: plan.payload.regon ?? null,
      bankName: plan.payload.bankName ?? null,
      iban: plan.payload.iban ?? null,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(entity)
    em.persist(profile)
    await em.flush()
    if (plan.address) {
      await upsertBillingAddress(em, tenantId, organizationId, entity, plan.address, false)
    }
    return entity.id
  }

  const entity = em.create(CustomerEntity, {
    organizationId,
    tenantId,
    kind: 'person',
    crmRecordType: 'customer',
    displayName: plan.payload.displayName,
    description: plan.payload.description ?? null,
    primaryEmail: plan.payload.primaryEmail ?? null,
    primaryPhone: plan.payload.primaryPhone ?? null,
    status: 'customer',
    source: SOURCE,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  })
  const profile = em.create(CustomerPersonProfile, {
    organizationId,
    tenantId,
    entity,
    firstName: plan.payload.firstName ?? null,
    lastName: plan.payload.lastName ?? null,
    pesel: plan.payload.pesel ?? null,
    residenceStreet: plan.payload.residenceStreet ?? null,
    residencePostalCode: plan.payload.residencePostalCode ?? null,
    residenceCity: plan.payload.residenceCity ?? null,
    residenceCountry: plan.payload.residenceCountry ?? null,
    createdAt: now,
    updatedAt: now,
  })
  em.persist(entity)
  em.persist(profile)
  await em.flush()
  if (plan.address) {
    await upsertBillingAddress(em, tenantId, organizationId, entity, plan.address, false)
  }
  return entity.id
}

async function backfillOne(
  em: EntityManager,
  tenantId: string,
  organizationId: string,
  plan: PlannedRecord,
  existing: { entity: CustomerEntity; profile: CustomerCompanyProfile | CustomerPersonProfile | null },
  forceMf: boolean,
): Promise<{ updated: boolean; address: boolean }> {
  let updated = false
  let addressChanged = false
  const { entity, profile } = existing

  if (plan.kind === 'company' && profile) {
    const companyProfile = profile as CustomerCompanyProfile
    if (plan.payload.bankName && (!companyProfile.bankName || forceMf)) {
      companyProfile.bankName = plan.payload.bankName
      updated = true
    }
    if (plan.payload.iban && (!companyProfile.iban || forceMf)) {
      companyProfile.iban = plan.payload.iban
      updated = true
    }
    if (plan.payload.regon && (!companyProfile.regon || forceMf)) {
      companyProfile.regon = plan.payload.regon
      updated = true
    }
    if (plan.payload.legalName && (!companyProfile.legalName || forceMf)) {
      companyProfile.legalName = plan.payload.legalName
      updated = true
    }
    if (plan.payload.displayName && (!entity.displayName || forceMf)) {
      entity.displayName = plan.payload.displayName
      updated = true
    }
    if (updated) {
      companyProfile.updatedAt = new Date()
      entity.updatedAt = new Date()
      await em.flush()
    }
  }

  if (plan.address) {
    addressChanged = await upsertBillingAddress(em, tenantId, organizationId, entity, plan.address, forceMf)
  }

  return { updated: updated || addressChanged, address: addressChanged }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const apply = args.apply === true || args.apply === 'true'
  const backfill = args.backfill === true || args.backfill === 'true'
  const forceMf = args['force-mf'] === true || args['force-mf'] === 'true'
  const filePath = path.resolve(asString(args.file, DEFAULT_XLS))
  const tenantId = asString(args.tenant ?? args.tenantId, DEFAULT_TENANT_ID)
  const organizationId = asString(args.org ?? args.orgId ?? args.organizationId, DEFAULT_ORG_ID)
  const limit = Number.parseInt(asString(args.limit, '0'), 10) || 0

  if (!fs.existsSync(filePath)) throw new Error(`Brak pliku: ${filePath}`)

  const rows = parseXls(filePath)
  let plans = rows.map((row) => planRow(row))
  if (limit > 0) plans = plans.slice(0, limit)

  const toProcess = plans.filter((p) => !p.skipReason)
  const skipped = plans.filter((p) => p.skipReason)
  const companies = toProcess.filter((p) => p.kind === 'company')
  const people = toProcess.filter((p) => p.kind === 'person')

  console.log('=== Fakturownia → Open Mercato (klienci) ===')
  console.log(`Plik: ${filePath}`)
  console.log(`Tenant: ${tenantId}`)
  console.log(`Org:    ${organizationId}`)
  console.log(
    `Tryb:   ${apply ? 'APPLY' : 'DRY-RUN'}${backfill ? ' + BACKFILL' : ''}${forceMf ? ' + FORCE-MF' : ''}`,
  )
  console.log(`Wiersze XLS: ${rows.length}`)
  console.log(`Do przetworzenia: ${toProcess.length} (firmy=${companies.length}, osoby=${people.length})`)
  console.log(`Pominięte: ${skipped.length}`)
  console.log(`Firmy z kandydatem MF: ${companies.filter((c) => c.needsMf).length}`)

  if (skipped.length) {
    console.log('\nPominięte (max 20):')
    for (const s of skipped.slice(0, 20)) console.log(`  row ${s.rowNumber}: ${s.skipReason}`)
  }

  const repoRoot = path.resolve(__dirname, '../..')
  loadDotenv({ path: path.join(repoRoot, 'apps/mercato/.env') })
  const appRoot = path.join(repoRoot, 'apps/mercato')
  process.chdir(appRoot)
  await bootstrapFromAppRoot(appRoot)

  await enrichWithMf(toProcess, forceMf, apply)

  const container = await createRequestContainer()
  const em = (container.resolve('em') as EntityManager).fork()

  let created = 0
  let backfilled = 0
  let existed = 0
  let failed = 0
  let addresses = 0

  try {
    for (const plan of toProcess) {
      try {
        const existing = await findExisting(em, tenantId, organizationId, plan)

        if (existing && backfill) {
          if (!apply) {
            console.log(
              `DRY backfill ${plan.kind} row ${plan.rowNumber} ${plan.displayName}` +
                (plan.payload.iban ? ` iban=yes` : '') +
                (plan.payload.regon ? ` regon=${plan.payload.regon}` : '') +
                (plan.address ? ` addr=yes` : ''),
            )
            continue
          }
          const result = await backfillOne(em, tenantId, organizationId, plan, existing, forceMf)
          if (result.updated) {
            backfilled += 1
            if (result.address) addresses += 1
            console.log(`BF  ${plan.kind} row ${plan.rowNumber} → ${existing.entity.id} ${plan.displayName}`)
          } else {
            existed += 1
            console.log(`SKIP unchanged row ${plan.rowNumber} ${plan.displayName} (${existing.via})`)
          }
          continue
        }

        if (existing) {
          existed += 1
          console.log(
            `SKIP existing row ${plan.rowNumber} ${plan.kind} ${plan.displayName} (${existing.via})`,
          )
          continue
        }

        if (backfill) {
          // Backfill-only: do not create missing records unless also importing.
          console.log(`SKIP missing (backfill-only) row ${plan.rowNumber} ${plan.displayName}`)
          continue
        }

        if (!apply) {
          console.log(
            `DRY ${plan.kind.padEnd(7)} row ${String(plan.rowNumber).padStart(3)} ${plan.displayName}` +
              (plan.payload.nip ? ` nip=${plan.payload.nip}` : '') +
              (plan.payload.pesel ? ` pesel=${plan.payload.pesel}` : '') +
              (plan.payload.iban ? ` iban=yes` : '') +
              (plan.needsMf ? ` mf` : ''),
          )
          continue
        }

        const entityId = await createOne(em, tenantId, organizationId, plan)
        if (plan.address) addresses += 1
        created += 1
        console.log(`OK  ${plan.kind} row ${plan.rowNumber} → ${entityId} ${plan.displayName}`)
      } catch (err) {
        failed += 1
        em.clear()
        const message = err instanceof Error ? err.message : String(err)
        console.error(`FAIL row ${plan.rowNumber} ${plan.displayName}: ${message}`)
      }
    }
  } finally {
    const disposable = container as unknown as { dispose?: () => Promise<void> }
    if (typeof disposable.dispose === 'function') await disposable.dispose()
  }

  console.log('\n=== Podsumowanie ===')
  console.log(`Utworzone:  ${created}`)
  console.log(`Backfill:   ${backfilled}`)
  console.log(`Adresy:     ${addresses}`)
  console.log(`Bez zmian:  ${existed}`)
  console.log(`Błędy:      ${failed}`)
  console.log(`Pominięte:  ${skipped.length}`)
  if (!apply) console.log('\nTo był dry-run. Uruchom ponownie z --apply, żeby zapisać do bazy.')
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
