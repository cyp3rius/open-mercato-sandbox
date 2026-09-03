'use client'

import React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

type Props = {
  teamMemberId: string
}

export function DriverLastKnownLocationChip({ teamMemberId }: Props) {
  const t = useT()
  const [label, setLabel] = React.useState<string | null>(null)

  React.useEffect(() => {
    let active = true
    void apiCall<{
      latest: { recordedAt: string; lat: number; lon: number; accuracyM?: number | null } | null
    }>(`/api/taxi_fleet/location/latest?teamMemberId=${encodeURIComponent(teamMemberId)}`)
      .then(({ result }) => {
        if (!active || !result) return
        const latest = result.latest
        if (!latest) {
          setLabel(null)
          return
        }
        const when = new Date(latest.recordedAt).toLocaleString()
        setLabel(
          `${latest.lat.toFixed(5)}, ${latest.lon.toFixed(5)} · ${when}`,
        )
      })
      .catch(() => {
        if (active) setLabel(null)
      })
    return () => {
      active = false
    }
  }, [teamMemberId])

  if (!label) return null

  return (
    <div className="mt-3 rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
      <div className="font-medium text-foreground">
        {t('taxi_fleet.drivers.detail.lastKnownLocation', 'Last known location')}
      </div>
      <div className="mt-1 break-all">{label}</div>
    </div>
  )
}
