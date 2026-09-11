'use client'

import * as React from 'react'
import { z } from 'zod'
import type { TranslateFn } from '@open-mercato/shared/lib/i18n/context'
import type { CrudField, CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { LookupSelect, type LookupSelectItem } from '@open-mercato/ui/backend/inputs/LookupSelect'
import { TripCustomerField } from './TripCustomerField'
import { TripDateTimeLocalField } from './TripDateTimeLocalField'
import { TripDriverField } from './TripDriverField'
import { TripVehicleField } from './TripVehicleField'
import { TAXI_FLEET_TRIP_TYPES } from './useTaxiFleetLabels'
import type { FleetDriverProfile } from './useFleetDriverDirectory'
import { readTripCustomerEntityId } from '../lib/customerLink'
import {
  defaultTripDateTimeLocalRange,
  earliestTripStartDate,
  isoToDateTimeLocalValue,
  isTripStartMeetingMinAdvance,
  normalizeDateTimeLocalInput,
  roundDateToFiveMinutes,
  toDateTimeLocalValue,
  TRIP_MIN_ADVANCE_HOURS,
} from '../lib/datetimeLocal'
import {
  buildTripRequestMetadata,
  buildTripRouteNotes,
  defaultTripRequestDetails,
  parseTripRequestNumericDistance,
  parseTripRequestRevenueAmount,
  tripRequestDetailsFromMetadata,
  TRIP_CONTACT_TYPES,
  TRIP_REQUEST_PAYMENT_TYPES,
  TRIP_SERVICE_TYPES,
  type TripRequestDetails,
} from '../lib/tripRequestForm'
import { MoneyInputField } from '@open-mercato/ui/backend/inputs/MoneyInputField'
import { TripRouteDistanceSync, buildTripRouteFingerprint } from './route/TripRouteDistanceSync'
import { TripQuoteAmountField, TripQuoteSync } from './route/TripQuoteSync'
import { TripPricingSidebar } from './TripPricingSidebar'
import { TripStatusField } from './TripStatusField'
import { readQuoteSnapshotFromMetadata } from '../lib/pricing/tripFormQuote'
import { buildTripRequestFormFields, pickTripRequestDetails } from './tripRequestFormFields'
import { isTripDetailFieldEditable } from '../lib/tripDetailWorkflow'
import { TAXI_FLEET_TRIP_PLATFORMS } from '../lib/tripPlatforms'

export type TripFormValues = {
  teamMemberId: string
  resourceId: string
  customerEntityId: string
  tripType: string
  platform: string
  startedAtLocal: string
  endedAtLocal: string
  revenueAmount: string
  notes: string
  status: string
  fromLon: string
  fromLat: string
  toLon: string
  toLat: string
  routeWaypointMeta: string
  quoteSnapshotJson: string
  routeDurationSeconds: string
  routeSyncedFingerprint: string
} & TripRequestDetails

export type TripFormOptions = {
  mode: 'create' | 'edit'
  surface?: 'page' | 'dialog'
  driverProfiles: FleetDriverProfile[]
  resolveDriverName: (teamMemberId: string) => string
  readOnly?: boolean
  /** When set, fields not editable for this trip status use CrudForm `readOnly`. */
  lockStatus?: string | null
  allowDriverEdit?: boolean
  driverLocked?: boolean
  lockedTeamMemberId?: string | null
  onAssignmentResolved?: (assignmentId: string | null) => void
  statusOptions?: Array<{ value: string; label: string }>
  defaultStatusCode?: string
  /** Frozen when the create form opens — keeps min-advance / datetime `min` stable. */
  minAdvanceReference?: Date
  minAdvanceHours?: number
}

const TRIP_REQUEST_FIELD_IDS = new Set<string>([
  'serviceType',
  'fromAddress',
  'toAddress',
  'waypointAddresses',
  'distanceKm',
  'durationText',
  'passengers',
  'handLuggage',
  'holdLuggage',
  'childSeats',
  'boosterSeats',
  'englishSpeakingDriver',
  'isAirportPickup',
  'meetAndGreet',
  'flightNumber',
  'contactType',
  'companyName',
  'companyTaxId',
  'contactName',
  'contactPhone',
  'contactEmail',
  'paymentType',
  'vehicleCategory',
  'basePrice',
  'referringPartnerEntityId',
])

export function defaultTripFormValues(reference = new Date()): TripFormValues {
  const { startedAtLocal, endedAtLocal } = defaultTripDateTimeLocalRange(reference, {
    minAdvanceHours: 0,
  })
  const request = defaultTripRequestDetails()
  return {
    teamMemberId: '',
    resourceId: '',
    customerEntityId: '',
    tripType: 'client',
    platform: '',
    startedAtLocal,
    endedAtLocal,
    revenueAmount: '',
    notes: '',
    status: 'new',
    fromLon: '',
    fromLat: '',
    toLon: '',
    toLat: '',
    routeWaypointMeta: '',
    quoteSnapshotJson: '',
    routeDurationSeconds: '',
    routeSyncedFingerprint: buildTripRouteFingerprint(request),
    ...request,
  }
}

export function tripFormValuesFromSeed(seed: {
  teamMemberId?: string | null
  resourceId?: string | null
  startedAt?: Date | null
  endedAt?: Date | null
  defaultResourceId?: string | null
  lockedTeamMemberId?: string | null
}): TripFormValues {
  const base = defaultTripFormValues(seed.startedAt ?? new Date())
  const teamMemberId = seed.lockedTeamMemberId ?? seed.teamMemberId ?? ''
  if (teamMemberId) base.teamMemberId = teamMemberId
  const resourceId = seed.resourceId ?? seed.defaultResourceId ?? ''
  if (resourceId) base.resourceId = resourceId
  if (seed.startedAt) {
    base.startedAtLocal = toDateTimeLocalValue(roundDateToFiveMinutes(seed.startedAt))
  }
  if (seed.endedAt) {
    base.endedAtLocal = toDateTimeLocalValue(roundDateToFiveMinutes(seed.endedAt))
  }
  base.paymentType = 'cash'
  return base
}

function tripRequestSchemaShape() {
  return {
    serviceType: z.enum(TRIP_SERVICE_TYPES),
    fromAddress: z.string().trim().min(1),
    toAddress: z.string().trim().min(1),
    waypointAddresses: z.string().max(10000).optional(),
    distanceKm: z.string().optional(),
    durationText: z.string().max(200).optional(),
    passengers: z.string().refine((value) => {
      const parsed = Number(value)
      return Number.isFinite(parsed) && parsed >= 1 && parsed <= 8
    }),
    handLuggage: z.string().optional(),
    holdLuggage: z.string().optional(),
    childSeats: z.string().optional(),
    boosterSeats: z.string().optional(),
    isAirportPickup: z.boolean().optional(),
    flightNumber: z.string().max(100).optional(),
    meetAndGreet: z.boolean().optional(),
    englishSpeakingDriver: z.boolean().optional(),
    paymentType: z.enum(TRIP_REQUEST_PAYMENT_TYPES).optional(),
    contactName: z.string().max(500).optional(),
    contactPhone: z.string().max(100).optional(),
    contactEmail: z.string().max(320).optional(),
    contactType: z.enum(TRIP_CONTACT_TYPES).optional(),
    companyName: z.string().max(500).optional(),
    companyTaxId: z.string().max(32).optional(),
    vehicleCategory: z.string().max(50).optional(),
    basePrice: z.string().optional(),
    referringPartnerEntityId: z.union([z.string().uuid(), z.literal('')]).optional(),
  }
}

export type TripFormValidationOptions = {
  requireDriver?: boolean
  enforceMinAdvance?: boolean
  minAdvanceHours?: number
  /** Clock frozen at form open so default start stays valid while filling the form. */
  minAdvanceReference?: Date
}

export function tripFormSchema(t: TranslateFn, options?: TripFormValidationOptions) {
  const requireDriver = options?.requireDriver ?? true
  const enforceMinAdvance = options?.enforceMinAdvance ?? false
  const minAdvanceHours = options?.minAdvanceHours ?? TRIP_MIN_ADVANCE_HOURS
  const minAdvanceReference = options?.minAdvanceReference ?? new Date()
  return z
    .object({
      teamMemberId: requireDriver ? z.string().uuid() : z.string(),
      resourceId: z.string().uuid(),
      customerEntityId: z.union([z.string().uuid(), z.literal('')]).optional(),
      tripType: z.enum(['client', 'private', 'internal', 'empty', 'event', 'other', 'platform']),
      platform: z.string(),
      startedAtLocal: z.string().min(1),
      endedAtLocal: z.string().min(1),
      revenueAmount: z.string().optional(),
      notes: z.string().max(10000).optional(),
      status: z.string().optional(),
      fromLon: z.string().optional(),
      fromLat: z.string().optional(),
      toLon: z.string().optional(),
      toLat: z.string().optional(),
      routeWaypointMeta: z.string().optional(),
      quoteSnapshotJson: z.string().optional(),
      routeDurationSeconds: z.string().optional(),
      routeSyncedFingerprint: z.string().optional(),
      ...tripRequestSchemaShape(),
    })
    .superRefine((data, ctx) => {
      const started = new Date(data.startedAtLocal)
      const ended = new Date(data.endedAtLocal)
      if (Number.isNaN(started.getTime()) || Number.isNaN(ended.getTime()) || ended <= started) {
        ctx.addIssue({
          code: 'custom',
          message: t('taxi_fleet.trips.form.errors.invalidTimes', 'End time must be after start time.'),
          path: ['endedAtLocal'],
        })
      }

      if (enforceMinAdvance && !Number.isNaN(started.getTime())) {
        if (!isTripStartMeetingMinAdvance(started, minAdvanceReference, minAdvanceHours)) {
          ctx.addIssue({
            code: 'custom',
            message: t(
              'taxi_fleet.trips.form.errors.minAdvanceHours',
              'Trips must be booked at least {hours} hours in advance.',
              { hours: String(minAdvanceHours) },
            ),
            path: ['startedAtLocal'],
          })
        }
      }

      if (data.tripType === 'client' && !data.customerEntityId) {
        ctx.addIssue({
          code: 'custom',
          message: t('taxi_fleet.trips.form.errors.customerRequired', 'Customer is required for client trips.'),
          path: ['customerEntityId'],
        })
      }

      const passengers = Math.max(1, Number(data.passengers) || 1)
      const childSeats = Math.max(0, Number(data.childSeats) || 0)
      const boosterSeats = Math.max(0, Number(data.boosterSeats) || 0)
      if (childSeats + boosterSeats > passengers) {
        ctx.addIssue({
          code: 'custom',
          message: t(
            'taxi_fleet.trips.form.errors.seatsExceedPassengers',
            'Child and booster seats cannot exceed passenger count.',
          ),
          path: ['childSeats'],
        })
      }

      if (data.serviceType === 'airport') {
        const hand = Math.max(0, Number(data.handLuggage) || 0)
        const hold = Math.max(0, Number(data.holdLuggage) || 0)
        if (hand > passengers) {
          ctx.addIssue({
            code: 'custom',
            message: t(
              'taxi_fleet.trips.form.errors.handLuggageExceedsPassengers',
              'Hand luggage cannot exceed passenger count.',
            ),
            path: ['handLuggage'],
          })
        }
        if (hold > passengers) {
          ctx.addIssue({
            code: 'custom',
            message: t(
              'taxi_fleet.trips.form.errors.holdLuggageExceedsPassengers',
              'Hold luggage cannot exceed passenger count.',
            ),
            path: ['holdLuggage'],
          })
        }
        if (data.isAirportPickup && !data.flightNumber?.trim()) {
          ctx.addIssue({
            code: 'custom',
            message: t('taxi_fleet.trips.form.errors.flightRequired', 'Flight number is required for airport pickup.'),
            path: ['flightNumber'],
          })
        }
      } else if (Math.max(0, Number(data.holdLuggage) || 0) > 0) {
        ctx.addIssue({
          code: 'custom',
          message: t(
            'taxi_fleet.trips.form.errors.localHoldLuggage',
            'Hold luggage is only available for airport transfers.',
          ),
          path: ['holdLuggage'],
        })
      }
    })
}

export function isTripFormSubmittable(
  values: TripFormValues,
  t: TranslateFn,
  options?: TripFormValidationOptions,
): boolean {
  return tripFormSchema(t, options).safeParse(values).success
}

/** Human-readable blockers for create UX (submit was previously disabled silently). */
export function listTripFormBlockingIssues(
  values: TripFormValues,
  t: TranslateFn,
  options?: TripFormValidationOptions,
): string[] {
  const parsed = tripFormSchema(t, options).safeParse(values)
  if (parsed.success) return []
  const issues: string[] = []
  const seen = new Set<string>()
  for (const issue of parsed.error.issues) {
    const path = issue.path.map(String).join('.') || '_'
    if (seen.has(path)) continue
    seen.add(path)
    if (path === 'fromAddress' || path === 'toAddress') {
      issues.push(t('taxi_fleet.trips.form.errors.routeRequired', 'Enter pickup and drop-off addresses.'))
      seen.add('fromAddress')
      seen.add('toAddress')
      continue
    }
    if (path === 'teamMemberId') {
      issues.push(t('taxi_fleet.trips.form.errors.driverRequired', 'Select a driver.'))
      continue
    }
    if (path === 'resourceId') {
      issues.push(t('taxi_fleet.trips.form.errors.vehicleRequired', 'Select a vehicle.'))
      continue
    }
    if (path === 'customerEntityId') {
      issues.push(t('taxi_fleet.trips.form.errors.customerRequired', 'Customer is required for client trips.'))
      continue
    }
    issues.push(issue.message)
  }
  return issues
}

const ROUTE_FIELD_IDS = [
  'serviceType',
  'fromAddress',
  'waypointAddresses',
  'toAddress',
  '__routeDistanceSync',
  'distanceKm',
  'durationText',
]
const INTERNAL_TRIP_FORM_FIELD_IDS = [
  'fromLon',
  'fromLat',
  'toLon',
  'toLat',
  'routeWaypointMeta',
  'quoteSnapshotJson',
  'routeDurationSeconds',
  'routeSyncedFingerprint',
  'vehicleCategory',
  'basePrice',
]
const DETAILS_FIELD_IDS = [
  'passengers',
  'handLuggage',
  'holdLuggage',
  'childSeats',
  'boosterSeats',
  'englishSpeakingDriver',
  'flightNumber',
]
const ASSIGNMENT_FIELD_IDS = [
  'teamMemberId',
  'resourceId',
  'startedAtLocal',
  'endedAtLocal',
  'tripType',
  'platform',
]
const CUSTOMER_FIELD_IDS = [
  'customerEntityId',
  'contactName',
  'contactEmail',
  'contactPhone',
  'paymentType',
  '__tripQuoteSummary',
  'revenueAmount',
  'referringPartnerEntityId',
  'notes',
]
const PAGE_CUSTOMER_FIELD_IDS = [
  'customerEntityId',
  'contactName',
  'contactEmail',
  'contactPhone',
  'paymentType',
  'referringPartnerEntityId',
  'notes',
]
const PRICING_SIDEBAR_FIELD_IDS = ['__tripPricingSidebar']

/** Always-mounted sync group — kept outside tab filtering in dialog. */
export const TRIP_FORM_SYNC_GROUP_ID = 'trip-form-sync'

export function buildTripFormGroups(
  t: TranslateFn,
  surface: 'page' | 'dialog' = 'page',
  options?: { mode?: 'create' | 'edit' },
): CrudFormGroup[] {
  if (surface === 'dialog') {
    return [
      {
        id: TRIP_FORM_SYNC_GROUP_ID,
        column: 1,
        bare: true,
        component: ({ values, setValue, disabled }) => (
          <>
            <TripRouteDistanceSync
              values={values ?? {}}
              setFormValue={setValue}
              disabled={disabled || false}
            />
            <TripQuoteSync
              values={(values ?? {}) as TripFormValues}
              setFormValue={setValue}
              disabled={disabled || false}
            />
          </>
        ),
      },
      { id: 'trip-tab-route', column: 1, fields: ROUTE_FIELD_IDS.filter((id) => id !== '__routeDistanceSync') },
      { id: 'trip-tab-details', column: 1, fields: DETAILS_FIELD_IDS },
      { id: 'trip-tab-assignment', column: 1, fields: ASSIGNMENT_FIELD_IDS },
      { id: 'trip-tab-customer', column: 1, fields: CUSTOMER_FIELD_IDS },
    ]
  }

  const pageGroups: CrudFormGroup[] = [
    {
      id: 'route',
      title: t('taxi_fleet.trips.form.groups.route', 'Route'),
      column: 1,
      fields: ['__tripQuoteSync', ...ROUTE_FIELD_IDS],
    },
    {
      id: 'trip-details',
      title: t('taxi_fleet.trips.form.groups.tripDetails', 'Trip details'),
      column: 1,
      fields: DETAILS_FIELD_IDS,
    },
    {
      id: 'basics',
      title: t('taxi_fleet.trips.form.groups.basics', 'Assignment'),
      column: 1,
      fields: ASSIGNMENT_FIELD_IDS,
    },
    {
      id: 'customer',
      title: t('taxi_fleet.trips.form.groups.customer', 'Customer & billing'),
      column: 1,
      fields: PAGE_CUSTOMER_FIELD_IDS,
    },
  ]

  if (options?.mode === 'edit') {
    pageGroups.push({
      id: 'status',
      title: t('taxi_fleet.trips.form.groups.status', 'Status'),
      column: 2,
      fields: ['status'],
    })
  }

  pageGroups.push({
    id: 'pricing',
    title: t('taxi_fleet.trips.form.groups.pricing', 'Pricing'),
    column: 2,
    fields: PRICING_SIDEBAR_FIELD_IDS,
  })

  return pageGroups
}

export function buildTripFormFields(t: TranslateFn, options: TripFormOptions): CrudField[] {
  const {
    mode,
    surface = 'page',
    driverProfiles,
    resolveDriverName,
    readOnly = false,
    lockStatus = null,
    allowDriverEdit = false,
    driverLocked = false,
    lockedTeamMemberId = null,
    onAssignmentResolved,
    statusOptions: statusOptionsInput,
    defaultStatusCode,
    minAdvanceReference,
    minAdvanceHours = TRIP_MIN_ADVANCE_HOURS,
  } = options
  const fieldLocked = (fieldId: string) =>
    readOnly || (Boolean(lockStatus) && !isTripDetailFieldEditable(lockStatus as string, fieldId))
  const driverOptions: LookupSelectItem[] = driverProfiles.map((profile) => ({
    id: profile.teamMemberId,
    title: resolveDriverName(profile.teamMemberId),
  }))
  const tripTypeOptions = TAXI_FLEET_TRIP_TYPES.filter((type) => type !== 'event').map((type) => ({
    value: type,
    label: t(`taxi_fleet.trips.types.${type}`, type),
  }))
  const statusOptions = statusOptionsInput ?? []
  const lockedDisplayName =
    driverLocked && lockedTeamMemberId ? resolveDriverName(lockedTeamMemberId) : null
  const createMinLocal =
    mode === 'create'
      ? toDateTimeLocalValue(
          earliestTripStartDate(minAdvanceReference ?? new Date(), minAdvanceHours),
        )
      : undefined

  const assignmentFields: CrudField[] = []

  if (!driverLocked || surface === 'dialog') {
    assignmentFields.push({
      id: 'teamMemberId',
      type: 'custom',
      label: t('taxi_fleet.trips.driver', 'Driver'),
      required: true,
      layout: 'half',
      component: ({ value, setValue, disabled, readOnly: fieldReadOnly, values }) => (
        <TripDriverField
          value={typeof value === 'string' ? value : ''}
          onChange={(next) => setValue(next)}
          disabled={
            disabled ||
            fieldReadOnly ||
            fieldLocked('teamMemberId') ||
            driverLocked ||
            (mode === 'edit' && !allowDriverEdit)
          }
          driverOptions={driverOptions}
          startedAtLocal={typeof values?.startedAtLocal === 'string' ? values.startedAtLocal : ''}
          endedAtLocal={typeof values?.endedAtLocal === 'string' ? values.endedAtLocal : ''}
          lockedDisplayName={driverLocked ? lockedDisplayName : null}
        />
      ),
    })
  }

  assignmentFields.push(
    {
      id: 'resourceId',
      type: 'custom',
      label: t('taxi_fleet.assignments.vehicle', 'Vehicle'),
      required: true,
      layout: 'half',
      component: ({ value, setValue, disabled, readOnly: fieldReadOnly, values, setFormValue }) => (
        <TripVehicleField
          teamMemberId={
            driverLocked && lockedTeamMemberId
              ? lockedTeamMemberId
              : typeof values?.teamMemberId === 'string'
                ? values.teamMemberId
                : ''
          }
          startedAtLocal={typeof values?.startedAtLocal === 'string' ? values.startedAtLocal : ''}
          endedAtLocal={typeof values?.endedAtLocal === 'string' ? values.endedAtLocal : ''}
          value={typeof value === 'string' ? value : ''}
          onChange={(next) => setValue(next)}
          onVehicleCategoryChange={(category) => setFormValue?.('vehicleCategory', category)}
          disabled={disabled || fieldReadOnly || fieldLocked('resourceId')}
          onAssignmentResolved={onAssignmentResolved}
        />
      ),
    },
  )

  assignmentFields.push(
    {
      id: 'startedAtLocal',
      type: 'custom',
      label: t('taxi_fleet.trips.started', 'Started'),
      required: true,
      layout: 'half',
      component: ({ id, value, setValue, disabled, readOnly: fieldReadOnly, autoFocus }) => (
        <TripDateTimeLocalField
          id={id}
          value={typeof value === 'string' ? value : ''}
          onChange={(next) => setValue(next)}
          disabled={disabled}
          readOnly={fieldReadOnly || fieldLocked('startedAtLocal')}
          autoFocus={autoFocus}
          min={createMinLocal}
        />
      ),
    },
    {
      id: 'endedAtLocal',
      type: 'custom',
      label: t('taxi_fleet.trips.ended', 'Ended'),
      required: true,
      layout: 'half',
      component: ({ id, value, setValue, disabled, readOnly: fieldReadOnly }) => (
        <TripDateTimeLocalField
          id={id}
          value={typeof value === 'string' ? value : ''}
          onChange={(next) => setValue(next)}
          disabled={disabled}
          readOnly={fieldReadOnly || fieldLocked('endedAtLocal')}
        />
      ),
    },
    {
      id: 'tripType',
      type: 'select',
      label: t('taxi_fleet.trips.type', 'Type'),
      required: true,
      layout: 'half',
      options: tripTypeOptions,
    },
    {
      id: 'platform',
      type: 'select',
      label: t('taxi_fleet.trips.platform', 'Platform'),
      layout: 'half',
      options: [
        { value: '', label: t('taxi_fleet.trips.platforms.none', 'None') },
        ...TAXI_FLEET_TRIP_PLATFORMS.map((platform) => ({
          value: platform,
          label: t(`taxi_fleet.trips.platforms.${platform}`, platform),
        })),
      ],
    },
  )

  const customerFields: CrudField[] = [
    {
      id: 'customerEntityId',
      type: 'custom',
      label: t('taxi_fleet.trips.customer', 'Customer'),
      required: false,
      layout: 'full',
      component: ({ value, setValue, disabled, readOnly: fieldReadOnly, values }) => {
        const companyName =
          typeof values?.companyName === 'string' ? values.companyName.trim() : ''
        const contactName =
          typeof values?.contactName === 'string' ? values.contactName.trim() : ''
        return (
          <TripCustomerField
            value={typeof value === 'string' ? value : ''}
            onChange={(next) => setValue(next)}
            disabled={disabled || fieldReadOnly || readOnly}
            fallbackLabel={companyName || contactName || undefined}
          />
        )
      },
    },
    ...buildTripRequestFormFields(t, { readOnly }).filter((field) =>
      ['contactName', 'contactPhone', 'contactEmail', 'paymentType', 'referringPartnerEntityId'].includes(
        field.id,
      ),
    ),
  ]

  if (surface === 'dialog') {
    customerFields.push({
      id: 'revenueAmount',
      type: 'custom',
      label: t('taxi_fleet.trips.form.finalPrice', 'Final price'),
      layout: 'half',
      component: ({ value, setValue, disabled, readOnly: fieldReadOnly }) => (
        <MoneyInputField
          value={typeof value === 'string' ? value : ''}
          onChange={(next) => setValue(next)}
          disabled={disabled}
          readOnly={fieldReadOnly || readOnly}
        />
      ),
    })
  }

  customerFields.push({
    id: 'notes',
    type: 'textarea',
    label: t('taxi_fleet.trips.notes', 'Notes'),
    layout: 'full',
  })

  const requestFields = buildTripRequestFormFields(t, { readOnly }).filter((field) =>
    TRIP_REQUEST_FIELD_IDS.has(field.id) &&
    !['contactName', 'contactPhone', 'contactEmail', 'referringPartnerEntityId', 'contactType', 'companyName', 'companyTaxId', 'paymentType', 'vehicleCategory', 'basePrice', 'revenueAmount', 'quoteSnapshotJson'].includes(
      field.id,
    ),
  )

  const byId = new Map<string, CrudField>()
  for (const field of [...requestFields, ...assignmentFields, ...customerFields]) {
    byId.set(field.id, field)
  }

  if (!byId.has('revenueAmount')) {
    byId.set('revenueAmount', {
      id: 'revenueAmount',
      type: 'custom',
      label: t('taxi_fleet.trips.form.finalPrice', 'Final price'),
      layout: 'half',
      component: ({ value, setValue, disabled, readOnly: fieldReadOnly }) => (
        <MoneyInputField
          value={typeof value === 'string' ? value : ''}
          onChange={(next) => setValue(next)}
          disabled={disabled}
          readOnly={fieldReadOnly || readOnly}
        />
      ),
    })
  }

  for (const internalId of INTERNAL_TRIP_FORM_FIELD_IDS) {
    if (byId.has(internalId)) continue
    byId.set(internalId, {
      id: internalId,
      type: 'text',
      label: '',
    })
  }

  if (mode === 'edit') {
    byId.set('status', {
      id: 'status',
      type: 'custom',
      label: t('taxi_fleet.trips.status', 'Status'),
      layout: 'full',
      component: ({ value, setValue, disabled, readOnly: fieldReadOnly }) => (
        <TripStatusField
          value={typeof value === 'string' ? value : ''}
          onChange={(next) => setValue(next)}
          disabled={disabled || fieldReadOnly || readOnly}
        />
      ),
    })
  }

  byId.set('__routeDistanceSync', {
    id: '__routeDistanceSync',
    type: 'custom',
    label: '',
    layout: 'full',
    component: ({ values, setFormValue, disabled, readOnly: fieldReadOnly }) => (
      <TripRouteDistanceSync
        values={values ?? {}}
        setFormValue={setFormValue}
        disabled={disabled || fieldReadOnly || readOnly}
      />
    ),
  })

  byId.set('__tripQuoteSync', {
    id: '__tripQuoteSync',
    type: 'custom',
    label: '',
    layout: 'full',
    component: ({ values, setFormValue, disabled, readOnly: fieldReadOnly }) => (
      <TripQuoteSync
        values={(values ?? {}) as TripFormValues}
        setFormValue={setFormValue}
        disabled={disabled || fieldReadOnly || readOnly}
      />
    ),
  })

  byId.set('__tripQuoteSummary', {
    id: '__tripQuoteSummary',
    type: 'custom',
    label: t('taxi_fleet.trips.form.quote.title', 'Quote'),
    layout: 'half',
    component: ({ values }) => <TripQuoteAmountField values={values ?? {}} />,
  })

  byId.set('__tripPricingSidebar', {
    id: '__tripPricingSidebar',
    type: 'custom',
    label: '',
    layout: 'full',
    component: ({ values, setFormValue, disabled, readOnly: fieldReadOnly }) => (
      <TripPricingSidebar
        values={(values ?? {}) as TripFormValues}
        setFormValue={setFormValue}
        disabled={disabled}
        readOnly={fieldReadOnly || readOnly}
      />
    ),
  })

  const orderedIds =
    surface === 'dialog'
      ? [...ROUTE_FIELD_IDS, ...DETAILS_FIELD_IDS, ...ASSIGNMENT_FIELD_IDS, ...CUSTOMER_FIELD_IDS, ...INTERNAL_TRIP_FORM_FIELD_IDS]
      : [
          ...ROUTE_FIELD_IDS,
          ...DETAILS_FIELD_IDS,
          ...ASSIGNMENT_FIELD_IDS,
          ...PAGE_CUSTOMER_FIELD_IDS,
          ...PRICING_SIDEBAR_FIELD_IDS,
          ...(mode === 'edit' ? ['status'] : []),
          ...INTERNAL_TRIP_FORM_FIELD_IDS,
        ]

  return orderedIds
    .map((id) => byId.get(id))
    .filter((field): field is CrudField => Boolean(field))
    .map((field) => {
      if (!fieldLocked(field.id)) return field
      // `readOnly` is the CrudForm standard (bg-muted/20). Also set `disabled` so pickers /
      // custom fields stay locked even when an older @open-mercato/ui build does not forward readOnly.
      return { ...field, readOnly: true, disabled: true }
    })
}

export function mapTripRowToFormValues(row: {
  teamMemberId: string
  resourceId: string
  customerPersonId?: string | null
  customerCompanyId?: string | null
  tripType: string
  platform?: string | null
  startedAt?: string | null
  endedAt?: string | null
  revenueAmount?: string | null
  distanceKm?: string | null
  notes?: string | null
  status: string
  metadata?: Record<string, unknown> | null
}): TripFormValues {
  const request = tripRequestDetailsFromMetadata(row.metadata ?? null, {
    distanceKm: row.distanceKm ?? null,
    revenueAmount: row.revenueAmount ?? null,
  })
  const quoteSnapshot = readQuoteSnapshotFromMetadata(row.metadata ?? null)
  const quotedTotal =
    quoteSnapshot && typeof quoteSnapshot.totalPrice === 'number'
      ? String(quoteSnapshot.totalPrice)
      : ''
  const formValues: TripFormValues = {
    teamMemberId: row.teamMemberId,
    resourceId: row.resourceId,
    customerEntityId: readTripCustomerEntityId({
      customerPersonId: row.customerPersonId ?? null,
      customerCompanyId: row.customerCompanyId ?? null,
    }) ?? '',
    tripType: row.tripType,
    platform: row.platform ?? '',
    startedAtLocal: row.startedAt ? normalizeDateTimeLocalInput(isoToDateTimeLocalValue(row.startedAt)) : '',
    endedAtLocal: row.endedAt ? normalizeDateTimeLocalInput(isoToDateTimeLocalValue(row.endedAt)) : '',
    revenueAmount: row.revenueAmount ?? quotedTotal ?? request.basePrice ?? '',
    notes: row.notes ?? '',
    status: row.status,
    fromLon: '',
    fromLat: '',
    toLon: '',
    toLat: '',
    routeWaypointMeta: '',
    quoteSnapshotJson: quoteSnapshot ? JSON.stringify(quoteSnapshot) : '',
    routeDurationSeconds: '',
    routeSyncedFingerprint: '',
    ...request,
  }
  formValues.routeSyncedFingerprint = buildTripRouteFingerprint(formValues)
  return formValues
}

function buildTripPayloadExtras(values: TripFormValues) {
  const details = pickTripRequestDetails(values)
  const distanceKm = parseTripRequestNumericDistance(details)
  const revenueAmount = parseTripRequestRevenueAmount(details, values.revenueAmount)
  const routeNotes = buildTripRouteNotes(details)
  const manualNotes = values.notes.trim()
  const notes = [routeNotes, manualNotes].filter((line) => line && line.length).join('\n\n') || undefined
  let metadata = buildTripRequestMetadata(details)
  const quoteSnapshotRaw = values.quoteSnapshotJson.trim()
  if (quoteSnapshotRaw.length) {
    try {
      metadata = {
        ...metadata,
        quoteSnapshot: JSON.parse(quoteSnapshotRaw) as Record<string, unknown>,
      }
    } catch {
      // ignore invalid quote snapshot payload
    }
  }
  if (values.routeSyncedFingerprint.trim() && distanceKm != null && distanceKm > 0) {
    metadata = {
      ...metadata,
      distanceSource: 'route',
      routeDistanceKm: distanceKm.toFixed(2),
    }
  }
  return {
    distanceKm,
    revenueAmount,
    notes,
    metadata,
  }
}

export function tripFormValuesToPayload(
  values: TripFormValues,
  scope: { tenantId: string; organizationId: string },
  options?: { assignmentId?: string | null; defaultStatusCode?: string },
) {
  const startedAt = new Date(values.startedAtLocal)
  const endedAt = new Date(values.endedAtLocal)
  const extras = buildTripPayloadExtras(values)
  const assignmentId = options?.assignmentId?.trim()
  return {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    teamMemberId: values.teamMemberId,
    resourceId: values.resourceId,
    ...(values.customerEntityId ? { customerEntityId: values.customerEntityId } : {}),
    tripType: values.tripType,
    platform: values.platform?.trim() ? values.platform : null,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    distanceKm: extras.distanceKm,
    revenueAmount: extras.revenueAmount,
    notes: extras.notes,
    metadata: extras.metadata,
    status: values.status || options?.defaultStatusCode || 'new',
    ...(assignmentId ? { assignmentId } : {}),
  }
}

export function tripFormValuesToUpdatePayload(id: string, values: TripFormValues) {
  const startedAt = new Date(values.startedAtLocal)
  const endedAt = new Date(values.endedAtLocal)
  const extras = buildTripPayloadExtras(values)
  return {
    id,
    teamMemberId: values.teamMemberId,
    resourceId: values.resourceId,
    ...(values.customerEntityId ? { customerEntityId: values.customerEntityId } : {}),
    tripType: values.tripType,
    platform: values.platform?.trim() ? values.platform : null,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    distanceKm: extras.distanceKm ?? null,
    revenueAmount: extras.revenueAmount ?? null,
    notes: extras.notes ?? null,
    metadata: extras.metadata,
    status: values.status,
  }
}
