"use client"

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'

type FleetHubLinkSectionProps = {
  titleKey: string
  titleFallback: string
  descriptionKey: string
  descriptionFallback: string
  href: string
  actionKey: string
  actionFallback: string
}

export function FleetHubLinkSection({
  titleKey,
  titleFallback,
  descriptionKey,
  descriptionFallback,
  href,
  actionKey,
  actionFallback,
}: FleetHubLinkSectionProps) {
  const t = useT()

  return (
    <section className="rounded-lg border bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{t(titleKey, titleFallback)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t(descriptionKey, descriptionFallback)}</p>
        </div>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href={href}>
            {t(actionKey, actionFallback)}
            <ArrowRight className="ml-1 size-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </section>
  )
}
