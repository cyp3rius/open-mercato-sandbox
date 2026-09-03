'use client'

import * as React from 'react'
import { z } from 'zod'
import type { TranslateFn } from '@open-mercato/shared/lib/i18n/context'
import type { CrudField, CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { formatPercentInputValue, parseNumericValue } from '@open-mercato/shared/lib/numeric'
import { StaffTeamMemberSearchField } from './StaffTeamMemberSearchField'
import { PercentInputField } from '@open-mercato/ui/backend/inputs/PercentInputField'
import { ResourceSearchField } from './ResourceSearchField'
import { MobileAppAccessSwitchField } from './MobileAppAccessSwitchField'
import { PayoutTiersEditor } from './PayoutTiersEditor'
import { validatePayoutTiers, type PayoutMode, type PayoutTier } from '../lib/payoutTiers'

export type DriverProfileFormValues = {
  teamMemberId: string
  payoutMode: PayoutMode
  payoutPercent: string
  payoutTiers: PayoutTier[]
  defaultResourceId: string
  externalAppEnabled: boolean
  boltDriverId: string
  uberDriverId: string
  freeDriverId: string
}

export type DriverProfileUpdateFormValues = Pick<
  DriverProfileFormValues,
  | 'payoutMode'
  | 'payoutPercent'
  | 'payoutTiers'
  | 'defaultResourceId'
  | 'externalAppEnabled'
  | 'boltDriverId'
  | 'uberDriverId'
  | 'freeDriverId'
>

export type DriverProfileFormSurface = 'page' | 'dialog' | 'sidebar'

export type DriverProfileFormOptions = {
  mode: 'create' | 'edit'
  excludeMemberIds?: Set<string>
  readOnly?: boolean
  surface?: DriverProfileFormSurface
}

const resourceIdSchema = z.union([z.string().uuid(), z.literal('')])

function payoutPercentFieldSchema() {
  return z.string().refine((value) => {
    const parsed = parseNumericValue(value)
    return parsed !== null && parsed >= 0 && parsed <= 100
  })
}

function parseStoredTiers(value: unknown): PayoutTier[] {
  if (!Array.isArray(value)) return [{ fromAmount: null, toAmount: null, percent: 0 }]
  const tiers = value.map((item) => {
    const record = (item ?? {}) as Record<string, unknown>
    return {
      fromAmount: record.fromAmount == null || record.fromAmount === '' ? null : Number(record.fromAmount),
      toAmount: record.toAmount == null || record.toAmount === '' ? null : Number(record.toAmount),
      percent: Number(record.percent) || 0,
    } satisfies PayoutTier
  })
  return tiers.length ? tiers : [{ fromAmount: null, toAmount: null, percent: 0 }]
}

export function defaultDriverProfileFormValues(defaultPayoutPercent = 0): DriverProfileFormValues {
  return {
    teamMemberId: '',
    payoutMode: 'fixed',
    payoutPercent: formatPercentInputValue(defaultPayoutPercent),
    payoutTiers: [{ fromAmount: null, toAmount: null, percent: defaultPayoutPercent }],
    defaultResourceId: '',
    externalAppEnabled: false,
    boltDriverId: '',
    uberDriverId: '',
    freeDriverId: '',
  }
}

export function mapDriverProfileRowToUpdateFormValues(row: {
  payoutMode?: string | null
  payoutPercent: string | number
  payoutTiersJson?: unknown
  defaultResourceId?: string | null
  externalAppEnabled: boolean
  boltDriverId?: string | null
  uberDriverId?: string | null
  freeDriverId?: string | null
}): DriverProfileUpdateFormValues {
  return {
    payoutMode: row.payoutMode === 'tiered' ? 'tiered' : 'fixed',
    payoutPercent: formatPercentInputValue(row.payoutPercent),
    payoutTiers: parseStoredTiers(row.payoutTiersJson),
    defaultResourceId: row.defaultResourceId ?? '',
    externalAppEnabled: row.externalAppEnabled,
    boltDriverId: row.boltDriverId ?? '',
    uberDriverId: row.uberDriverId ?? '',
    freeDriverId: row.freeDriverId ?? '',
  }
}

export function mapDriverProfileRowToFormValues(row: {
  teamMemberId: string
  payoutMode?: string | null
  payoutPercent: string | number
  payoutTiersJson?: unknown
  defaultResourceId?: string | null
  externalAppEnabled: boolean
  boltDriverId?: string | null
  uberDriverId?: string | null
  freeDriverId?: string | null
}): DriverProfileFormValues {
  return {
    teamMemberId: row.teamMemberId,
    ...mapDriverProfileRowToUpdateFormValues(row),
  }
}

const platformDriverIdSchema = z.string().max(191)

function payoutFieldsSchema() {
  return {
    payoutMode: z.enum(['fixed', 'tiered']),
    payoutPercent: payoutPercentFieldSchema(),
    payoutTiers: z
      .array(
        z.object({
          fromAmount: z.number().nullable(),
          toAmount: z.number().nullable(),
          percent: z.number().min(0).max(100),
        }),
      )
      .optional(),
  }
}

export function driverProfileCreateSchema() {
  return z
    .object({
      teamMemberId: z.string().uuid(),
      ...payoutFieldsSchema(),
      defaultResourceId: resourceIdSchema,
      externalAppEnabled: z.boolean(),
      boltDriverId: platformDriverIdSchema,
      uberDriverId: platformDriverIdSchema,
      freeDriverId: platformDriverIdSchema,
    })
    .superRefine((value, ctx) => {
      if (value.payoutMode !== 'tiered') return
      const result = validatePayoutTiers(value.payoutTiers ?? [])
      if (result.ok) return
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid payout tiers', path: ['payoutTiers'] })
    })
}

export function driverProfileUpdateSchema() {
  return z
    .object({
      ...payoutFieldsSchema(),
      defaultResourceId: resourceIdSchema,
      externalAppEnabled: z.boolean(),
      boltDriverId: platformDriverIdSchema,
      uberDriverId: platformDriverIdSchema,
      freeDriverId: platformDriverIdSchema,
    })
    .superRefine((value, ctx) => {
      if (value.payoutMode !== 'tiered') return
      const result = validatePayoutTiers(value.payoutTiers ?? [])
      if (result.ok) return
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid payout tiers', path: ['payoutTiers'] })
    })
}

/** @deprecated Use driverProfileCreateSchema or driverProfileUpdateSchema */
export function driverProfileFormSchema() {
  return driverProfileCreateSchema()
}

export function buildDriverProfileFormGroups(t: TranslateFn): CrudFormGroup[] {
  return [
    {
      id: 'basics',
      title: t('taxi_fleet.drivers.form.groups.basics', 'Basics'),
      column: 1,
      fields: [
        'teamMemberId',
        'payoutMode',
        'payoutPercent',
        'payoutTiers',
        'defaultResourceId',
        'externalAppEnabled',
        'boltDriverId',
        'uberDriverId',
        'freeDriverId',
      ],
    },
  ]
}

function resolveFieldLayout(surface: DriverProfileFormSurface): 'full' | 'half' | 'third' {
  if (surface === 'sidebar') return 'third'
  return surface === 'page' ? 'half' : 'full'
}

function resolveDefaultVehicleLayout(surface: DriverProfileFormSurface): 'full' | 'half' | 'third' {
  if (surface === 'sidebar') return 'half'
  return surface === 'page' ? 'half' : 'full'
}

export function buildDriverProfileFormFields(t: TranslateFn, options: DriverProfileFormOptions): CrudField[] {
  const { mode, excludeMemberIds = new Set(), readOnly = false, surface = 'page' } = options
  const fieldLayout = resolveFieldLayout(surface)
  const fields: CrudField[] = []

  if (mode === 'create') {
    fields.push({
      id: 'teamMemberId',
      type: 'custom',
      label: t('taxi_fleet.drivers.member', 'Team member'),
      required: true,
      layout: 'full',
      component: ({ value, setValue, disabled }) => (
        <StaffTeamMemberSearchField
          value={typeof value === 'string' ? value : ''}
          onChange={(next) => setValue(next)}
          excludeMemberIds={excludeMemberIds}
          disabled={disabled || readOnly}
        />
      ),
    })
  }

  fields.push(
    {
      id: 'payoutMode',
      type: 'select',
      label: t('taxi_fleet.drivers.payoutMode', 'Payout mode'),
      required: true,
      layout: fieldLayout,
      options: [
        { value: 'fixed', label: t('taxi_fleet.drivers.payoutMode.fixed', 'Fixed percent') },
        { value: 'tiered', label: t('taxi_fleet.drivers.payoutMode.tiered', 'Tiered by net amount') },
      ],
    },
    {
      id: 'payoutPercent',
      type: 'custom',
      label: t('taxi_fleet.drivers.payoutPercent', 'Payout'),
      required: true,
      layout: fieldLayout,
      visibleWhen: (values) => values.payoutMode !== 'tiered',
      component: ({ value, setValue, disabled }) => (
        <PercentInputField
          value={typeof value === 'string' ? value : value == null ? '' : String(value)}
          onChange={(next) => setValue(next)}
          disabled={disabled || readOnly}
          placeholder="0"
        />
      ),
    },
    {
      id: 'payoutTiers',
      type: 'custom',
      label: t('taxi_fleet.drivers.payoutTiers', 'Payout tiers'),
      layout: 'full',
      visibleWhen: (values) => values.payoutMode === 'tiered',
      component: ({ value, setValue, disabled }) => (
        <PayoutTiersEditor
          value={Array.isArray(value) ? (value as PayoutTier[]) : []}
          onChange={(next) => setValue(next)}
          disabled={disabled || readOnly}
        />
      ),
    },
    {
      id: 'defaultResourceId',
      type: 'custom',
      label: t('taxi_fleet.drivers.defaultVehicle', 'Default vehicle'),
      layout: resolveDefaultVehicleLayout(surface),
      component: ({ value, setValue, disabled }) => (
        <ResourceSearchField
          value={typeof value === 'string' ? value : ''}
          onChange={(next) => setValue(next)}
          disabled={disabled || readOnly}
        />
      ),
    },
    {
      id: 'externalAppEnabled',
      type: 'custom',
      label: '',
      layout: 'full',
      component: ({ value, setValue, disabled }) => (
        <MobileAppAccessSwitchField
          value={value === true}
          onChange={(next) => setValue(next)}
          disabled={disabled || readOnly}
        />
      ),
    },
    {
      id: 'boltDriverId',
      type: 'text',
      label: t('taxi_fleet.drivers.platformIds.bolt', 'Bolt driver ID'),
      layout: 'full',
      placeholder: t('taxi_fleet.drivers.platformIds.placeholder', 'Paste ID from fleet console'),
    },
    {
      id: 'uberDriverId',
      type: 'text',
      label: t('taxi_fleet.drivers.platformIds.uber', 'Uber driver ID'),
      layout: 'full',
      placeholder: t('taxi_fleet.drivers.platformIds.placeholder', 'Paste ID from fleet console'),
    },
    {
      id: 'freeDriverId',
      type: 'text',
      label: t('taxi_fleet.drivers.platformIds.free', 'Free driver ID'),
      layout: 'full',
      placeholder: t('taxi_fleet.drivers.platformIds.placeholder', 'Paste ID from fleet console'),
    },
  )

  return fields
}

function normalizePlatformDriverId(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

export function driverProfileFormValuesToCreatePayload(
  values: DriverProfileFormValues,
  scope: { tenantId: string; organizationId: string },
) {
  const resourceId = values.defaultResourceId.trim()
  return {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    teamMemberId: values.teamMemberId,
    payoutMode: values.payoutMode,
    payoutPercent: parseNumericValue(values.payoutPercent) ?? 0,
    payoutTiers: values.payoutMode === 'tiered' ? values.payoutTiers : null,
    defaultResourceId: resourceId.length ? resourceId : null,
    externalAppEnabled: values.externalAppEnabled,
    boltDriverId: normalizePlatformDriverId(values.boltDriverId),
    uberDriverId: normalizePlatformDriverId(values.uberDriverId),
    freeDriverId: normalizePlatformDriverId(values.freeDriverId),
  }
}

export function driverProfileFormValuesToUpdatePayload(
  id: string,
  values: DriverProfileUpdateFormValues,
) {
  const resourceId = values.defaultResourceId.trim()
  return {
    id,
    payoutMode: values.payoutMode,
    payoutPercent: parseNumericValue(values.payoutPercent) ?? 0,
    payoutTiers: values.payoutMode === 'tiered' ? values.payoutTiers : null,
    defaultResourceId: resourceId.length ? resourceId : null,
    externalAppEnabled: values.externalAppEnabled,
    boltDriverId: normalizePlatformDriverId(values.boltDriverId),
    uberDriverId: normalizePlatformDriverId(values.uberDriverId),
    freeDriverId: normalizePlatformDriverId(values.freeDriverId),
  }
}
