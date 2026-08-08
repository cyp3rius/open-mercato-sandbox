'use client'

import * as React from 'react'
import type { TranslateFn } from '@open-mercato/shared/lib/i18n/context'
import type { CrudField } from '@open-mercato/ui/backend/CrudForm'
import { CounterInputField } from '@open-mercato/ui/backend/inputs/CounterInputField'
import { TripFormSwitchField } from './TripFormSwitchField'
import { TripRouteAddressField } from './route/TripRouteAddressField'
import { TripWaypointFields } from './route/TripWaypointFields'
import {
  TRIP_CONTACT_TYPES,
  TRIP_FORM_PAYMENT_OPTIONS,
  TRIP_SERVICE_TYPES,
  type TripRequestDetails,
} from '../lib/tripRequestForm'
import { searchPartnerEntityOptions } from '../lib/partnerEntitySearch'

type TripRequestFieldOptions = {
  readOnly?: boolean
}

function readPassengers(values: Record<string, unknown> | undefined): number {
  const parsed = Number(values?.passengers)
  return Number.isFinite(parsed) && parsed >= 1 ? Math.trunc(parsed) : 1
}

function isAirportService(values: Record<string, unknown>): boolean {
  return values.serviceType === 'airport'
}

function isCompanyContact(values: Record<string, unknown>): boolean {
  return values.contactType === 'company'
}

function isAirportPickup(values: Record<string, unknown>): boolean {
  return isAirportService(values) && values.isAirportPickup === true
}

export function buildTripRequestFormFields(t: TranslateFn, options: TripRequestFieldOptions = {}): CrudField[] {
  const { readOnly: formReadOnly = false } = options

  return [
    {
      id: 'serviceType',
      type: 'select',
      label: t('taxi_fleet.trips.form.serviceType', 'Service type'),
      required: true,
      layout: 'full',
      options: TRIP_SERVICE_TYPES.map((value) => ({
        value,
        label: t(`taxi_fleet.trips.form.serviceTypes.${value}`, value),
      })),
    },
    {
      id: 'fromAddress',
      type: 'custom',
      label: t('taxi_fleet.trips.form.fromAddress', 'From'),
      required: true,
      layout: 'full',
      component: ({ value, setValue, disabled, readOnly: fieldReadOnly, values, setFormValue }) => (
        <TripRouteAddressField
          value={typeof value === 'string' ? value : ''}
          onChange={(next) => setValue(next)}
          onCoordsChange={(lon, lat) => {
            setFormValue?.('fromLon', lon)
            setFormValue?.('fromLat', lat)
          }}
          disabled={disabled || formReadOnly || Boolean(fieldReadOnly)}
          airportDefaults={values?.serviceType === 'airport'}
        />
      ),
    },
    {
      id: 'waypointAddresses',
      type: 'custom',
      label: t('taxi_fleet.trips.form.waypointAddresses', 'Stops'),
      description: t('taxi_fleet.trips.form.waypointAddressesHelp', 'Add intermediate stops on the route.'),
      layout: 'full',
      component: ({ value, setValue, disabled, readOnly: fieldReadOnly, values, setFormValue }) => (
        <TripWaypointFields
          value={typeof value === 'string' ? value : ''}
          metaJson={typeof values?.routeWaypointMeta === 'string' ? values.routeWaypointMeta : ''}
          disabled={disabled || formReadOnly || Boolean(fieldReadOnly)}
          onChange={(addresses, metaJson) => {
            setValue(addresses)
            setFormValue?.('routeWaypointMeta', metaJson)
          }}
        />
      ),
    },
    {
      id: 'toAddress',
      type: 'custom',
      label: t('taxi_fleet.trips.form.toAddress', 'To'),
      required: true,
      layout: 'full',
      component: ({ value, setValue, disabled, readOnly: fieldReadOnly, values, setFormValue }) => (
        <TripRouteAddressField
          value={typeof value === 'string' ? value : ''}
          onChange={(next) => setValue(next)}
          onCoordsChange={(lon, lat) => {
            setFormValue?.('toLon', lon)
            setFormValue?.('toLat', lat)
          }}
          disabled={disabled || formReadOnly || Boolean(fieldReadOnly)}
          airportDefaults={values?.serviceType === 'airport'}
        />
      ),
    },
    {
      id: 'distanceKm',
      type: 'number',
      label: t('taxi_fleet.trips.form.distanceKm', 'Distance (km)'),
      description: t('taxi_fleet.trips.form.distanceKmHelp', 'Calculated automatically from the route; you can adjust manually.'),
      layout: 'half',
    },
    {
      id: 'durationText',
      type: 'text',
      label: t('taxi_fleet.trips.form.durationText', 'Estimated duration'),
      description: t('taxi_fleet.trips.form.durationTextHelp', 'Calculated automatically from the route.'),
      layout: 'half',
      placeholder: t('taxi_fleet.trips.form.durationPlaceholder', 'e.g. 45 min'),
    },
    {
      id: 'passengers',
      type: 'custom',
      label: t('taxi_fleet.trips.form.passengers', 'Passengers'),
      required: true,
      layout: 'third',
      component: ({ value, setValue, disabled, readOnly: fieldReadOnly }) => (
        <CounterInputField
          value={typeof value === 'string' ? value : '1'}
          onChange={(next) => setValue(next)}
          min={1}
          max={8}
          disabled={disabled || formReadOnly || Boolean(fieldReadOnly)}
        />
      ),
    },
    {
      id: 'handLuggage',
      type: 'custom',
      label: t('taxi_fleet.trips.form.handLuggage', 'Hand luggage'),
      layout: 'third',
      visibleWhen: isAirportService,
      component: ({ value, setValue, disabled, readOnly: fieldReadOnly, values }) => (
        <CounterInputField
          value={typeof value === 'string' ? value : '0'}
          onChange={(next) => setValue(next)}
          min={0}
          max={readPassengers(values as Record<string, unknown>)}
          disabled={disabled || formReadOnly || Boolean(fieldReadOnly)}
        />
      ),
    },
    {
      id: 'holdLuggage',
      type: 'custom',
      label: t('taxi_fleet.trips.form.holdLuggage', 'Hold luggage'),
      layout: 'third',
      visibleWhen: isAirportService,
      component: ({ value, setValue, disabled, readOnly: fieldReadOnly, values }) => (
        <CounterInputField
          value={typeof value === 'string' ? value : '0'}
          onChange={(next) => setValue(next)}
          min={0}
          max={readPassengers(values as Record<string, unknown>)}
          disabled={disabled || formReadOnly || Boolean(fieldReadOnly)}
        />
      ),
    },
    {
      id: 'childSeats',
      type: 'custom',
      label: t('taxi_fleet.trips.form.childSeats', 'Child seats'),
      layout: 'third',
      component: ({ value, setValue, disabled, readOnly: fieldReadOnly, values }) => {
        const passengers = readPassengers(values as Record<string, unknown>)
        const boosters = Number((values as Record<string, unknown> | undefined)?.boosterSeats) || 0
        return (
          <CounterInputField
            value={typeof value === 'string' ? value : '0'}
            onChange={(next) => setValue(next)}
            min={0}
            max={Math.max(0, passengers - boosters)}
            disabled={disabled || formReadOnly || Boolean(fieldReadOnly)}
          />
        )
      },
    },
    {
      id: 'boosterSeats',
      type: 'custom',
      label: t('taxi_fleet.trips.form.boosterSeats', 'Booster seats'),
      layout: 'third',
      component: ({ value, setValue, disabled, readOnly: fieldReadOnly, values }) => {
        const passengers = readPassengers(values as Record<string, unknown>)
        const childSeats = Number((values as Record<string, unknown> | undefined)?.childSeats) || 0
        return (
          <CounterInputField
            value={typeof value === 'string' ? value : '0'}
            onChange={(next) => setValue(next)}
            min={0}
            max={Math.max(0, passengers - childSeats)}
            disabled={disabled || formReadOnly || Boolean(fieldReadOnly)}
          />
        )
      },
    },
    {
      id: 'englishSpeakingDriver',
      type: 'custom',
      label: '',
      layout: 'full',
      component: ({ value, setValue, setFormValue, disabled, readOnly: fieldReadOnly, values }) => {
        const airport = isAirportService((values ?? {}) as Record<string, unknown>)
        const locked = formReadOnly || Boolean(fieldReadOnly)
        return (
          <div className={airport ? 'grid grid-cols-1 gap-4 md:grid-cols-3' : undefined}>
            <TripFormSwitchField
              label={t('taxi_fleet.trips.form.englishSpeakingDriver', 'English-speaking driver')}
              checked={value === true}
              onChange={(next) => setValue(next)}
              disabled={disabled}
              readOnly={locked}
            />
            {airport ? (
              <>
                <TripFormSwitchField
                  label={t('taxi_fleet.trips.form.isAirportPickup', 'Airport pickup')}
                  checked={(values as Record<string, unknown> | undefined)?.isAirportPickup === true}
                  onChange={(next) => setFormValue?.('isAirportPickup', next)}
                  disabled={disabled}
                  readOnly={locked}
                />
                <TripFormSwitchField
                  label={t('taxi_fleet.trips.form.meetAndGreet', 'Meet & greet in arrivals hall')}
                  checked={(values as Record<string, unknown> | undefined)?.meetAndGreet === true}
                  onChange={(next) => setFormValue?.('meetAndGreet', next)}
                  disabled={disabled}
                  readOnly={locked}
                />
              </>
            ) : null}
          </div>
        )
      },
    },
    {
      id: 'flightNumber',
      type: 'text',
      label: t('taxi_fleet.trips.form.flightNumber', 'Flight number'),
      layout: 'full',
      placeholder: 'FR 1234',
      visibleWhen: isAirportPickup,
    },
    {
      id: 'contactType',
      type: 'select',
      label: t('taxi_fleet.trips.form.contactType', 'Client type'),
      layout: 'half',
      options: TRIP_CONTACT_TYPES.map((value) => ({
        value,
        label: t(`taxi_fleet.trips.form.contactTypes.${value}`, value),
      })),
    },
    {
      id: 'companyName',
      type: 'text',
      label: t('taxi_fleet.trips.form.companyName', 'Company name'),
      layout: 'half',
      visibleWhen: isCompanyContact,
    },
    {
      id: 'companyTaxId',
      type: 'text',
      label: t('taxi_fleet.trips.form.companyTaxId', 'Tax ID / VAT EU'),
      layout: 'half',
      visibleWhen: isCompanyContact,
    },
    {
      id: 'contactName',
      type: 'text',
      label: t('taxi_fleet.trips.form.contactPerson', 'Contact person'),
      layout: 'full',
    },
    {
      id: 'contactEmail',
      type: 'text',
      label: t('taxi_fleet.trips.form.contactEmail', 'Email'),
      layout: 'half',
    },
    {
      id: 'contactPhone',
      type: 'text',
      label: t('taxi_fleet.trips.form.contactPhone', 'Phone'),
      layout: 'half',
    },
    {
      id: 'paymentType',
      type: 'select',
      label: t('taxi_fleet.trips.form.paymentType', 'Payment method'),
      layout: 'half',
      options: TRIP_FORM_PAYMENT_OPTIONS.map((value) => ({
        value,
        label: t(`taxi_fleet.trips.form.paymentTypes.${value}`, value),
      })),
    },
    {
      id: 'referringPartnerEntityId',
      type: 'select',
      label: t('taxi_fleet.trips.form.referrer', 'Referrer'),
      layout: 'full',
      loadOptions: (query) =>
        searchPartnerEntityOptions(query, {
          personPrefix: t('taxi_fleet.trips.form.partnerSearch.person', 'Person'),
          companyPrefix: t('taxi_fleet.trips.form.partnerSearch.company', 'Company'),
        }),
      useEntitySearchCombobox: true,
      remoteSelectSearch: true,
      createInNewTabHref: '/backend/customers/companies/create',
      description: t(
        'taxi_fleet.trips.form.referringPartyHint',
        'Only CRM records of type partner or referrer.',
      ),
    },
  ]
}

export function pickTripRequestDetails(values: TripRequestDetails & Record<string, unknown>): TripRequestDetails {
  return {
    serviceType: values.serviceType === 'airport' ? 'airport' : 'local',
    fromAddress: String(values.fromAddress ?? ''),
    toAddress: String(values.toAddress ?? ''),
    waypointAddresses: String(values.waypointAddresses ?? ''),
    distanceKm: String(values.distanceKm ?? ''),
    durationText: String(values.durationText ?? ''),
    passengers: String(values.passengers ?? '1'),
    handLuggage: String(values.handLuggage ?? '0'),
    holdLuggage: String(values.holdLuggage ?? '0'),
    childSeats: String(values.childSeats ?? '0'),
    boosterSeats: String(values.boosterSeats ?? '0'),
    isAirportPickup: values.isAirportPickup === true,
    flightNumber: String(values.flightNumber ?? ''),
    meetAndGreet: values.meetAndGreet === true,
    englishSpeakingDriver: values.englishSpeakingDriver === true,
    paymentType:
      values.paymentType === 'cash' ||
      values.paymentType === 'card' ||
      values.paymentType === 'transfer' ||
      values.paymentType === 'other'
        ? values.paymentType
        : 'electronic',
    contactName: String(values.contactName ?? ''),
    contactPhone: String(values.contactPhone ?? ''),
    contactEmail: String(values.contactEmail ?? ''),
    contactType: values.contactType === 'company' ? 'company' : 'private',
    companyName: String(values.companyName ?? ''),
    companyTaxId: String(values.companyTaxId ?? ''),
    vehicleCategory: String(values.vehicleCategory ?? ''),
    basePrice: String(values.basePrice ?? ''),
    referringPartnerEntityId: String(values.referringPartnerEntityId ?? ''),
  }
}
