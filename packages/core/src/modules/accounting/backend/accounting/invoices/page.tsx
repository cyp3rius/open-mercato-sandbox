'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LoadingMessage } from '@open-mercato/ui/backend/detail'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { useT } from '@open-mercato/shared/lib/i18n/context'

/**
 * Legacy list URL: redirects to the accounting hub (`/backend/accounting`) with the same query string.
 */
export default function AccountingInvoicesListRedirectPage() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()

  React.useEffect(() => {
    const q = searchParams.toString()
    router.replace(q.length > 0 ? `/backend/accounting?${q}` : '/backend/accounting')
  }, [router, searchParams])

  return (
    <Page>
      <PageBody>
        <LoadingMessage message={t('accounting.list.redirecting', 'Redirecting…')} />
      </PageBody>
    </Page>
  )
}
