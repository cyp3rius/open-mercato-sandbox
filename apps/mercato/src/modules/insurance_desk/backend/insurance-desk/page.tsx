"use client"

import * as React from 'react'
import Link from 'next/link'
import { Page, PageHeader, PageBody } from '@open-mercato/ui/backend/Page'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { INSURANCE_DESK_BASE, INSURANCE_CONFIG_INSURANCES_PATH } from './paths'

export default function InsuranceDeskHubPage() {
  const t = useT()
  const [canManagePolicies, setCanManagePolicies] = React.useState(false)
  const [canManageLeads, setCanManageLeads] = React.useState(false)
  const [canManageInsurers, setCanManageInsurers] = React.useState(false)
  const [canManageConfig, setCanManageConfig] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    void apiCall<{ granted?: string[]; ok?: boolean }>('/api/auth/feature-check', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        features: [
          'insurance.policies.manage',
          'insurance.leads.manage',
          'insurance.insurers.manage',
          'insurance.config.manage',
        ],
      }),
    }).then((call) => {
      if (cancelled) return
      const granted = new Set(Array.isArray(call.result?.granted) ? call.result.granted : [])
      const ok = call.result?.ok === true
      setCanManagePolicies(ok || granted.has('insurance.policies.manage'))
      setCanManageLeads(ok || granted.has('insurance.leads.manage'))
      setCanManageInsurers(ok || granted.has('insurance.insurers.manage'))
      setCanManageConfig(ok || granted.has('insurance.config.manage'))
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Page>
      <PageHeader
        title={t('insurance_desk.hub.dashboardTitle', 'Dashboard')}
        description={t(
          'insurance_desk.hub.description',
          'Manage insurers, policies, and links to catalog products and resources.',
        )}
      />
      <PageBody>
        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <Link
              href={`${INSURANCE_DESK_BASE}/policies`}
              className="font-medium hover:underline"
            >
              {t('insurance_desk.policies.title', 'Policies')}
            </Link>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('insurance_desk.hub.nav.policiesHelp', '')}
            </p>
            {canManagePolicies ? (
              <Link
                href={`${INSURANCE_DESK_BASE}/policies/create`}
                className="mt-3 block border-l-2 border-muted-foreground/30 pl-3 text-sm text-muted-foreground hover:text-foreground"
              >
                {t('insurance_desk.nav.createPolicy', 'Create policy')}
              </Link>
            ) : null}
          </div>

          <div className="rounded-lg border p-4">
            <Link href={`${INSURANCE_DESK_BASE}/leads`} className="font-medium hover:underline">
              {t('insurance_desk.leads.title', 'Inquiries')}
            </Link>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('insurance_desk.leads.help', '')}
            </p>
            {canManageLeads ? (
              <Link
                href={`${INSURANCE_DESK_BASE}/leads/create`}
                className="mt-3 block border-l-2 border-muted-foreground/30 pl-3 text-sm text-muted-foreground hover:text-foreground"
              >
                {t('insurance_desk.nav.createLead', 'Create inquiry')}
              </Link>
            ) : null}
          </div>

          <div className="rounded-lg border p-4">
            <Link
              href={`${INSURANCE_DESK_BASE}/insurers`}
              className="font-medium hover:underline"
            >
              {t('insurance_desk.insurers.title', 'Insurers')}
            </Link>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('insurance_desk.hub.nav.insurersHelp', '')}
            </p>
            {canManageInsurers ? (
              <Link
                href={`${INSURANCE_DESK_BASE}/insurers/create`}
                className="mt-3 block border-l-2 border-muted-foreground/30 pl-3 text-sm text-muted-foreground hover:text-foreground"
              >
                {t('insurance_desk.nav.createInsurer', 'Create insurer')}
              </Link>
            ) : null}
          </div>

          {canManageConfig ? (
            <Link
              href={INSURANCE_CONFIG_INSURANCES_PATH}
              className="block rounded-lg border p-4 transition-colors hover:bg-muted/40"
            >
              <div className="font-medium">{t('insurance_desk.nav.configuration', 'Configuration')}</div>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('insurance_desk.config.insurances.navHelp', '')}
              </p>
            </Link>
          ) : null}
        </div>
        <div className="mt-8 rounded-lg border border-dashed p-4">
          <div className="text-sm font-medium">{t('insurance_desk.hub.events.title', 'Workflow events')}</div>
          <p className="mt-2 text-sm text-muted-foreground">
            {t(
              'insurance_desk.hub.events.body',
              'Use Workflow event triggers with patterns like insurance.policy.created.',
            )}
          </p>
        </div>
      </PageBody>
    </Page>
  )
}
