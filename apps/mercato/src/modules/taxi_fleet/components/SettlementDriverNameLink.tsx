'use client'

import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type SettlementDriverNameLinkProps = {
  teamMemberId: string
  displayName: string
  className?: string
}

export function SettlementDriverNameLink({
  teamMemberId,
  displayName,
  className,
}: SettlementDriverNameLinkProps) {
  const t = useT()

  return (
    <Link
      href={`/backend/staff/team-members/${encodeURIComponent(teamMemberId)}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex min-w-0 max-w-full items-center gap-1.5 font-medium text-primary hover:underline ${className ?? ''}`}
      aria-label={t('taxi_fleet.settlements.detail.openDriverNewWindow', 'Open driver in new window')}
    >
      <span className="min-w-0 truncate">{displayName}</span>
      <ExternalLink className="size-3.5 shrink-0" aria-hidden />
    </Link>
  )
}
