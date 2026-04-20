"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { Button } from '@open-mercato/ui/primitives/button'
import { useT } from '@open-mercato/shared/lib/i18n/context'

export default function ProcurementHubPage() {
  const router = useRouter()
  const t = useT()

  React.useEffect(() => {
    router.replace('/backend/procurement/processes')
  }, [router])

  return (
    <Page>
      <PageBody className="max-w-lg space-y-4">
        <h1 className="text-xl font-semibold">{t('procurement.hub.title', 'Procurement')}</h1>
        <p className="text-muted-foreground text-sm">
          {t('procurement.hub.lead', 'Run purchasing processes, compare suppliers, and hand over to resources.')}
        </p>
        <Button asChild>
          <Link href="/backend/procurement/processes">{t('procurement.hub.openList', 'Open processes')}</Link>
        </Button>
      </PageBody>
    </Page>
  )
}
