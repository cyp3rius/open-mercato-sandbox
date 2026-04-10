"use client"

import * as React from 'react'
import { User, Building2, FileText, Wallet } from 'lucide-react'
import type { CrudCustomFieldRenderProps } from '@open-mercato/ui/backend/CrudForm'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Label } from '@open-mercato/ui/primitives/label'
import { CRUD_FORM_TEXT_INPUT_CLASS } from '@open-mercato/ui/backend/CrudForm'
import { Switch } from '@open-mercato/ui/primitives/switch'
import { cn } from '@open-mercato/shared/lib/utils'
import type { LeadUsageFormValue } from '../../lib/leadUsageForm'
import { emptyLeadUsageForm } from '../../lib/leadUsageForm'

function normalize(raw: unknown): LeadUsageFormValue {
  const base = emptyLeadUsageForm()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  if (o.type === 'private' || o.type === 'business') base.type = o.type
  if (o.financing === 'leasing' || o.financing === 'own') base.financing = o.financing
  if (typeof o.leasingCompany === 'string') base.leasingCompany = o.leasingCompany
  if (o.under25 === true || o.under25 === false) base.under25 = o.under25
  if (o.under25 === null) base.under25 = null
  if (o.licenseShort === true || o.licenseShort === false) base.licenseShort = o.licenseShort
  if (o.licenseShort === null) base.licenseShort = null
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

function TileButton({
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
        'flex w-full flex-col items-center justify-center gap-2 rounded-md border p-3 text-center transition-colors sm:p-4',
        active
          ? 'border-primary bg-accent/40'
          : 'border-border bg-background hover:bg-muted/50',
      )}
    >
      <Icon className={cn('h-6 w-6', active ? 'text-primary' : 'text-muted-foreground')} />
      <span className={cn('text-sm text-foreground', active && 'text-primary')}>{label}</span>
    </button>
  )
}

function DriverSwitchRow({
  checked,
  onCheckedChange,
  disabled,
  noLabel,
  yesLabel,
}: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled?: boolean
  noLabel: string
  yesLabel: string
}) {
  return (
    <div className="inline-flex max-w-full flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">{noLabel}</span>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="shrink-0"
      />
      <span className="text-sm text-muted-foreground">{yesLabel}</span>
    </div>
  )
}

export function LeadUsageField(props: CrudCustomFieldRenderProps) {
  const t = useT()
  const { value, setValue, disabled, error } = props
  const model = normalize(value)

  const patch = React.useCallback(
    (partial: Partial<LeadUsageFormValue>) => {
      setValue({ ...normalize(value), ...partial })
    },
    [setValue, value],
  )

  const isBusiness = model.type === 'business'
  const isLeasing = isBusiness && model.financing === 'leasing'

  return (
    <div className={cn('space-y-6', error && 'rounded-md border border-destructive/50 p-3')}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <TileButton
            icon={User}
            label={t('insurance_desk.leads.usage.private', 'Private')}
            active={model.type === 'private'}
            onClick={() => patch({ type: 'private', financing: '' })}
          />
          <TileButton
            icon={Building2}
            label={t('insurance_desk.leads.usage.business', 'Business')}
            active={model.type === 'business'}
            onClick={() => patch({ type: 'business' })}
          />
        </div>
      </div>

      {isBusiness ? (
        <div className="space-y-3">
          <Label>{t('insurance_desk.leads.usage.financingLabel', 'Financing')}</Label>
          <div className="grid grid-cols-2 gap-3">
            <TileButton
              icon={FileText}
              label={t('insurance_desk.leads.usage.leasing', 'Leasing')}
              active={model.financing === 'leasing'}
              onClick={() => patch({ financing: 'leasing' })}
            />
            <TileButton
              icon={Wallet}
              label={t('insurance_desk.leads.usage.own', 'Cash / own funds')}
              active={model.financing === 'own'}
              onClick={() => patch({ financing: 'own' })}
            />
          </div>
        </div>
      ) : null}

      {isLeasing ? (
        <div className="space-y-2">
          <Label htmlFor="lead-lc">{t('insurance_desk.leads.usage.leasingCompany', 'Leasing company')}</Label>
          <input
            id="lead-lc"
            className={CRUD_FORM_TEXT_INPUT_CLASS}
            value={model.leasingCompany}
            onChange={(e) => patch({ leasingCompany: e.target.value })}
            disabled={disabled}
            data-crud-focus-target=""
          />
        </div>
      ) : null}

      {model.type ? (
        <>
          <SectionLabel>{t('insurance_desk.leads.usage.driversSection', 'Drivers')}</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0 space-y-2">
              <Label className="text-sm leading-snug">
                {t('insurance_desk.leads.usage.under25', 'Regular driver under 25')}
              </Label>
              <DriverSwitchRow
                checked={model.under25 === true}
                onCheckedChange={(v) => patch({ under25: v })}
                disabled={disabled}
                noLabel={t('common.no', 'No')}
                yesLabel={t('common.yes', 'Yes')}
              />
            </div>
            <div className="min-w-0 space-y-2">
              <Label className="text-sm leading-snug">
                {t('insurance_desk.leads.usage.licenseShort', 'Licence held under 2 years')}
              </Label>
              <DriverSwitchRow
                checked={model.licenseShort === true}
                onCheckedChange={(v) => patch({ licenseShort: v })}
                disabled={disabled}
                noLabel={t('common.no', 'No')}
                yesLabel={t('common.yes', 'Yes')}
              />
            </div>
          </div>
        </>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

export default LeadUsageField
