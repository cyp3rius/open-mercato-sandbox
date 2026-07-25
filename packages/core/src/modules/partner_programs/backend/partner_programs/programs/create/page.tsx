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
  buildPartnerProgramCreateFormFields,
  buildPartnerProgramCreateFormGroups,
  defaultPartnerProgramCreateValues,
  partnerProgramCreateFormSchema,
  type PartnerProgramCreateFormValues,
} from '../../../../components/partnerProgramFormConfig'

export default function PartnerProgramCreatePage() {
  const t = useT()
  const router = useRouter()
  const { organizationId, tenantId } = useOrganizationScopeDetail()

  const schema = React.useMemo(() => partnerProgramCreateFormSchema(t), [t])
  const fields = React.useMemo(() => buildPartnerProgramCreateFormFields(t), [t])
  const groups = React.useMemo(() => buildPartnerProgramCreateFormGroups(t), [t])

  return (
    <Page>
      <PageBody className="mx-auto max-w-2xl">
        <CrudForm<PartnerProgramCreateFormValues>
          title={t('partner_programs.form.createTitle', 'Create partner program')}
          backHref="/backend/partner_programs/programs"
          cancelHref="/backend/partner_programs/programs"
          submitLabel={t('partner_programs.form.actions.create', 'Create')}
          schema={schema}
          fields={fields}
          groups={groups}
          initialValues={defaultPartnerProgramCreateValues()}
          onSubmit={async (values) => {
            if (!tenantId || !organizationId) {
              flash(t('partner_programs.form.errors.scope', 'Organization context is missing.'), 'error')
              return
            }
            const payload: Record<string, unknown> = {
              name: values.name.trim(),
              description: values.description.trim() || null,
              isActive: values.isActive,
              incentivePercent: Number(values.incentivePercent),
              incentiveBase: values.incentiveBase === 'gross' ? 'gross' : 'net',
              tenantId,
              organizationId,
            }
            const vf = typeof values.validFrom === 'string' ? values.validFrom.trim() : ''
            const vt = typeof values.validTo === 'string' ? values.validTo.trim() : ''
            if (vf.length) payload.validFrom = new Date(vf).toISOString()
            if (vt.length) payload.validTo = new Date(vt).toISOString()
            const call = await createCrud<{ id?: string }>(
              'partner_programs/programs',
              payload,
              { errorMessage: t('partner_programs.form.errors.save', 'Failed to save program.') },
            )
            const newId = typeof call.result?.id === 'string' ? call.result.id : ''
            if (!newId) return
            flash(t('partner_programs.form.flash.created', 'Program created.'), 'success')
            router.replace(`/backend/partner_programs/programs/${encodeURIComponent(newId)}`)
          }}
        />
      </PageBody>
    </Page>
  )
}
