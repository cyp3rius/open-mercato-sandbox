"use client"

import * as React from 'react'
import { Building2, Plus, UserRound } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { EntitySearchCombobox } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import { Button } from '@open-mercato/ui/primitives/button'
import { IconButton } from '@open-mercato/ui/primitives/icon-button'
import { Popover, PopoverContent, PopoverTrigger } from '@open-mercato/ui/primitives/popover'
import {
  mergeEntitySearchOption,
  remoteSearchFleetCustomers,
  resolveFleetCustomerDisplayLabel,
} from '../lib/fleetCustomerEntitySearch'

type TripCustomerFieldProps = {
  value: string
  onChange: (next: string) => void
  disabled?: boolean
}

export function TripCustomerField({ value, onChange, disabled = false }: TripCustomerFieldProps) {
  const t = useT()
  const [label, setLabel] = React.useState('')
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
    void resolveFleetCustomerDisplayLabel(trimmed).then((resolved) => {
      if (!cancelled) setLabel(resolved ?? trimmed)
    })
    return () => {
      cancelled = true
    }
  }, [value])

  const openCreate = React.useCallback((href: string) => {
    window.open(href, '_blank', 'noopener,noreferrer')
    setCreateMenuOpen(false)
  }, [])

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <EntitySearchCombobox
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="min-w-0 flex-1"
        options={mergeEntitySearchOption([], value, label || value)}
        selectedDisplayOverride={label || undefined}
        onRemoteSearch={async (query) => {
          const rows = await remoteSearchFleetCustomers(query, kindLabels)
          return mergeEntitySearchOption(rows, value, label || value)
        }}
        placeholder={t('taxi_fleet.trips.customerSearch', 'Search customer…')}
        searchPlaceholder={t('taxi_fleet.trips.customerSearch', 'Search customer…')}
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
