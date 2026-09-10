'use client'

import React from 'react'
import { Building2, Plus, UserRound, X } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { Button } from '@open-mercato/ui/primitives/button'
import {
  driverCardClass,
  driverFieldClass,
  driverLabelClass,
  driverPrimaryActionClass,
  driverSecondaryActionClass,
  driverSectionTitleClass,
} from './driverUi'

type CustomerOption = {
  id: string
  label: string
  description?: string
  kind?: string
}

type Props = {
  value: string
  label?: string
  onChange: (next: { id: string; label: string }) => void
  disabled?: boolean
  required?: boolean
}

export function DriverCustomerField({
  value,
  label,
  onChange,
  disabled = false,
  required = false,
}: Props) {
  const t = useT()
  const [query, setQuery] = React.useState('')
  const [options, setOptions] = React.useState<CustomerOption[]>([])
  const [searching, setSearching] = React.useState(false)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createKind, setCreateKind] = React.useState<'person' | 'company'>('person')
  const [createName, setCreateName] = React.useState('')
  const [createPhone, setCreatePhone] = React.useState('')
  const [createNip, setCreateNip] = React.useState('')
  const [createBusy, setCreateBusy] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)

  const minSearchLength = 3
  const phoneOk = createPhone.trim().length >= 5
  const nipDigits = createNip.replace(/\D/g, '')
  const nipOk = nipDigits.length === 10
  const createReady = phoneOk && (createKind === 'person' || nipOk)

  React.useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < minSearchLength) {
      setOptions([])
      setSearching(false)
      return
    }
    let active = true
    const handle = window.setTimeout(() => {
      void (async () => {
        setSearching(true)
        try {
          const params = new URLSearchParams({ search: trimmed })
          const { result } = await apiCall<{ items: CustomerOption[] }>(
            `/api/taxi_fleet/driver/customers?${params.toString()}`,
          )
          if (!active) return
          setOptions(result?.items ?? [])
        } catch {
          if (active) setOptions([])
        } finally {
          if (active) setSearching(false)
        }
      })()
    }, 250)
    return () => {
      active = false
      window.clearTimeout(handle)
    }
  }, [query])

  async function createCustomer() {
    if (!phoneOk) {
      setCreateError(
        t('taxi_fleet.driverApp.customers.phoneRequired', 'Phone number is required.'),
      )
      return
    }
    if (createKind === 'company' && !nipOk) {
      setCreateError(
        t('taxi_fleet.driverApp.customers.nipRequired', 'NIP is required (10 digits).'),
      )
      return
    }
    setCreateBusy(true)
    setCreateError(null)
    try {
      const { result } = await apiCall<{ id: string; label: string }>(
        '/api/taxi_fleet/driver/customers',
        {
          method: 'POST',
          body: JSON.stringify({
            kind: createKind,
            displayName: createName.trim() || undefined,
            primaryPhone: createPhone.trim(),
            ...(createKind === 'company' ? { nip: createNip.trim() } : {}),
          }),
        },
      )
      if (!result?.id) {
        throw new Error('missing customer id')
      }
      onChange({ id: result.id, label: result.label })
      setCreateOpen(false)
      setCreateName('')
      setCreatePhone('')
      setCreateNip('')
      setQuery('')
    } catch {
      setCreateError(
        t('taxi_fleet.driverApp.customers.createFailed', 'Could not create customer.'),
      )
    } finally {
      setCreateBusy(false)
    }
  }

  const customerLabel = t('taxi_fleet.driverApp.trips.customer', 'Customer')

  return (
    <div className="space-y-3">
      {value ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-[#DBDFE9] bg-[#F9F9F9] px-3 py-2.5">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-[#071437]">
              {label || value}
            </div>
            <div className="text-xs text-[#78829D]">
              {t('taxi_fleet.driverApp.trips.customerSelected', 'Selected customer')}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 px-2 text-[#78829D]"
            disabled={disabled}
            onClick={() => onChange({ id: '', label: '' })}
            aria-label={t('taxi_fleet.driverApp.trips.customerClear', 'Clear customer')}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      ) : (
        <>
          <div>
            <label htmlFor="driver-customer-search" className={driverLabelClass}>
              {customerLabel}
              {required ? <span className="text-red-600"> *</span> : null}
            </label>
            <input
              id="driver-customer-search"
              type="search"
              value={query}
              disabled={disabled}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t(
                'taxi_fleet.driverApp.trips.customerSearchHint',
                'Search by name, phone, or NIP…',
              )}
              className={driverFieldClass}
              autoComplete="off"
            />
          </div>
          {query.trim().length > 0 ? (
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-[#F1F1F4] bg-white p-1">
              {query.trim().length < minSearchLength ? (
                <div className="px-3 py-2 text-sm text-[#78829D]">
                  {t(
                    'taxi_fleet.driverApp.trips.customerMinChars',
                    'Type at least {count} characters…',
                    { count: String(minSearchLength) },
                  )}
                </div>
              ) : null}
              {query.trim().length >= minSearchLength && searching ? (
                <div className="px-3 py-2 text-sm text-[#78829D]">
                  {t('taxi_fleet.driverApp.loading', 'Loading…')}
                </div>
              ) : null}
              {query.trim().length >= minSearchLength && !searching && options.length === 0 ? (
                <div className="px-3 py-2 text-sm text-[#78829D]">
                  {t('taxi_fleet.driverApp.trips.customerEmpty', 'No customers found.')}
                </div>
              ) : null}
              {options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={disabled}
                  className="flex w-full items-start gap-2 rounded-md px-3 py-2 text-left hover:bg-[#F9F9F9] active:bg-[#F1F1F4]"
                  onClick={() => {
                    setCreateOpen(false)
                    setCreateError(null)
                    setQuery('')
                    setOptions([])
                    onChange({ id: option.id, label: option.label })
                  }}
                >
                  <span className="mt-0.5 text-[#78829D]">
                    {option.kind === 'company' ? (
                      <Building2 className="size-4" aria-hidden />
                    ) : (
                      <UserRound className="size-4" aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-[#071437]">
                      {option.label}
                    </span>
                    {option.description ? (
                      <span className="block truncate text-xs text-[#78829D]">{option.description}</span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </>
      )}

      {!value && !createOpen ? (
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            className={`${driverSecondaryActionClass} gap-1.5`}
            disabled={disabled}
            onClick={() => {
              setCreateKind('person')
              setCreateNip('')
              setCreateOpen(true)
            }}
          >
            <Plus className="size-3.5" aria-hidden />
            {t('taxi_fleet.driverApp.customers.createPerson', 'New person')}
          </Button>
          <Button
            type="button"
            className={`${driverSecondaryActionClass} gap-1.5`}
            disabled={disabled}
            onClick={() => {
              setCreateKind('company')
              setCreateOpen(true)
            }}
          >
            <Plus className="size-3.5" aria-hidden />
            {t('taxi_fleet.driverApp.customers.createCompany', 'New company')}
          </Button>
        </div>
      ) : null}

      {!value && createOpen ? (
        <div className={`${driverCardClass} space-y-3 p-4!`}>
          <div className={driverSectionTitleClass}>
            {createKind === 'company'
              ? t('taxi_fleet.driverApp.customers.createCompany', 'New company')
              : t('taxi_fleet.driverApp.customers.createPerson', 'New person')}
          </div>
          <div>
            <label htmlFor="driver-customer-phone" className={driverLabelClass}>
              {t('taxi_fleet.driverApp.customers.phone', 'Phone')}
              <span className="text-red-600"> *</span>
            </label>
            <input
              id="driver-customer-phone"
              value={createPhone}
              onChange={(event) => setCreatePhone(event.target.value)}
              className={driverFieldClass}
              inputMode="tel"
              required
              autoComplete="tel"
            />
          </div>
          {createKind === 'company' ? (
            <div>
              <label htmlFor="driver-customer-nip" className={driverLabelClass}>
                {t('taxi_fleet.driverApp.customers.nip', 'NIP')}
                <span className="text-red-600"> *</span>
              </label>
              <input
                id="driver-customer-nip"
                value={createNip}
                onChange={(event) => setCreateNip(event.target.value)}
                className={driverFieldClass}
                inputMode="numeric"
                required
                autoComplete="off"
              />
            </div>
          ) : null}
          <div>
            <label htmlFor="driver-customer-name" className={driverLabelClass}>
              {t('taxi_fleet.driverApp.customers.name', 'Name')}
            </label>
            <input
              id="driver-customer-name"
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              className={driverFieldClass}
              autoComplete="name"
            />
          </div>
          {createError ? <div className="text-sm text-red-600">{createError}</div> : null}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              className={driverSecondaryActionClass}
              disabled={createBusy}
              onClick={() => {
                setCreateOpen(false)
                setCreateError(null)
              }}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              type="button"
              className={driverPrimaryActionClass}
              disabled={createBusy || !createReady}
              onClick={() => void createCustomer()}
            >
              {createBusy
                ? t('taxi_fleet.driverApp.trips.saving', 'Saving…')
                : t('taxi_fleet.driverApp.customers.save', 'Save customer')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
