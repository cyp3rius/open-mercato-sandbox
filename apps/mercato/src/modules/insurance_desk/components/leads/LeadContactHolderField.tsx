"use client"

import * as React from 'react'
import { User, Briefcase, Users, Building } from 'lucide-react'
import { CRUD_FORM_TEXT_INPUT_CLASS, type CrudCustomFieldRenderProps } from '@open-mercato/ui/backend/CrudForm'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Label } from '@open-mercato/ui/primitives/label'
import { cn } from '@open-mercato/shared/lib/utils'
import type { LeadContactFormValue, LeadHolderType } from '../../lib/leadContactForm'
import { emptyLeadContactForm } from '../../lib/leadContactForm'
import { isValidPesel, normalizePeselDigits, validatePeselList } from '@open-mercato/core/modules/customers/lib/pesel'
import { isValidRegon, normalizeRegonDigits } from '@open-mercato/core/modules/customers/lib/regon'

const SERVER_ERR_KEYS = new Set([
  'primaryPhone',
  'primaryEmail',
  'firstName',
  'lastName',
  'displayName',
  'legalName',
  'description',
  'pesel',
  'regon',
  'nip',
  'residenceStreet',
  'residencePostalCode',
  'residenceCity',
  'residenceCountry',
  'status',
  'crmRecordType',
  'companyEntityId',
  'source',
  'lifecycleStage',
])

function joinFormErrors(
  fe: Record<string, string> | undefined,
  keys: string[],
  sep: string = ' ',
): string | undefined {
  if (!fe) return undefined
  const parts = keys.map((k) => (typeof fe[k] === 'string' ? fe[k]!.trim() : '')).filter(Boolean)
  return parts.length ? parts.join(sep) : undefined
}

function pickFormError(fe: Record<string, string> | undefined, key: string): string | undefined {
  if (!fe) return undefined
  const v = fe[key]
  return typeof v === 'string' && v.trim().length ? v.trim() : undefined
}

function normalize(raw: unknown): LeadContactFormValue {
  const base = emptyLeadContactForm()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  const ht = o.holderType
  if (ht === 'private' || ht === 'sole' || ht === 'civil' || ht === 'llc') base.holderType = ht
  for (const key of Object.keys(base) as (keyof LeadContactFormValue)[]) {
    if (key === 'holderType') continue
    const v = o[key]
    if (typeof v === 'string') (base as Record<string, unknown>)[key] = v
  }
  return base
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}

function HolderTile({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex w-full flex-col items-center justify-center gap-2 rounded-md border p-3 text-center transition-colors sm:p-4',
        active
          ? 'border-primary bg-accent/40'
          : 'border-border bg-background hover:bg-muted/50',
      )}
    >
      <Icon className={cn('h-6 w-6 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
      <span className={cn('text-sm leading-tight text-foreground', active && 'text-primary')}>
        {label}
      </span>
    </button>
  )
}

export function LeadContactHolderField(props: CrudCustomFieldRenderProps) {
  const t = useT()
  const { value, setValue, disabled, error, formErrors } = props
  const model = normalize(value)

  const fe = formErrors
  const phoneServer = pickFormError(fe, 'primaryPhone')
  const emailServer = pickFormError(fe, 'primaryEmail')
  const nameFromParts = joinFormErrors(fe, ['firstName', 'lastName'])
  const displayNameServer = pickFormError(fe, 'displayName')
  const legalNameServer = pickFormError(fe, 'legalName')
  const peselServer = pickFormError(fe, 'pesel')
  const regonServer = pickFormError(fe, 'regon')
  const addressServer = joinFormErrors(
    fe,
    ['residenceStreet', 'residencePostalCode', 'residenceCity', 'residenceCountry'],
    ' · ',
  )

  const hasServerFieldError = React.useMemo(() => {
    if (!fe) return false
    for (const k of Object.keys(fe)) {
      if (SERVER_ERR_KEYS.has(k) && fe[k] && String(fe[k]).trim().length) return true
    }
    return false
  }, [fe])

  const orphanServerMessage = React.useMemo(() => {
    if (!fe) return null
    const out: string[] = []
    for (const k of Object.keys(fe)) {
      if (SERVER_ERR_KEYS.has(k) || k === 'leadContact') continue
      const m = fe[k]
      if (typeof m === 'string' && m.trim().length) out.push(m.trim())
    }
    if (!out.length) return null
    return out.join(' · ')
  }, [fe])

  const showBlockError = Boolean(error) && !hasServerFieldError && !orphanServerMessage

  const patch = React.useCallback(
    (partial: Partial<LeadContactFormValue>) => {
      setValue({ ...normalize(value), ...partial })
    },
    [setValue, value],
  )

  const holderTypes: { key: LeadHolderType; labelKey: string; fallback: string; icon: typeof User }[] =
    React.useMemo(
      () => [
        { key: 'private', labelKey: 'insurance_desk.leads.contact.holder.private', fallback: 'Private person', icon: User },
        { key: 'sole', labelKey: 'insurance_desk.leads.contact.holder.sole', fallback: 'Sole proprietorship', icon: Briefcase },
        { key: 'civil', labelKey: 'insurance_desk.leads.contact.holder.civil', fallback: 'Civil partnership', icon: Users },
        { key: 'llc', labelKey: 'insurance_desk.leads.contact.holder.llc', fallback: 'Limited liability company', icon: Building },
      ],
      [],
    )

  const ht = model.holderType

  const peselRaw = model.pesel.trim()
  const peselDigits = peselRaw.length ? normalizePeselDigits(peselRaw) : null
  const peselInvalid =
    peselRaw.length > 0 && (!peselDigits || peselDigits.length !== 11 || !isValidPesel(peselDigits))

  const partnerPeselsRaw = model.partnerPesels.trim()
  const partnerPeselsCheck = partnerPeselsRaw.length ? validatePeselList(partnerPeselsRaw) : { ok: true as const }
  const partnerPeselsInvalid = partnerPeselsCheck.ok === false

  const regonRaw = model.regon.trim()
  const regonDigits = regonRaw.length ? normalizeRegonDigits(regonRaw) : null
  const regonInvalid =
    regonRaw.length > 0 && (!regonDigits || !isValidRegon(regonDigits))

  const privateSoleNameErr = (ht === 'private' || ht === 'sole') && (nameFromParts || displayNameServer)
  /** API zwraca first+last; dla JDG/spółek — pole „osoba kontaktowa” */
  const cfnNameErr = (ht === 'civil' || ht === 'llc') && nameFromParts
  const civilPartnerNameErr = ht === 'civil' && !nameFromParts && displayNameServer
  const llcCompanyNameErr = ht === 'llc' && (legalNameServer || (displayNameServer && !nameFromParts))

  const peselErrorBlock = peselServer || (peselInvalid ? t('customers.people.form.peselInvalid', 'Invalid PESEL.') : null)
  const regonErrorBlock = regonServer || (regonInvalid ? t('customers.companies.form.regonInvalid', 'Invalid REGON.') : null)

  return (
    <div className={cn('space-y-6', showBlockError && 'rounded-md border border-destructive/50 p-3')}>
      <div className="space-y-3">
        <Label>{t('insurance_desk.leads.contact.holderType', 'Contact type')}</Label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {holderTypes.map((row) => (
            <HolderTile
              key={row.key || 'empty'}
              icon={row.icon}
              label={t(row.labelKey, row.fallback)}
              active={ht === row.key}
              onClick={() => patch({ holderType: row.key })}
            />
          ))}
        </div>
      </div>

      {ht ? (
        <>
          <div className="space-y-4">
            <SectionLabel>
              {t(
                holderTypes.find((h) => h.key === ht)?.labelKey ?? '',
                holderTypes.find((h) => h.key === ht)?.fallback ?? '',
              )}
            </SectionLabel>
            {ht === 'private' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="lead-fn">{t('insurance_desk.leads.contact.fullName', 'Full name')}</Label>
                  <input
                    id="lead-fn"
                    className={cn(CRUD_FORM_TEXT_INPUT_CLASS, !!privateSoleNameErr && 'border-destructive')}
                    value={model.fullName}
                    onChange={(e) => patch({ fullName: e.target.value })}
                    disabled={disabled}
                    data-crud-focus-target=""
                  />
                  {privateSoleNameErr ? <p className="text-sm text-destructive">{String(privateSoleNameErr)}</p> : null}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="lead-pesel">{t('insurance_desk.leads.contact.pesel', 'PESEL')}</Label>
                    <input
                      id="lead-pesel"
                      className={cn(CRUD_FORM_TEXT_INPUT_CLASS, (peselServer || peselInvalid) && 'border-destructive')}
                      value={model.pesel}
                      onChange={(e) => patch({ pesel: e.target.value })}
                      disabled={disabled}
                      data-crud-focus-target=""
                    />
                    {peselErrorBlock ? <p className="text-sm text-destructive">{peselErrorBlock}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lead-addr">{t('insurance_desk.leads.contact.address', 'Address')}</Label>
                    <input
                      id="lead-addr"
                      className={cn(CRUD_FORM_TEXT_INPUT_CLASS, addressServer && 'border-destructive')}
                      value={model.address}
                      onChange={(e) => patch({ address: e.target.value })}
                      disabled={disabled}
                      data-crud-focus-target=""
                    />
                    {addressServer ? <p className="text-sm text-destructive">{addressServer}</p> : null}
                  </div>
                </div>
              </>
            )}
            {ht === 'sole' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="lead-fn2">{t('insurance_desk.leads.contact.fullName', 'Full name')}</Label>
                  <input
                    id="lead-fn2"
                    className={cn(CRUD_FORM_TEXT_INPUT_CLASS, !!privateSoleNameErr && 'border-destructive')}
                    value={model.fullName}
                    onChange={(e) => patch({ fullName: e.target.value })}
                    disabled={disabled}
                    data-crud-focus-target=""
                  />
                  {privateSoleNameErr ? <p className="text-sm text-destructive">{String(privateSoleNameErr)}</p> : null}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="lead-pesel2">{t('insurance_desk.leads.contact.pesel', 'PESEL')}</Label>
                    <input
                      id="lead-pesel2"
                      className={cn(CRUD_FORM_TEXT_INPUT_CLASS, (peselServer || peselInvalid) && 'border-destructive')}
                      value={model.pesel}
                      onChange={(e) => patch({ pesel: e.target.value })}
                      disabled={disabled}
                      data-crud-focus-target=""
                    />
                    {peselErrorBlock ? <p className="text-sm text-destructive">{peselErrorBlock}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lead-reg">{t('insurance_desk.leads.contact.regon', 'REGON')}</Label>
                    <input
                      id="lead-reg"
                      className={cn(CRUD_FORM_TEXT_INPUT_CLASS, (regonServer || regonInvalid) && 'border-destructive')}
                      value={model.regon}
                      onChange={(e) => patch({ regon: e.target.value })}
                      disabled={disabled}
                      data-crud-focus-target=""
                    />
                    {regonErrorBlock ? <p className="text-sm text-destructive">{regonErrorBlock}</p> : null}
                  </div>
                </div>
              </>
            )}
            {ht === 'civil' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="lead-pn">{t('insurance_desk.leads.contact.partnerNames', 'Partners (names)')}</Label>
                  <input
                    id="lead-pn"
                    className={cn(CRUD_FORM_TEXT_INPUT_CLASS, civilPartnerNameErr && 'border-destructive')}
                    value={model.partnerNames}
                    onChange={(e) => patch({ partnerNames: e.target.value })}
                    disabled={disabled}
                    data-crud-focus-target=""
                  />
                  {civilPartnerNameErr ? <p className="text-sm text-destructive">{civilPartnerNameErr}</p> : null}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="lead-pp">{t('insurance_desk.leads.contact.partnerPesels', 'Partners (PESEL)')}</Label>
                    <input
                      id="lead-pp"
                      className={cn(CRUD_FORM_TEXT_INPUT_CLASS, partnerPeselsInvalid && 'border-destructive')}
                      value={model.partnerPesels}
                      onChange={(e) => patch({ partnerPesels: e.target.value })}
                      disabled={disabled}
                      data-crud-focus-target=""
                    />
                    {partnerPeselsInvalid ? (
                      <p className="text-sm text-destructive">
                        {t(
                          'insurance_desk.leads.contact.partnerPeselsInvalid',
                          'Each partner PESEL must be valid (separate with commas or spaces).',
                        )}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lead-reg2">{t('insurance_desk.leads.contact.regon', 'REGON')}</Label>
                    <input
                      id="lead-reg2"
                      className={cn(CRUD_FORM_TEXT_INPUT_CLASS, (regonServer || regonInvalid) && 'border-destructive')}
                      value={model.regon}
                      onChange={(e) => patch({ regon: e.target.value })}
                      disabled={disabled}
                      data-crud-focus-target=""
                    />
                    {regonErrorBlock ? <p className="text-sm text-destructive">{regonErrorBlock}</p> : null}
                  </div>
                </div>
              </>
            )}
            {ht === 'llc' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="lead-cn">{t('insurance_desk.leads.contact.companyName', 'Company name')}</Label>
                  <input
                    id="lead-cn"
                    className={cn(CRUD_FORM_TEXT_INPUT_CLASS, llcCompanyNameErr && 'border-destructive')}
                    value={model.companyName}
                    onChange={(e) => patch({ companyName: e.target.value })}
                    disabled={disabled}
                    data-crud-focus-target=""
                  />
                  {llcCompanyNameErr ? <p className="text-sm text-destructive">{llcCompanyNameErr}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-reg3">{t('insurance_desk.leads.contact.regon', 'REGON')}</Label>
                  <input
                    id="lead-reg3"
                    className={cn(CRUD_FORM_TEXT_INPUT_CLASS, (regonServer || regonInvalid) && 'border-destructive')}
                    value={model.regon}
                    onChange={(e) => patch({ regon: e.target.value })}
                    disabled={disabled}
                    data-crud-focus-target=""
                  />
                  {regonErrorBlock ? <p className="text-sm text-destructive">{regonErrorBlock}</p> : null}
                </div>
              </>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {ht !== 'private' && ht !== 'sole' ? (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="lead-cfn">{t('insurance_desk.leads.contact.contactPersonName', 'Contact person name')}</Label>
                <input
                  id="lead-cfn"
                  className={cn(CRUD_FORM_TEXT_INPUT_CLASS, cfnNameErr && 'border-destructive')}
                  value={model.fullName}
                  onChange={(e) => patch({ fullName: e.target.value })}
                  disabled={disabled}
                  data-crud-focus-target=""
                />
                {cfnNameErr ? <p className="text-sm text-destructive">{cfnNameErr}</p> : null}
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="lead-ph">{t('insurance_desk.leads.form.contact.phone', 'Phone')}</Label>
              <input
                id="lead-ph"
                className={cn(CRUD_FORM_TEXT_INPUT_CLASS, phoneServer && 'border-destructive')}
                type="tel"
                value={model.phone}
                onChange={(e) => patch({ phone: e.target.value })}
                disabled={disabled}
                data-crud-focus-target=""
              />
              {phoneServer ? <p className="text-sm text-destructive">{phoneServer}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-em">{t('insurance_desk.leads.form.contact.email', 'E-mail')}</Label>
              <input
                id="lead-em"
                className={cn(CRUD_FORM_TEXT_INPUT_CLASS, emailServer && 'border-destructive')}
                type="email"
                value={model.email}
                onChange={(e) => patch({ email: e.target.value })}
                disabled={disabled}
                data-crud-focus-target=""
              />
              {emailServer ? <p className="text-sm text-destructive">{emailServer}</p> : null}
            </div>
          </div>
        </>
      ) : null}
      {orphanServerMessage ? <p className="text-sm text-destructive">{orphanServerMessage}</p> : null}
      {showBlockError && error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

export default LeadContactHolderField
