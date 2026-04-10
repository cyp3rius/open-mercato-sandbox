"use client"

import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { PolicyListColorRulesSection } from '../../../components/config/PolicyListColorRulesSection'
import { PolicyStatusDictionarySection } from '../../../components/config/PolicyStatusDictionarySection'
import { LeadStatusDictionarySection } from '../../../components/config/LeadStatusDictionarySection'
import { ProtectionScopeDictionarySection } from '../../../components/config/ProtectionScopeDictionarySection'

export default function InsuranceConfigInsurancesPage() {
  const t = useT()

  return (
    <Page>
      <PageBody>
        <div className="space-y-8">
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold">
              {t('insurance_desk.config.insurances.title', 'Insurance dictionaries')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t(
                'insurance_desk.config.insurances.pageDescription',
                'Manage dictionaries used by insurance inquiries and related forms.',
              )}
            </p>
          </header>

          <PolicyListColorRulesSection />
          <PolicyStatusDictionarySection />
          <LeadStatusDictionarySection />
          <ProtectionScopeDictionarySection />
        </div>
      </PageBody>
    </Page>
  )
}
