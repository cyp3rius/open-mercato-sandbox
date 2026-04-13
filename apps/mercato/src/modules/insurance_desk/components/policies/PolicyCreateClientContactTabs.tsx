"use client"

import * as React from 'react'
import { toast } from 'sonner'
import type { CrudCustomFieldRenderProps } from '@open-mercato/ui/backend/CrudForm'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@open-mercato/ui/primitives/tabs'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { PolicyCustomerInlineSection } from './PolicyCustomerInlineSection'
import { LeadContactHolderField } from '../leads/LeadContactHolderField'

export function PolicyCreateClientContactTabs(props: CrudCustomFieldRenderProps) {
  const t = useT()
  const { values, setFormValue, disabled, formErrors } = props

  const companyTrim =
    values && typeof values.insuredCompanyEntityId === 'string' ? values.insuredCompanyEntityId.trim() : ''
  const personTrim =
    values && typeof values.insuredPersonEntityId === 'string' ? values.insuredPersonEntityId.trim() : ''
  const defineNewLocked = companyTrim.length > 0 || personTrim.length > 0

  const [activeTab, setActiveTab] = React.useState('customer')

  React.useEffect(() => {
    if (defineNewLocked && activeTab === 'contact') {
      setActiveTab('customer')
    }
  }, [activeTab, defineNewLocked])

  const blockedMessage = t(
    'insurance_desk.policies.form.clientTabs.defineNewBlocked',
    'To define a new insured party, clear the existing Company and/or Person selection.',
  )

  return (
    <Tabs
      value={activeTab}
      onValueChange={(next) => {
        if (next === 'contact' && defineNewLocked) {
          toast.info(blockedMessage)
          return
        }
        setActiveTab(next)
      }}
      className="w-full space-y-4"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-sm font-semibold text-foreground">
          {t('insurance_desk.policies.form.groups.insuredParty', 'Insured party')}
        </span>
        <TabsList className="h-9 w-auto max-w-full shrink-0 justify-start gap-0 rounded-lg bg-muted p-1 text-muted-foreground">
          <TabsTrigger value="customer" className="px-3">
            {t('insurance_desk.policies.form.clientTabs.search', 'Search')}
          </TabsTrigger>
          <TabsTrigger
            value="contact"
            className={cn('px-3', defineNewLocked && 'cursor-not-allowed opacity-50')}
            aria-disabled={defineNewLocked}
          >
            {t('insurance_desk.policies.form.clientTabs.defineNew', 'Define new')}
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="customer" className="space-y-4">
        <PolicyCustomerInlineSection
          mode="crud"
          values={values ?? {}}
          setFormValue={(id, value) => setFormValue?.(id, value)}
        />
      </TabsContent>
      <TabsContent value="contact" className="space-y-4">
        <LeadContactHolderField
          id="leadContact"
          value={values?.leadContact}
          setValue={(next) => setFormValue?.('leadContact', next)}
          disabled={disabled || defineNewLocked}
          error={formErrors?.leadContact}
          formErrors={formErrors}
          values={values}
        />
      </TabsContent>
    </Tabs>
  )
}
