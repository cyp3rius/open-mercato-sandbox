"use client"

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { AttachmentsSection } from '@open-mercato/ui/backend/detail'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { createCrudFormError } from '@open-mercato/ui/backend/utils/serverErrors'
import { searchPartnerEntityOptions } from '../../../../lib/loadPolicyFormOptions'
import { emptyPolicyCoveragesValue } from '../../../../components/policies/PolicyCoveragesField'
import { PolicyCoverageOptionsField, emptyCoverageOptionsValue } from '../../../../components/policies/PolicyCoverageOptionsField'
import { LeadCoverageCatalogField } from '../../../../components/leads/LeadCoverageCatalogField'
import { LeadContactHolderField } from '../../../../components/leads/LeadContactHolderField'
import { LeadUsageField } from '../../../../components/leads/LeadUsageField'
import { emptyVehicleFields } from '../../../../components/policies/PolicySubjectField'
import { LeadInquiryVehicleField } from '../../../../components/leads/LeadInquiryVehicleField'
import { INSURANCE_DESK_BASE } from '../../paths'
import { INSURANCE_LEAD_ATTACHMENT_ENTITY_ID } from '../../../../lib/insuranceDeskConstants'
import { transferDraftAttachmentsToRecord } from '../../../../lib/transferDraftAttachments'
import { buildLeadFormValuesFromPayload } from '../../../../lib/leadFormPrefill'
import { buildLeadPayloadFromFormValues, deriveLeadTitleFromForm } from '../../../../lib/leadApiPayload'
import { emptyLeadContactForm } from '../../../../lib/leadContactForm'
import { emptyLeadUsageForm } from '../../../../lib/leadUsageForm'
import { useT } from '@open-mercato/shared/lib/i18n/context'

function trimStr(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

type LeadDupResponse = {
  items?: Array<{
    id: string
    referringPartnerEntityId: string | null
    payload: Record<string, unknown> | null
  }>
}

export default function InsuranceLeadCreatePage() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const duplicateFromId = searchParams.get('duplicateFrom')

  const loadPartnerOptions = React.useCallback(
    async (query?: string) =>
      searchPartnerEntityOptions(query, {
        personPrefix: t('insurance_desk.policies.form.partnerKind.person', 'Person'),
        companyPrefix: t('insurance_desk.policies.form.partnerKind.company', 'Company'),
      }),
    [t],
  )

  const emptyInitial = React.useMemo(
    () => ({
      referringPartnerEntityId: '',
      leadContact: emptyLeadContactForm(),
      leadUsage: emptyLeadUsageForm(),
      coverages: emptyPolicyCoveragesValue(),
      coverageSubSelections: {} as Record<string, string>,
      coverageDetailValues: {} as Record<string, Record<string, unknown>>,
      coverageOptions: emptyCoverageOptionsValue(),
      leadVehicle: emptyVehicleFields(),
      notes: '',
    }),
    [],
  )

  const [initialValues, setInitialValues] = React.useState(() => emptyInitial)
  const [formKey, setFormKey] = React.useState(0)
  const attachmentDraftRecordId = React.useMemo(() => crypto.randomUUID(), [])

  React.useEffect(() => {
    const fromId = duplicateFromId?.trim()
    if (!fromId) {
      setInitialValues(emptyInitial)
      setFormKey((k) => k + 1)
      return
    }
    let cancelled = false
    async function loadDup() {
      const id = fromId
      if (!id) return
      const call = await apiCall<LeadDupResponse>(
        `/api/insurance/leads?id=${encodeURIComponent(id)}&page=1&pageSize=1`,
      )
      const row = call.result?.items?.[0]
      if (cancelled || !row) return
      const mapped = buildLeadFormValuesFromPayload(row.referringPartnerEntityId, row.payload)
      setInitialValues({ ...emptyInitial, ...mapped })
      setFormKey((k) => k + 1)
    }
    void loadDup()
    return () => {
      cancelled = true
    }
  }, [duplicateFromId, emptyInitial])

  const fields = React.useMemo<CrudField[]>(
    () => [
      {
        id: 'referringPartnerEntityId',
        label: t('insurance_desk.policies.form.referringPartyEntity', 'Referring party'),
        type: 'select',
        loadOptions: loadPartnerOptions,
        layout: 'full',
        useEntitySearchCombobox: true,
        remoteSelectSearch: true,
        createInNewTabHref: '/backend/customers/companies/create',
        description: t(
          'insurance_desk.leads.form.referringPartyHint',
          'Only CRM records of type partner or referrer.',
        ),
      },
      {
        id: 'leadContact',
        label: '',
        type: 'custom',
        layout: 'full',
        component: LeadContactHolderField,
      },
      {
        id: 'leadUsage',
        label: '',
        type: 'custom',
        layout: 'full',
        component: LeadUsageField,
      },
      {
        id: 'coverages',
        label: '',
        type: 'custom',
        layout: 'full',
        component: LeadCoverageCatalogField,
      },
      {
        id: 'coverageOptions',
        label: '',
        type: 'custom',
        layout: 'full',
        component: PolicyCoverageOptionsField,
      },
      {
        id: 'leadVehicle',
        label: '',
        type: 'custom',
        layout: 'full',
        component: LeadInquiryVehicleField,
      },
      {
        id: 'notes',
        label: t('insurance_desk.leads.form.notes', 'Notes'),
        type: 'textarea',
        layout: 'full',
      },
    ],
    [loadPartnerOptions, t],
  )

  const groups = React.useMemo<CrudFormGroup[]>(
    () => [
      {
        id: 'basics',
        title: t('insurance_desk.leads.form.groups.basics', 'Basics'),
        column: 1,
        fields: ['referringPartnerEntityId'],
      },
      {
        id: 'contact',
        title: t('insurance_desk.leads.form.groups.contact', 'Contact details'),
        column: 1,
        fields: ['leadContact'],
      },
      {
        id: 'usage',
        title: t('insurance_desk.leads.form.groups.usage', 'Vehicle use'),
        column: 1,
        fields: ['leadUsage'],
      },
      {
        id: 'coverages',
        column: 1,
        fields: ['coverages'],
      },
      {
        id: 'coverageOptions',
        title: t('insurance_desk.leads.form.groups.protectionDetails', 'Protection details'),
        description: t(
          'insurance_desk.leads.coverageDetails.intro',
          'Protection preferences — sections follow the coverage types selected above.',
        ),
        column: 1,
        fields: ['coverageOptions'],
      },
      {
        id: 'subject',
        title: t('insurance_desk.policies.form.subject.title', 'Subject of insurance'),
        description: t(
          'insurance_desk.leads.form.vehicleIntro',
          'Vehicle data describes the inquiry subject. It is not a registered resource in the system (external lead).',
        ),
        column: 2,
        fields: ['leadVehicle'],
      },
      {
        id: 'notes',
        title: t('insurance_desk.leads.form.groups.notes', 'Notes'),
        column: 2,
        fields: ['notes'],
      },
      {
        id: 'attachments',
        title: t('attachments.library.title', 'Attachments'),
        description: t(
          'insurance_desk.leads.attachments.createHint',
          'Files are uploaded to a draft and linked automatically when you save the inquiry.',
        ),
        column: 2,
        component: () => (
          <AttachmentsSection
            entityId={INSURANCE_LEAD_ATTACHMENT_ENTITY_ID}
            recordId={attachmentDraftRecordId}
            showHeader={false}
          />
        ),
      },
    ],
    [attachmentDraftRecordId, t],
  )

  const onSubmit = React.useCallback(
    async (values: Record<string, unknown>) => {
      const referringPartnerEntityId = trimStr(values.referringPartnerEntityId)

      let payload: ReturnType<typeof buildLeadPayloadFromFormValues>
      try {
        payload = buildLeadPayloadFromFormValues(values)
      } catch (e: unknown) {
        if (e instanceof Error && e.message === 'LEAD_VEHICLE_REQUIRED') {
          throw createCrudFormError(
            t(
              'insurance_desk.leads.form.errors.vehicleRequired',
              'Enter at least brand and model, registration plate, or VIN.',
            ),
            {
              leadVehicle: t(
                'insurance_desk.leads.form.errors.vehicleRequired',
                'Enter at least brand and model, registration plate, or VIN.',
              ),
            },
          )
        }
        throw e
      }

      const title = deriveLeadTitleFromForm(values, '')
      if (!title.length) {
        throw createCrudFormError(
          t('insurance_desk.leads.form.errors.title', 'Vehicle identifiers are required.'),
          { leadVehicle: t('insurance_desk.leads.form.errors.title', 'Vehicle identifiers are required.') },
        )
      }

      const created = await createCrud<{ id?: string }>(
        'insurance/leads',
        {
          title,
          status: 'received',
          source: 'insurance_desk',
          referringPartnerEntityId: referringPartnerEntityId.length ? referringPartnerEntityId : null,
          payload,
        },
        { errorMessage: t('insurance_desk.leads.form.errors.create', 'Could not save inquiry.') },
      )
      const newId = typeof created.result?.id === 'string' ? created.result.id : null
      if (newId) {
        try {
          await transferDraftAttachmentsToRecord(INSURANCE_LEAD_ATTACHMENT_ENTITY_ID, attachmentDraftRecordId, newId)
        } catch {
          flash(
            t(
              'insurance_desk.leads.attachments.transferWarning',
              'Inquiry was saved but some draft files could not be linked. You can upload them again on the inquiry page.',
            ),
            'warning',
          )
        }
        router.push(`${INSURANCE_DESK_BASE}/leads/${encodeURIComponent(newId)}`)
      } else {
        router.push(`${INSURANCE_DESK_BASE}/leads`)
      }
    },
    [attachmentDraftRecordId, router, t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm
          key={formKey}
          title={t('insurance_desk.leads.create.detailTitle', 'New inquiry')}
          backHref={`${INSURANCE_DESK_BASE}/leads`}
          cancelHref={`${INSURANCE_DESK_BASE}/leads`}
          entityId="insurance_desk:lead-create"
          fields={fields}
          groups={groups}
          initialValues={initialValues}
          submitLabel={t('insurance_desk.leads.form.submit', 'Save inquiry')}
          onSubmit={onSubmit}
        />
      </PageBody>
    </Page>
  )
}
