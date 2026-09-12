"use client"

import * as React from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'

type StaffTeamMemberPreviewProps = {
  teamMemberId: string
  displayName: string
}

export function StaffTeamMemberPreview({ teamMemberId, displayName }: StaffTeamMemberPreviewProps) {
  const t = useT()
  const href = `/backend/staff/team-members/${teamMemberId}`

  return (
    <div className="relative rounded-md border border-border/60 bg-background/80 px-3 py-3 text-sm">
      <Button
        type="button"
        variant="outline"
        size="sm"
        asChild
        className="absolute end-3 top-3 z-10 shrink-0"
      >
        <Link href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2">
          <ExternalLink className="size-4 shrink-0" aria-hidden />
          {t('common.open', 'Open')}
        </Link>
      </Button>
      <div className="pe-28">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t('taxi_fleet.drivers.member', 'Team member')}
        </div>
        <div className="mt-2 min-h-10 font-medium">{displayName}</div>
      </div>
    </div>
  )
}
