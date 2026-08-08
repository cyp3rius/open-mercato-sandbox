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

export type DriverProfileFormValues = {
  teamMemberId: string
  payoutPercent: string
  defaultResourceId: string
  externalAppEnabled: boolean
}

export type DriverProfileUpdateFormValues = Pick<
  DriverProfileFormValues,
  'payoutPercent' | 'defaultResourceId' | 'externalAppEnabled'
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

export function defaultDriverProfileFormValues(defaultPayoutPercent = 0): DriverProfileFormValues {
  return {
    teamMemberId: '',
    payoutPercent: formatPercentInputValue(defaultPayoutPercent),
    defaultResourceId: '',
    externalAppEnabled: false,
  }
}

export function mapDriverProfileRowToUpdateFormValues(row: {
  payoutPercent: string | number
  defaultResourceId?: string | null
  externalAppEnabled: boolean
}): DriverProfileUpdateFormValues {
  return {
    payoutPercent: formatPercentInputValue(row.payoutPercent),
    defaultResourceId: row.defaultResourceId ?? '',
    externalAppEnabled: row.externalAppEnabled,
  }
}

export function mapDriverProfileRowToFormValues(row: {
  teamMemberId: string
  payoutPercent: string | number
  defaultResourceId?: string | null
  externalAppEnabled: boolean
}): DriverProfileFormValues {
  return {
    teamMemberId: row.teamMemberId,
    ...mapDriverProfileRowToUpdateFormValues(row),
  }
}

export function driverProfileCreateSchema() {
  return z.object({
    teamMemberId: z.string().uuid(),
    payoutPercent: payoutPercentFieldSchema(),
    defaultResourceId: resourceIdSchema,
    externalAppEnabled: z.boolean(),
  })
}

export function driverProfileUpdateSchema() {
  return z.object({
    payoutPercent: payoutPercentFieldSchema(),
    defaultResourceId: resourceIdSchema,
    externalAppEnabled: z.boolean(),
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
      fields: ['teamMemberId', 'payoutPercent', 'defaultResourceId', 'externalAppEnabled'],
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
      id: 'payoutPercent',
      type: 'custom',
      label: t('taxi_fleet.drivers.payoutPercent', 'Payout'),
      required: true,
      layout: fieldLayout,
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
  )

  return fields
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
    payoutPercent: parseNumericValue(values.payoutPercent) ?? 0,
    defaultResourceId: resourceId.length ? resourceId : null,
    externalAppEnabled: values.externalAppEnabled,
  }
}

export function driverProfileFormValuesToUpdatePayload(
  id: string,
  values: DriverProfileUpdateFormValues,
) {
  const resourceId = values.defaultResourceId.trim()
  return {
    id,
    payoutPercent: parseNumericValue(values.payoutPercent) ?? 0,
    defaultResourceId: resourceId.length ? resourceId : null,
    externalAppEnabled: values.externalAppEnabled,
  }
}
