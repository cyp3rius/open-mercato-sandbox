'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import {
  caseCreateFormSchema,
  defaultCaseCreateValues,
  buildCaseCreateFormFields,
  buildCaseCreateFormGroups,
  type CaseCreateFormValues,
} from '../../../components/caseFormConfig'

export default function CaseCreatePage() {
  const t = useT()
  const router = useRouter()
  const { organizationId, tenantId } = useOrganizationScopeDetail()

  const schema = React.useMemo(() => caseCreateFormSchema(), [])
  const fields = React.useMemo(() => buildCaseCreateFormFields(t), [t])
  const groups = React.useMemo(() => buildCaseCreateFormGroups(t), [t])

  return (
    <Page>
      <PageBody>
        <CrudForm<CaseCreateFormValues>
          title={t('cases.create.title', 'New case')}
          backHref="/backend/cases"
          cancelHref="/backend/cases"
          submitLabel={t('cases.create.submit', 'Create case')}
          schema={schema}
          fields={fields}
          groups={groups}
          initialValues={defaultCaseCreateValues()}
          onSubmit={async (values) => {
            if (!tenantId || !organizationId) {
              flash(t('cases.create.validationScope', 'Organization context is missing.'), 'error')
              return
            }
            const toNullIfEmpty = (s: string) => {
              const v = s.trim()
              return v.length ? v : null
            }
            const call = await createCrud<{ id?: string }>(
              'cases',
              {
                title: values.title.trim(),
                customerEntityId: values.customerEntityId.trim(),
                playbookId: toNullIfEmpty(values.playbookId ?? ''),
                resourceId: toNullIfEmpty(values.resourceId ?? ''),
                procurementProcessId: toNullIfEmpty(values.procurementProcessId ?? ''),
                insurancePolicyId: toNullIfEmpty(values.insurancePolicyId ?? ''),
                tenantId,
                organizationId,
              },
              { errorMessage: t('cases.create.error', 'Could not create case.') },
            )
            const newId = typeof call.result?.id === 'string' ? call.result.id : ''
            if (!newId) return
            flash(t('cases.create.success', 'Case created.'), 'success')
            router.replace(`/backend/cases/${encodeURIComponent(newId)}`)
          }}
        />
      </PageBody>
    </Page>
  )
}
