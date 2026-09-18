'use client'

import * as React from 'react'
import { Van } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'

const VAN_ORDERED_WARNING_KEYS = new Set([
  'vehicle.fourPassengersVanUpgrade',
  'vehicle.passengersVanUpgrade',
  'vehicle.luggageOverflowUpgrade',
])

type TranslateFn = (key: string, fallback?: string) => string

export function isVanOrderedQuoteWarning(code: string): boolean {
  return VAN_ORDERED_WARNING_KEYS.has(code.trim())
}

export function quoteVehicleWarningLabel(t: TranslateFn, code: string): string {
  const key = code.trim()
  if (isVanOrderedQuoteWarning(key)) {
    return t(
      'taxi_fleet.trips.form.quote.warnings.vanOrdered',
      'Trip configuration requires a Van vehicle.',
    )
  }
  return t(`taxi_fleet.trips.form.quote.warnings.${key}`, key)
}

export function TripQuoteWarningList({ warnings }: { warnings: string[] }) {
  const t = useT()
  if (!warnings.length) return null
  return (
    <ul className="space-y-1.5 border-t pt-3 text-xs text-amber-700 dark:text-amber-400">
      {warnings.map((warning) => {
        const label = quoteVehicleWarningLabel(t, warning)
        const van = isVanOrderedQuoteWarning(warning)
        return (
          <li key={warning} className="flex items-start gap-2">
            {van ? <Van className="mt-0.5 size-3.5 shrink-0" aria-hidden /> : null}
            <span>{label}</span>
          </li>
        )
      })}
    </ul>
  )
}
