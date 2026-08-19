'use client'

import Link from 'next/link'
import { z } from 'zod'
import type { TranslateFn } from '@open-mercato/shared/lib/i18n/context'
import type { CrudField, CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { LookupSelect, type LookupSelectItem } from '@open-mercato/ui/backend/inputs/LookupSelect'
import type { FleetDriverProfile } from './useFleetDriverDirectory'
import { formatWeekRange } from '../lib/weekUtils'

export type SettlementFormValues = {
  teamMemberId: string
  weekStart: string
  status: string
  revenueGross: string
  revenueNet: string
  costsGross: string
  costsNet: string
  totalRevenue: string
  totalCosts: string
  netAmount: string
  payoutPercent: string
  payoutAmount: string
  computedDistanceKm: string
  totalDistanceKm: string
  cashExpected: string
  cashCollected: string
  bonusAmount: string
  compensationAmount: string
  airportA4Amount: string
  transferAmount: string
  totalAmount: string
}

export type SettlementGenerateFormValues = {
  teamMemberId: string
  weekStart: string
}

export type SettlementGenerateWeekFormValues = {
  weekStart: string
}

export function defaultSettlementGenerateValues(weekStart: string): SettlementGenerateFormValues {
  return { teamMemberId: '', weekStart }
}

export function defaultSettlementGenerateWeekValues(weekStart: string): SettlementGenerateWeekFormValues {
  return { weekStart }
}

export function settlementGenerateSchema() {
  return z.object({
    teamMemberId: z.string().uuid(),
    weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
}

export function settlementGenerateWeekSchema() {
  return z.object({
    weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
}

export function buildSettlementGenerateGroups(t: TranslateFn): CrudFormGroup[] {
  return [
    {
      id: 'basics',
      title: t('taxi_fleet.settlements.form.groups.basics', 'Basics'),
      column: 2,
      fields: ['teamMemberId', 'weekStart'],
    },
  ]
}

export function buildSettlementGenerateFields(
  t: TranslateFn,
  driverProfiles: FleetDriverProfile[],
  resolveDriverName: (teamMemberId: string) => string,
): CrudField[] {
  const driverOptions: LookupSelectItem[] = driverProfiles.map((profile) => ({
    id: profile.teamMemberId,
    title: resolveDriverName(profile.teamMemberId),
  }))
  return [
    {
      id: 'teamMemberId',
      type: 'custom',
      label: t('taxi_fleet.settlements.driver', 'Driver'),
      required: true,
      layout: 'half',
      component: ({ value, setValue, disabled }) => (
        <LookupSelect
          value={typeof value === 'string' && value.length ? value : null}
          onChange={(next) => setValue(next ?? '')}
          options={driverOptions}
          fetchOptions={async (query) =>
            driverOptions.filter((option) =>
              !query?.trim() ? true : option.title.toLowerCase().includes(query.trim().toLowerCase()),
            )
          }
          placeholder={t('taxi_fleet.trips.pickDriver', 'Select driver…')}
          disabled={disabled}
        />
      ),
    },
    {
      id: 'weekStart',
      type: 'date',
      label: t('taxi_fleet.settlements.week', 'Week'),
      required: true,
      layout: 'half',
    },
  ]
}

export type SettlementGenerateDialogFieldOptions = {
  includeDriver: boolean
  driverProfiles: FleetDriverProfile[]
  resolveDriverName: (teamMemberId: string) => string
  availableWeeks: string[]
  weeksLoading: boolean
  driverSelected: boolean
  onDriverChange?: (teamMemberId: string) => void
}

export function buildSettlementGenerateDialogFields(
  t: TranslateFn,
  options: SettlementGenerateDialogFieldOptions,
): CrudField[] {
  const driverOptions: LookupSelectItem[] = options.driverProfiles.map((profile) => ({
    id: profile.teamMemberId,
    title: options.resolveDriverName(profile.teamMemberId),
  }))

  const fields: CrudField[] = []

  if (options.includeDriver) {
    fields.push({
      id: 'teamMemberId',
      type: 'custom',
      label: t('taxi_fleet.settlements.driver', 'Driver'),
      required: true,
      layout: 'full',
      component: ({ value, setValue, disabled }) => (
        <LookupSelect
          value={typeof value === 'string' && value.length ? value : null}
          onChange={(next) => {
            const nextValue = next ?? ''
            setValue(nextValue)
            options.onDriverChange?.(nextValue)
          }}
          options={driverOptions}
          fetchOptions={async (query) =>
            driverOptions.filter((option) =>
              !query?.trim() ? true : option.title.toLowerCase().includes(query.trim().toLowerCase()),
            )
          }
          placeholder={t('taxi_fleet.trips.pickDriver', 'Select driver…')}
          disabled={disabled}
        />
      ),
    })
  }

  if (!options.driverSelected) {
    fields.push({
      id: 'weekStart',
      type: 'custom',
      label: t('taxi_fleet.settlements.week', 'Week'),
      layout: 'full',
      component: () => (
        <p className="text-sm text-muted-foreground">
          {t('taxi_fleet.settlements.pickDriverFirst', 'Select a driver to choose the settlement week.')}
        </p>
      ),
    })
    return fields
  }

  if (options.weeksLoading) {
    fields.push({
      id: 'weekStart',
      type: 'custom',
      label: t('taxi_fleet.settlements.week', 'Week'),
      layout: 'full',
      component: () => (
        <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading…')}</p>
      ),
    })
    return fields
  }

  if (options.availableWeeks.length === 0) {
    fields.push({
      id: 'weekStart',
      type: 'custom',
      label: t('taxi_fleet.settlements.week', 'Week'),
      layout: 'full',
      component: () => (
        <p className="text-sm text-muted-foreground">
          {t('taxi_fleet.settlements.noAvailableWeeks', 'All recent weeks already have settlements.')}
        </p>
      ),
    })
    return fields
  }

  fields.push({
    id: 'weekStart',
    type: 'select',
    label: t('taxi_fleet.settlements.week', 'Week'),
    description: t('taxi_fleet.settlements.generateWeekHint', 'Select the Monday that starts the settlement week (ISO).'),
    required: true,
    layout: 'full',
    options: options.availableWeeks.map((weekStart) => ({
      value: weekStart,
      label: formatWeekRange(weekStart),
    })),
  })

  return fields
}

export function buildSettlementBasicsGroups(): CrudFormGroup[] {
  return [
    {
      id: 'basics',
      column: 2,
      bare: true,
      fields: ['teamMemberId', 'weekStart', 'status'],
    },
  ]
}

export function buildSettlementAdjustmentsGroups(): CrudFormGroup[] {
  return buildSettlementCorrectionsGroups()
}

export function buildSettlementCorrectionsGroups(): CrudFormGroup[] {
  return [
    {
      id: 'corrections',
      column: 1,
      fields: ['compensationAmount', 'bonusAmount'],
    },
  ]
}

export function buildSettlementCashGroups(): CrudFormGroup[] {
  return [
    {
      id: 'cash',
      column: 1,
      fields: ['cashCollected', 'airportA4Amount'],
    },
  ]
}

export function buildSettlementDetailGroups(t: TranslateFn): CrudFormGroup[] {
  return buildSettlementBasicsGroups()
}

function settlementStatusOptions(t: TranslateFn) {
  return ['draft', 'submitted', 'approved', 'paid'].map((status) => ({
    value: status,
    label: t(`taxi_fleet.settlements.statuses.${status}`, status),
  }))
}

function formatSettlementMoney(value: number): string {
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PLN`
}

export function buildSettlementBasicsFields(
  t: TranslateFn,
  readOnly: boolean,
  resolveDriverName: (teamMemberId: string) => string,
): CrudField[] {
  return [
    {
      id: 'teamMemberId',
      type: 'custom',
      label: t('taxi_fleet.settlements.driver', 'Driver'),
      layout: 'half',
      readOnly: true,
      component: ({ value }) => {
        const memberId = typeof value === 'string' ? value : ''
        if (!memberId) return <span className="text-sm text-muted-foreground">—</span>
        return (
          <Link
            href={`/backend/staff/team-members/${encodeURIComponent(memberId)}`}
            className="text-sm font-medium text-primary hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {resolveDriverName(memberId)}
          </Link>
        )
      },
    },
    {
      id: 'weekStart',
      type: 'custom',
      label: t('taxi_fleet.settlements.week', 'Week'),
      layout: 'half',
      readOnly: true,
      component: ({ value }) => (
        <span className="text-sm font-medium tabular-nums">{formatWeekRange(String(value ?? ''))}</span>
      ),
    },
    {
      id: 'status',
      type: 'select',
      label: t('taxi_fleet.settlements.status', 'Status'),
      layout: 'full',
      options: settlementStatusOptions(t),
      readOnly,
    },
  ]
}

export function buildSettlementAdjustmentsFields(t: TranslateFn, readOnly: boolean): CrudField[] {
  return buildSettlementCorrectionsFields(t, readOnly)
}

export function buildSettlementCorrectionsFields(t: TranslateFn, readOnly: boolean): CrudField[] {
  return [
    {
      id: 'compensationAmount',
      type: 'number',
      label: t('taxi_fleet.settlements.compensationAmount', 'Compensations'),
      layout: 'half',
      readOnly,
      min: 0,
      step: 0.01,
    },
    {
      id: 'bonusAmount',
      type: 'number',
      label: t('taxi_fleet.settlements.bonusAmount', 'Bonuses'),
      layout: 'half',
      readOnly,
      min: 0,
      step: 0.01,
    },
  ]
}

export function buildSettlementCashFields(t: TranslateFn, readOnly: boolean): CrudField[] {
  return [
    {
      id: 'cashCollected',
      type: 'number',
      label: t('taxi_fleet.settlements.cashSummary.transferredInput', 'Cash handed to central'),
      layout: 'half',
      readOnly,
      min: 0,
      step: 0.01,
    },
    {
      id: 'airportA4Amount',
      type: 'number',
      label: t('taxi_fleet.settlements.airportA4Amount', 'Airport + A4'),
      layout: 'half',
      readOnly,
      min: 0,
      step: 0.01,
    },
  ]
}

/** @deprecated Use buildSettlementBasicsFields or buildSettlementAdjustmentsFields */
export function buildSettlementDetailFields(
  t: TranslateFn,
  readOnly: boolean,
  resolveDriverName: (teamMemberId: string) => string,
): CrudField[] {
  return [
    ...buildSettlementBasicsFields(t, readOnly, resolveDriverName),
    ...buildSettlementAdjustmentsFields(t, readOnly),
  ]
}

export function defaultSettlementDetailValues(): SettlementFormValues {
  return {
    teamMemberId: '',
    weekStart: '',
    status: 'draft',
    revenueGross: '0',
    revenueNet: '0',
    costsGross: '0',
    costsNet: '0',
    totalRevenue: '0',
    totalCosts: '0',
    netAmount: '0',
    payoutPercent: '0',
    payoutAmount: '0',
    computedDistanceKm: '0',
    totalDistanceKm: '0',
    cashExpected: '0',
    cashCollected: '0',
    bonusAmount: '0',
    compensationAmount: '0',
    airportA4Amount: '0',
    transferAmount: '0',
    totalAmount: '0',
  }
}
