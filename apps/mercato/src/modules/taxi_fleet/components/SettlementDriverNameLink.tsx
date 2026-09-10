'use client'

import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { TAXI_FLEET_BASE } from '../backend/taxi-fleet/paths'

type SettlementDriverNameLinkProps = {
  driverProfileId: string | null
  displayName: string
  className?: string
}

export function SettlementDriverNameLink({
  driverProfileId,
  displayName,
  className,
}: SettlementDriverNameLinkProps) {
  const t = useT()
  const nameClass = `inline-flex min-w-0 max-w-full items-center gap-1.5 font-medium ${className ?? ''}`

  if (!driverProfileId) {
    return (
      <span className={`${nameClass} text-foreground`}>
        <span className="min-w-0 truncate">{displayName}</span>
      </span>
    )
  }

  return (
    <Link
      href={`${TAXI_FLEET_BASE}/drivers/${encodeURIComponent(driverProfileId)}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`${nameClass} text-primary hover:underline`}
      aria-label={t('taxi_fleet.settlements.detail.openDriverProfile', 'Open driver profile')}
    >
      <span className="min-w-0 truncate">{displayName}</span>
      <ExternalLink className="size-3.5 shrink-0" aria-hidden />
    </Link>
  )
}
