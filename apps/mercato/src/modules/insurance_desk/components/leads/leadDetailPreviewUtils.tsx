"use client"

import * as React from 'react'
import type { TranslateFn } from '@open-mercato/shared/lib/i18n/context'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { cn } from '@open-mercato/shared/lib/utils'
import { Badge } from '@open-mercato/ui/primitives/badge'
import { ProtectionCatalogLucideIcon } from '../../lib/catalogLucideIcon'
import {
  normalizeCoveragesValue,
  POLICY_COVERAGE_KEYS,
  type PolicyCoverageKey,
} from '../policies/PolicyCoveragesField'
import { emptyCoverageOptionsValue, type CoverageOptionsFormValue } from '../policies/PolicyCoverageOptionsField'
import { emptyLeadUsageForm, type LeadUsageFormValue } from '../../lib/leadUsageForm'
import { emptyLeadContactForm, type LeadContactFormValue } from '../../lib/leadContactForm'
import {
  emptyVehicleFields,
  type InsuranceSubjectVehicle,
} from '../policies/PolicySubjectField'

function normUsage(raw: unknown): LeadUsageFormValue {
  return { ...emptyLeadUsageForm(), ...(raw && typeof raw === 'object' ? (raw as object) : {}) }
}

function normCovOpt(raw: unknown): CoverageOptionsFormValue {
  const base = emptyCoverageOptionsValue()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  for (const key of Object.keys(base) as (keyof CoverageOptionsFormValue)[]) {
    const v = o[key]
    if (typeof base[key] === 'boolean') {
      ;(base as Record<string, unknown>)[key] = Boolean(v)
    } else if (typeof base[key] === 'string') {
      ;(base as Record<string, unknown>)[key] = typeof v === 'string' ? v : ''
    }
  }
  return base
}

function normContact(raw: unknown): LeadContactFormValue {
  return { ...emptyLeadContactForm(), ...(raw && typeof raw === 'object' ? (raw as object) : {}) }
}

function normVehicle(raw: unknown): InsuranceSubjectVehicle {
  const base = emptyVehicleFields()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  for (const k of Object.keys(base) as (keyof InsuranceSubjectVehicle)[]) {
    if (typeof o[k] === 'string') base[k] = o[k]
  }
  return base
}

export function PreviewFieldCell({ label, value }: { label: string; value: React.ReactNode }) {
  const empty =
    value === null ||
    value === undefined ||
    value === '' ||
    (typeof value === 'string' && !value.trim().length)
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="text-xs font-semibold leading-tight text-foreground">{label}</div>
      <div className="break-words text-sm leading-snug text-muted-foreground">{empty ? '—' : value}</div>
    </div>
  )
}

export function PreviewFieldGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn('grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3', className)}
    >
      {children}
    </div>
  )
}

function PreviewSubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      {children}
    </div>
  )
}

function PreviewEmpty({ t }: { t: TranslateFn }) {
  return <p className="text-sm text-muted-foreground">{t('insurance_desk.leads.detail.previewEmpty', 'No data.')}</p>
}

export function LeadUsagePreviewLines({ leadUsage, t }: { leadUsage: unknown; t: TranslateFn }) {
  const u = normUsage(leadUsage)
  if (!u.type) {
    return <PreviewEmpty t={t} />
  }

  const yn = (v: boolean | null) => {
    if (v === true) return t('common.yes', 'Yes')
    if (v === false) return t('common.no', 'No')
    return '—'
  }

  const usageBasics = (
    <PreviewFieldGrid>
      <PreviewFieldCell
        label={t('insurance_desk.leads.usage.previewUsageKind', 'Usage')}
        value={
          u.type === 'private'
            ? t('insurance_desk.leads.usage.private', 'Private')
            : t('insurance_desk.leads.usage.business', 'Business')
        }
      />
      {u.type === 'business' ? (
        <PreviewFieldCell
          label={t('insurance_desk.leads.usage.financingLabel', 'Financing')}
          value={
            u.financing === 'leasing'
              ? t('insurance_desk.leads.usage.leasing', 'Leasing')
              : u.financing === 'own'
                ? t('insurance_desk.leads.usage.own', 'Cash / own funds')
                : '—'
          }
        />
      ) : null}
      {u.type === 'business' && u.financing === 'leasing' ? (
        <PreviewFieldCell
          label={t('insurance_desk.leads.usage.leasingCompany', 'Leasing company')}
          value={u.leasingCompany.trim()}
        />
      ) : null}
    </PreviewFieldGrid>
  )

  const drivers = (
    <PreviewFieldGrid>
      <PreviewFieldCell
        label={t('insurance_desk.leads.usage.under25', 'Regular driver under 25')}
        value={yn(u.under25)}
      />
      <PreviewFieldCell
        label={t('insurance_desk.leads.usage.licenseShort', 'Licence held under 2 years')}
        value={yn(u.licenseShort)}
      />
    </PreviewFieldGrid>
  )

  return (
    <div className="space-y-6">
      <div>{usageBasics}</div>
      <PreviewSubSection title={t('insurance_desk.leads.usage.driversSection', 'Drivers')}>
        {drivers}
      </PreviewSubSection>
    </div>
  )
}

export type ProtectionCatalogEntry = {
  value: string
  label: string
  description: string
  icon?: string
  mapsToCoverageKey?: string
  additionalOptionsLabel?: string
  additionalOptions: Array<{ value: string; name: string }>
  fields: Array<{
    id: string
    label: string
    propertyKey: string
    type: 'text' | 'number' | 'currency' | 'checkbox'
    required?: boolean
  }>
}

export type ProtectionCatalog = { options: ProtectionCatalogEntry[] }

function isCoverageKey(s: string): s is PolicyCoverageKey {
  return (POLICY_COVERAGE_KEYS as readonly string[]).includes(s)
}

export function resolveCoverageKey(entry: ProtectionCatalogEntry): PolicyCoverageKey | null {
  const raw = entry.mapsToCoverageKey?.trim().length ? entry.mapsToCoverageKey : entry.value
  return isCoverageKey(raw) ? raw : null
}

export function formatDetailValue(
  field: ProtectionCatalogEntry['fields'][0],
  raw: unknown,
  t: TranslateFn,
): string | null {
  if (field.type === 'checkbox') {
    if (raw === true) return t('common.yes', 'Yes')
    if (raw === false) return t('common.no', 'No')
    return null
  }
  if (field.type === 'currency' && raw && typeof raw === 'object' && 'amount' in (raw as object)) {
    const a = String((raw as { amount?: unknown }).amount ?? '').trim()
    const c = String((raw as { currency?: unknown }).currency ?? 'PLN').trim()
    if (!a.length) return null
    return `${a} ${c}`
  }
  if (typeof raw === 'string' || typeof raw === 'number') {
    const s = String(raw).trim()
    return s.length ? s : null
  }
  return null
}

export function LeadCoveragesCatalogPreview({
  coverages,
  coverageSubSelections,
  coverageDetailValues,
}: {
  coverages: unknown
  coverageSubSelections: Record<string, string>
  coverageDetailValues: Record<string, Record<string, unknown>>
}) {
  const t = useT()
  const [catalog, setCatalog] = React.useState<ProtectionCatalog | null>(null)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      const call = await apiCall<ProtectionCatalog>('/api/insurance/config-protection-catalog')
      if (cancelled) return
      if (!call.ok || !call.result?.options) {
        setLoadError(t('insurance_desk.leads.coverage.catalogError', 'Could not load protection catalog.'))
        setCatalog(null)
        return
      }
      setLoadError(null)
      setCatalog(call.result)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [t])

  const cov = normalizeCoveragesValue(coverages)

  if (loadError || !catalog) {
    return <p className="text-sm text-muted-foreground">{loadError ?? t('common.loading', 'Loading…')}</p>
  }

  const pills: React.ReactNode[] = []
  for (const entry of catalog.options) {
    const covKey = resolveCoverageKey(entry)
    if (!covKey) continue
    const line = cov[covKey]
    if (!line?.enabled) continue

    const subVal = coverageSubSelections[entry.value]
    const subName = entry.additionalOptions.find((o) => o.value === subVal)?.name
    const detailStore = coverageDetailValues[entry.value] ?? {}
    const detailRows: { label: string; value: string }[] = []
    for (const f of entry.fields) {
      const formatted = formatDetailValue(f, detailStore[f.propertyKey], t)
      if (formatted) detailRows.push({ label: f.label, value: formatted })
    }
    const hasExtension = Boolean(subName?.trim().length || detailRows.length)

    const mainBadge = (
      <Badge
        variant="secondary"
        className={cn(
          'h-auto gap-2 border border-transparent px-3.5 py-1.5 text-sm font-medium leading-snug',
          hasExtension
            ? 'rounded-t-2xl sm:h-full sm:min-h-0 sm:self-stretch sm:rounded-br-none sm:rounded-tr-none sm:rounded-bl-2xl sm:rounded-tl-2xl'
            : 'rounded-2xl',
        )}
      >
        <ProtectionCatalogLucideIcon name={entry.icon} className="size-4 shrink-0" />
        <span>{entry.label}</span>
      </Badge>
    )

    const extensionBody = hasExtension ? (
      <div className="flex min-w-0 flex-col gap-1">
        {subName?.trim().length ? (
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-1.5 gap-y-0 text-[0.65rem] leading-none">
            {entry.additionalOptionsLabel?.trim().length ? (
              <span className="shrink-0 font-semibold text-muted-foreground">{entry.additionalOptionsLabel}</span>
            ) : null}
            <span className="min-w-0 font-medium text-foreground">{subName}</span>
          </div>
        ) : null}
        {detailRows.length ? (
          <div
            className={cn(
              'flex flex-col gap-0.5',
              subName?.trim().length ? 'border-t border-border/30 pt-1' : '',
            )}
          >
            {detailRows.map((row) => (
              <div
                key={row.label}
                className="flex min-w-0 max-w-full flex-wrap items-center gap-x-1.5 gap-y-0 text-[0.65rem] leading-none"
              >
                <span className="shrink-0 font-medium text-muted-foreground">{row.label}</span>
                <span className="min-w-0 text-foreground">{row.value}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    ) : null

    pills.push(
      <div key={entry.value} className="min-w-0 max-w-full w-fit">
        {hasExtension ? (
          <div className="inline-grid w-fit min-w-0 max-w-full grid-cols-1 gap-0 sm:grid-cols-[auto_auto] sm:grid-rows-1 sm:items-stretch sm:justify-items-stretch">
            {mainBadge}
            <div
              className={cn(
                'flex h-auto min-h-0 w-fit min-w-0 max-w-full flex-col items-start justify-center gap-0 self-stretch rounded-b-2xl border border-dashed border-border/80 bg-muted/35 px-2.5 py-1 text-left text-foreground sm:h-full sm:min-h-full sm:rounded-2xl sm:rounded-l-none',
              )}
            >
              {extensionBody}
            </div>
          </div>
        ) : (
          mainBadge
        )}
      </div>,
    )
  }

  if (!pills.length) {
    return <PreviewEmpty t={t} />
  }
  return <div className="flex flex-wrap gap-3">{pills}</div>
}

export function LeadCoverageOptionsPreviewLines({
  coverageOptions,
  leadUsage,
  coverages,
  t,
}: {
  coverageOptions: unknown
  leadUsage: unknown
  coverages: unknown
  t: TranslateFn
}) {
  const o = normCovOpt(coverageOptions)
  const cov = normalizeCoveragesValue(coverages)
  const hasAc = cov.AC?.enabled === true
  const hasAssist = cov.ASSISTANCE?.enabled === true
  const usageBiz = normUsage(leadUsage).type === 'business' || o.typeOfUse === 'Działalność gospodarcza'

  const yn = (b: boolean) => (b ? t('common.yes', 'Yes') : t('common.no', 'No'))

  if (!hasAc && !hasAssist) {
    return (
      <p className="text-sm text-muted-foreground">
        {t(
          'insurance_desk.leads.coverageDetails.pickCoverage',
          'Select AC and/or Assistance in “Coverage scope” to configure these preferences.',
        )}
      </p>
    )
  }

  const acBlock = hasAc ? (
    <PreviewSubSection title={t('insurance_desk.leads.coverageDetails.acSection', 'AC')}>
      <PreviewFieldGrid>
        <PreviewFieldCell
          label={t('insurance_desk.policies.form.coverageOptions.claimAssessment', 'Claim settlement')}
          value={o.claimAssessment.trim()}
        />
        <PreviewFieldCell
          label={t('insurance_desk.policies.form.coverageOptions.partsType', 'Parts')}
          value={o.partsType.trim()}
        />
        {usageBiz ? (
          <PreviewFieldCell
            label={t('insurance_desk.policies.form.coverageOptions.partsDepreciation', 'Parts depreciation')}
            value={yn(o.partsDepreciation)}
          />
        ) : null}
        <PreviewFieldCell
          label={t('insurance_desk.policies.form.coverageOptions.deductible', 'Own share')}
          value={
            o.deductible
              ? o.deductibleAmount.trim().length
                ? `${yn(true)} · ${o.deductibleAmount.trim()}`
                : yn(true)
              : yn(false)
          }
        />
        <PreviewFieldCell
          label={t('insurance_desk.policies.form.coverageOptions.fixedSum', 'Fixed sum insured')}
          value={yn(o.fixedInsuranceSum)}
        />
        <PreviewFieldCell
          label={t('insurance_desk.leads.coverageOptions.sumConsumptionLong', 'Sum consumption')}
          value={yn(o.sumConsumption)}
        />
        <PreviewFieldCell
          label={t('insurance_desk.leads.coverageOptions.insuranceFromValue', 'Insurance from value')}
          value={o.insuredValueBasis.trim()}
        />
        <div className="sm:col-span-2 lg:col-span-3">
          <PreviewFieldCell
            label={t('insurance_desk.policies.form.coverageOptions.vehicleEquipmentLong', 'Vehicle equipment')}
            value={
              o.vehicleEquipment.trim().length ? (
                <span className="whitespace-pre-wrap">{o.vehicleEquipment.trim()}</span>
              ) : (
                ''
              )
            }
          />
        </div>
      </PreviewFieldGrid>
    </PreviewSubSection>
  ) : null

  const assistBlock = hasAssist ? (
    <PreviewSubSection title={t('insurance_desk.leads.coverageDetails.assistanceSection', 'Assistance')}>
      <PreviewFieldGrid>
        <PreviewFieldCell
          label={t('insurance_desk.policies.form.coverageOptions.territorialScope', 'Territorial scope')}
          value={o.territorialScope.trim()}
        />
        <PreviewFieldCell
          label={t('insurance_desk.policies.form.coverageOptions.towingLimit', 'Towing limit')}
          value={o.towingLimit.trim()}
        />
      </PreviewFieldGrid>
    </PreviewSubSection>
  ) : null

  return (
    <div className="space-y-6">
      {acBlock}
      {assistBlock}
    </div>
  )
}

const HOLDER_PREVIEW: { key: LeadContactFormValue['holderType']; labelKey: string; fallback: string }[] = [
  { key: 'private', labelKey: 'insurance_desk.leads.contact.holder.private', fallback: 'Private person' },
  { key: 'sole', labelKey: 'insurance_desk.leads.contact.holder.sole', fallback: 'Sole proprietorship' },
  { key: 'civil', labelKey: 'insurance_desk.leads.contact.holder.civil', fallback: 'Civil partnership' },
  { key: 'llc', labelKey: 'insurance_desk.leads.contact.holder.llc', fallback: 'Limited liability company' },
]

export function LeadContactPreview({ leadContact, t }: { leadContact: unknown; t: TranslateFn }) {
  const c = normContact(leadContact)
  const cells: React.ReactNode[] = []

  const ht = HOLDER_PREVIEW.find((h) => h.key === c.holderType)
  if (ht) {
    cells.push(
      <PreviewFieldCell
        key="holder"
        label={t('insurance_desk.leads.contact.holderType', 'Contact type')}
        value={t(ht.labelKey, ht.fallback)}
      />,
    )
  }

  const push = (labelKey: string, fb: string, value: string, id: string) => {
    cells.push(<PreviewFieldCell key={id} label={t(labelKey, fb)} value={value.trim()} />)
  }

  if (c.holderType === 'private') {
    push('insurance_desk.leads.contact.fullName', 'Full name', c.fullName, 'fn')
    push('insurance_desk.leads.contact.pesel', 'PESEL', c.pesel, 'pesel')
    push('insurance_desk.leads.contact.address', 'Address', c.address, 'addr')
  }
  if (c.holderType === 'sole') {
    push('insurance_desk.leads.contact.fullName', 'Full name', c.fullName, 'fn2')
    push('insurance_desk.leads.contact.pesel', 'PESEL', c.pesel, 'pesel2')
    push('insurance_desk.leads.contact.regon', 'REGON', c.regon, 'regon')
  }
  if (c.holderType === 'civil') {
    push('insurance_desk.leads.contact.partnerNames', 'Partners (names)', c.partnerNames, 'pn')
    push('insurance_desk.leads.contact.partnerPesels', 'Partners (PESEL)', c.partnerPesels, 'pp')
    push('insurance_desk.leads.contact.regon', 'REGON', c.regon, 'regon2')
  }
  if (c.holderType === 'llc') {
    push('insurance_desk.leads.contact.companyName', 'Company name', c.companyName, 'cn')
    push('insurance_desk.leads.contact.regon', 'REGON', c.regon, 'regon3')
  }
  if (c.holderType === 'civil' || c.holderType === 'llc') {
    push('insurance_desk.leads.contact.contactPersonName', 'Contact person name', c.fullName, 'cfn')
  }
  push('insurance_desk.leads.form.contact.phone', 'Phone', c.phone, 'ph')
  push('insurance_desk.leads.form.contact.email', 'E-mail', c.email, 'em')

  if (!cells.length) {
    return <PreviewEmpty t={t} />
  }
  return <PreviewFieldGrid>{cells}</PreviewFieldGrid>
}

export function LeadVehiclePreview({ leadVehicle, t }: { leadVehicle: unknown; t: TranslateFn }) {
  const v = normVehicle(leadVehicle)
  const cells: React.ReactNode[] = []
  const add = (labelKey: string, fb: string, val: string, id: string) => {
    const s = val.trim()
    if (!s.length) return
    cells.push(<PreviewFieldCell key={id} label={t(labelKey, fb)} value={s} />)
  }
  add('insurance_desk.policies.form.subject.brandModel', 'Brand and model', v.brandAndModel, 'bm')
  add('insurance_desk.policies.form.subject.vin', 'VIN', v.vinNumber, 'vin')
  add('insurance_desk.policies.form.subject.plate', 'Registration plate', v.plateNumber, 'plate')
  add('insurance_desk.policies.form.subject.year', 'Year of manufacture', v.yearOfManufacture, 'year')
  add('insurance_desk.policies.form.subject.registrationDate', 'Registration date', v.registrationDate, 'regd')
  add('insurance_desk.policies.form.subject.milage', 'Mileage (km)', v.milage, 'mil')

  if (!cells.length) {
    return <PreviewEmpty t={t} />
  }
  return <PreviewFieldGrid>{cells}</PreviewFieldGrid>
}
