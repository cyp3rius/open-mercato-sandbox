'use client'

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { EntitySearchCombobox } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import {
  mergeEntitySearchOption,
  remoteSearchFleetCustomers,
  resolveFleetCustomerDisplayLabel,
  resolveFleetCustomerKind,
} from '../lib/fleetCustomerEntitySearch'
import { TripCustomerField } from './TripCustomerField'

const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUsablePersonLabel(value: string | null | undefined): value is string {
  if (!value) return false
  const trimmed = value.trim()
  return trimmed.length > 0 && !UUID_LIKE.test(trimmed)
}

type TripCustomerBillingFieldsProps = {
  customerEntityId: string
  orderingPersonId: string
  onCustomerChange: (next: string) => void
  onOrderingPersonChange: (next: string) => void
  disabled?: boolean
  fallbackLabel?: string
}

export function TripCustomerBillingFields({
  customerEntityId,
  orderingPersonId,
  onCustomerChange,
  onOrderingPersonChange,
  disabled = false,
  fallbackLabel,
}: TripCustomerBillingFieldsProps) {
  const t = useT()
  const [customerKind, setCustomerKind] = React.useState<'person' | 'company' | null>(null)
  const [orderingLabel, setOrderingLabel] = React.useState('')
  const [orderingLabelResolved, setOrderingLabelResolved] = React.useState(false)

  const kindLabels = React.useMemo(
    () => ({
      person: t('taxi_fleet.trips.customerKind.person', 'Person'),
      company: t('taxi_fleet.trips.customerKind.company', 'Company'),
    }),
    [t],
  )

  const onOrderingPersonChangeRef = React.useRef(onOrderingPersonChange)
  onOrderingPersonChangeRef.current = onOrderingPersonChange

  React.useEffect(() => {
    let cancelled = false
    const id = customerEntityId.trim()
    if (!id) {
      setCustomerKind(null)
      return
    }
    void resolveFleetCustomerKind(id).then((kind) => {
      if (cancelled) return
      setCustomerKind(kind)
      if (kind !== 'company') {
        onOrderingPersonChangeRef.current('')
      }
    })
    return () => {
      cancelled = true
    }
  }, [customerEntityId])

  React.useEffect(() => {
    let cancelled = false
    const id = orderingPersonId.trim()
    if (!id) {
      setOrderingLabel('')
      setOrderingLabelResolved(true)
      return
    }
    setOrderingLabel('')
    setOrderingLabelResolved(false)
    void resolveFleetCustomerDisplayLabel(id).then((label) => {
      if (cancelled) return
      setOrderingLabel(isUsablePersonLabel(label) ? label.trim() : '')
      setOrderingLabelResolved(true)
    })
    return () => {
      cancelled = true
    }
  }, [orderingPersonId])

  const showOrdering =
    customerKind === 'company' || (customerKind === null && Boolean(orderingPersonId.trim()))

  const usableOrderingLabel = isUsablePersonLabel(orderingLabel) ? orderingLabel : ''
  const orderingOptionLabel = (() => {
    if (usableOrderingLabel) return usableOrderingLabel
    if (!orderingPersonId.trim()) return ''
    if (!orderingLabelResolved) {
      return t('taxi_fleet.trips.orderingPersonResolving', 'Loading person…')
    }
    return t('taxi_fleet.trips.orderingPersonUnknown', 'Unknown person')
  })()

  return (
    <div className={showOrdering ? 'grid gap-3 sm:grid-cols-2' : undefined}>
      <div className="min-w-0 space-y-1.5">
        <div className="text-sm font-medium">
          {t('taxi_fleet.trips.customer', 'Customer')}
        </div>
        <TripCustomerField
          value={customerEntityId}
          onChange={(next) => {
            onCustomerChange(next)
            if (!next.trim()) {
              setCustomerKind(null)
              onOrderingPersonChange('')
            }
          }}
          disabled={disabled}
          fallbackLabel={fallbackLabel}
        />
      </div>
      {showOrdering ? (
        <div className="min-w-0 space-y-1.5">
          <div className="text-sm font-medium">
            {t('taxi_fleet.trips.orderingPerson', 'Ordering party')}
          </div>
          {disabled ? (
            <p className="text-sm text-foreground">
              {usableOrderingLabel || t('taxi_fleet.trips.orderingPersonEmpty', '—')}
            </p>
          ) : (
            <EntitySearchCombobox
              value={orderingPersonId}
              onChange={onOrderingPersonChange}
              disabled={disabled}
              className="min-w-0 w-full"
              options={
                orderingPersonId.trim()
                  ? mergeEntitySearchOption([], orderingPersonId, orderingOptionLabel)
                  : []
              }
              selectedDisplayOverride={orderingOptionLabel || undefined}
              onRemoteSearch={async (query) => {
                const rows = await remoteSearchFleetCustomers(query, kindLabels, {
                  kind: 'person',
                  companyEntityId: customerEntityId,
                  linkedToCompanyLabel: t(
                    'taxi_fleet.trips.orderingPersonLinked',
                    'Linked to this company',
                  ),
                })
                return mergeEntitySearchOption(rows, orderingPersonId, orderingOptionLabel)
              }}
              placeholder={t('taxi_fleet.trips.orderingPersonSearch', 'Search person…')}
              searchPlaceholder={t('taxi_fleet.trips.orderingPersonSearch', 'Search person…')}
              emptyText={t('taxi_fleet.trips.orderingPersonEmptySearch', 'No people found.')}
            />
          )}
          <p className="text-[11px] text-muted-foreground">
            {t(
              'taxi_fleet.trips.orderingPersonHelp',
              'Optional. Person who ordered the trip when the customer is a company.',
            )}
          </p>
        </div>
      ) : null}
    </div>
  )
}
