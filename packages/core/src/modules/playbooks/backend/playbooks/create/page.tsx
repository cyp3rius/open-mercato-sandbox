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
  playbookFormSchema,
  defaultPlaybookFormValues,
  buildPlaybookFormFields,
  buildPlaybookFormGroups,
  type PlaybookFormValues,
} from '../../../components/playbookFormConfig'
import { PlaybookFormTabProvider } from '../../../components/PlaybookFormTabContext'

export default function PlaybookCreatePage() {
  const t = useT()
  const router = useRouter()
  const { organizationId, tenantId } = useOrganizationScopeDetail()

  const schema = React.useMemo(() => playbookFormSchema(), [])
  const fields = React.useMemo(() => buildPlaybookFormFields(t), [t])
  const groups = React.useMemo(() => buildPlaybookFormGroups(t), [t])

  return (
    <Page>
      <PageBody>
        <PlaybookFormTabProvider>
          <CrudForm<PlaybookFormValues>
            title={t('playbooks.create.title', 'New playbook')}
            entityTypeLabel={t('playbooks.detail.title', 'Playbook')}
            backHref="/backend/playbooks"
            cancelHref="/backend/playbooks"
            submitLabel={t('playbooks.create.submit', 'Create playbook')}
            schema={schema}
            fields={fields}
            groups={groups}
            initialValues={defaultPlaybookFormValues()}
            onSubmit={async (values) => {
              if (!tenantId || !organizationId) {
                flash(t('playbooks.create.validation', 'Slug, title and organization context are required.'), 'error')
                return
              }
              const slug = values.slug.trim().toLowerCase()
              const title = values.title.trim()
              const tags = Array.isArray(values.contextTags)
                ? values.contextTags.map((x) => String(x).trim()).filter(Boolean)
                : []
              const call = await createCrud<{ id?: string }>(
                'playbooks',
                {
                  slug,
                  title,
                  body: values.body.trim(),
                  contextTags: tags,
                  recommendedOwnerUserIds: values.recommendedOwnerUserIds,
                  defaultSlaDuration: values.defaultSlaDuration,
                  procedureDefinition: Array.isArray(values.procedureDefinition) ? values.procedureDefinition : [],
                  audience: values.audience,
                  version: values.version,
                  isActive: values.isActive,
                  tenantId,
                  organizationId,
                },
                { errorMessage: t('playbooks.create.error', 'Could not create playbook.') },
              )
              const newId = typeof call.result?.id === 'string' ? call.result.id : ''
              if (!newId) return
              flash(t('playbooks.create.success', 'Playbook created.'), 'success')
              router.replace(`/backend/playbooks/${encodeURIComponent(newId)}`)
            }}
          />
        </PlaybookFormTabProvider>
      </PageBody>
    </Page>
  )
}
