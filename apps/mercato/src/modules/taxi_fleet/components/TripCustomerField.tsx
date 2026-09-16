"use client"

import * as React from 'react'
import { Building2, Plus, UserRound } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { EntitySearchCombobox } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import type { EntitySearchComboboxOption } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import { Button } from '@open-mercato/ui/primitives/button'
import { IconButton } from '@open-mercato/ui/primitives/icon-button'
import { Popover, PopoverContent, PopoverTrigger } from '@open-mercato/ui/primitives/popover'
import {
  mergeEntitySearchOption,
  remoteSearchFleetCustomers,
  resolveFleetCustomerDisplayLabel,
} from '../lib/fleetCustomerEntitySearch'
import { normalizeDriverCustomerPhone } from '../lib/driverCustomerPhone'
import {
  decodePendingTripCustomerPhone,
  encodePendingTripCustomerPhone,
  isPendingTripCustomerPhone,
} from '../lib/pendingTripCustomerPhone'

const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUsableCustomerLabel(value: string | null | undefined): value is string {
  if (!value) return false
  const trimmed = value.trim()
  return trimmed.length > 0 && !UUID_LIKE.test(trimmed)
}

function pickInitialLabel(value: string, fallbackLabel?: string): string {
  const pendingPhone = decodePendingTripCustomerPhone(value)
  if (pendingPhone) return pendingPhone
  const fallback = fallbackLabel?.trim() ?? ''
  if (isUsableCustomerLabel(fallback)) return fallback
  return ''
}

type TripCustomerFieldProps = {
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  /** Prefer when CRM label lookup is slow/unavailable (e.g. trip contact/company name). */
  fallbackLabel?: string
}

function buildPendingPhoneOption(
  query: string,
  t: (key: string, fallback: string, params?: Record<string, string>) => string,
): EntitySearchComboboxOption | null {
  const normalized = normalizeDriverCustomerPhone(query)
  if (!normalized) return null
  return {
    value: encodePendingTripCustomerPhone(normalized),
    label: t(
      'taxi_fleet.trips.customerUsePhone',
      'Use phone {phone} (create on save)',
      { phone: normalized },
    ),
    description: t(
      'taxi_fleet.trips.customerUsePhoneHint',
      'No matching customer — a person will be created when you save the trip.',
    ),
  }
}

export function TripCustomerField({
  value,
  onChange,
  disabled = false,
  fallbackLabel,
}: TripCustomerFieldProps) {
  const t = useT()
  const [label, setLabel] = React.useState(() => pickInitialLabel(value, fallbackLabel))
  const [createMenuOpen, setCreateMenuOpen] = React.useState(false)

  const kindLabels = React.useMemo(
    () => ({
      person: t('taxi_fleet.trips.customerKind.person', 'Person'),
      company: t('taxi_fleet.trips.customerKind.company', 'Company'),
    }),
    [t],
  )

  React.useEffect(() => {
    let cancelled = false
    const trimmed = value.trim()
    if (!trimmed.length) {
      setLabel('')
      return
    }
    if (isPendingTripCustomerPhone(trimmed)) {
      setLabel(pickInitialLabel(trimmed, fallbackLabel))
      return
    }
    setLabel(pickInitialLabel(trimmed, fallbackLabel))
    void resolveFleetCustomerDisplayLabel(trimmed).then((resolved) => {
      if (cancelled) return
      if (isUsableCustomerLabel(resolved)) {
        setLabel(resolved.trim())
        return
      }
      setLabel(pickInitialLabel(trimmed, fallbackLabel))
    })
    return () => {
      cancelled = true
    }
  }, [fallbackLabel, value])

  const openCreate = React.useCallback((href: string) => {
    window.open(href, '_blank', 'noopener,noreferrer')
    setCreateMenuOpen(false)
  }, [])

  const displayLabel = label || pickInitialLabel(value, fallbackLabel)
  const usableDisplayLabel = isUsableCustomerLabel(displayLabel)
    ? displayLabel
    : ''
  const optionLabel =
    usableDisplayLabel ||
    (value.trim()
      ? t('taxi_fleet.trips.customerResolving', 'Loading customer…')
      : '')

  if (disabled) {
    return (
      <p className="text-sm text-foreground">
        {usableDisplayLabel || t('taxi_fleet.trips.customerUnknown', 'Unknown customer')}
      </p>
    )
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <EntitySearchCombobox
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="min-w-0 flex-1"
        options={value.trim() ? mergeEntitySearchOption([], value, optionLabel) : []}
        selectedDisplayOverride={usableDisplayLabel || optionLabel || undefined}
        onRemoteSearch={async (query) => {
          const rows = await remoteSearchFleetCustomers(query, kindLabels)
          const pending = buildPendingPhoneOption(query, t)
          const withPending =
            pending && !rows.some((row) => row.value === pending.value)
              ? [pending, ...rows]
              : rows
          return mergeEntitySearchOption(
            withPending,
            value,
            usableDisplayLabel || optionLabel,
          )
        }}
        placeholder={t('taxi_fleet.trips.customerSearch', 'Search customer…')}
        searchPlaceholder={t(
          'taxi_fleet.trips.customerSearchPhoneHint',
          'Search by name or phone…',
        )}
        emptyText={t('taxi_fleet.trips.customerEmpty', 'No customers found.')}
      />
      <Popover open={createMenuOpen} onOpenChange={setCreateMenuOpen}>
        <PopoverTrigger asChild>
          <IconButton
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            aria-label={t('taxi_fleet.trips.customerCreate', 'Create customer')}
            className="size-9 shrink-0"
          >
            <Plus className="size-4" />
          </IconButton>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-52 p-1">
          <Button
            type="button"
            variant="ghost"
            className="h-auto w-full justify-start gap-2 px-2 py-2 text-sm font-normal"
            onClick={() => openCreate('/backend/customers/people/create')}
          >
            <UserRound className="size-4 shrink-0 text-muted-foreground" />
            {t('taxi_fleet.trips.customerCreatePerson', 'Create person')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-auto w-full justify-start gap-2 px-2 py-2 text-sm font-normal"
            onClick={() => openCreate('/backend/customers/companies/create')}
          >
            <Building2 className="size-4 shrink-0 text-muted-foreground" />
            {t('taxi_fleet.trips.customerCreateCompany', 'Create company')}
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  )
}
