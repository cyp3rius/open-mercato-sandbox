"use client"

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { AttachmentsSection } from '@open-mercato/ui/backend/detail'
import { LoadingMessage } from '@open-mercato/ui/backend/detail'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { createCrudFormError } from '@open-mercato/ui/backend/utils/serverErrors'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import {
  loadActiveInsurerSelectOptions,
  loadCaretakerUserOptions,
  loadCatalogProductOptions,
  searchPartnerEntityOptions,
  loadPolicyStatusSelectOptions,
} from '../../../../lib/loadPolicyFormOptions'
import {
  buildPolicyCoveragesMetadata,
  normalizeCoveragesValue,
} from '../../../../components/policies/PolicyCoveragesField'
import {
  PolicyCoverageOptionsField,
  buildCoverageOptionsMetadata,
  emptyCoverageOptionsValue,
} from '../../../../components/policies/PolicyCoverageOptionsField'
import {
  PolicySubjectField,
  buildInsuranceSubjectMetadata,
  deriveNewResourceNameForApi,
  emptyInsuranceSubjectValue,
} from '../../../../components/policies/PolicySubjectField'
import { PolicyInsurerContactField } from '../../../../components/policies/PolicyInsurerContactField'
import { PolicyUsageSelectField } from '../../../../components/policies/PolicyUsageSelectField'
import { PolicySourceLeadField } from '../../../../components/policies/PolicySourceLeadField'
import { PolicyCreateLeadMergeProvider } from '../../../../components/policies/PolicyCreateLeadMergeContext'
import { LeadCoverageCatalogField } from '../../../../components/leads/LeadCoverageCatalogField'
import { LeadContactHolderField } from '../../../../components/leads/LeadContactHolderField'
import { PolicyCreateClientContactTabs } from '../../../../components/policies/PolicyCreateClientContactTabs'
import { INSURANCE_CONFIG_INSURANCES_PATH, INSURANCE_DESK_BASE } from '../../paths'
import { INSURANCE_POLICY_ATTACHMENT_ENTITY_ID } from '../../../../lib/insuranceDeskConstants'
import { transferDraftAttachmentsToRecord } from '../../../../lib/transferDraftAttachments'
import { policyApiRowToCreateFormInitial, type PolicyApiRow } from '../../../../lib/policyDuplicatePrefill'
import { buildLeadFormValuesFromPayload } from '../../../../lib/leadFormPrefill'
import {
  buildLeadPayloadExtras,
  leadContactFormToApi,
  mergeUsageIntoCoverageOptions,
} from '../../../../lib/leadPayloadMappers'
import { buildPolicyCreateInitialValuesFromLead } from '../../../../lib/buildPolicyCreateValuesFromLead'
import { createInsuranceExternalVehicleResource } from '../../../../lib/externalVehicleResource'
import { provisionPolicyInsuredEntities } from '../../../../lib/provisionPolicyInsuredEntities'

type LeadListResponse = {
  items: Array<{
    id: string
    title?: string
    referringPartnerEntityId: string | null
    payload: Record<string, unknown> | null
  }>
}

function trimStr(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export default function InsurancePolicyCreatePage() {
  const t = useT()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const router = useRouter()
  const searchParams = useSearchParams()
  const leadIdFromUrl = searchParams.get('leadId')
  const isLeadPrefill = Boolean(leadIdFromUrl?.trim())
  const duplicateFromPolicyId = searchParams.get('duplicateFrom')
  const [formKey, setFormKey] = React.useState(0)
  const [leadFlowReady, setLeadFlowReady] = React.useState(() => !searchParams.get('leadId'))

  const emptyInitial = React.useMemo(() => {
    const leadBase = buildLeadFormValuesFromPayload(null, {})
    return {
      ...leadBase,
      policyNumber: '',
      insurerId: '',
      insurerContactId: '',
      caretakerUserId: '',
      referringPartnerEntityId: '',
      catalogProductId: '',
      validFrom: '',
      validTo: '',
      status: '',
      insuranceSubject: emptyInsuranceSubjectValue(),
      sourceLeadId: '',
      insuredPersonEntityId: '',
      insuredCompanyEntityId: '',
    }
  }, [])

  const [initialValues, setInitialValues] = React.useState(emptyInitial)
  const attachmentDraftRecordId = React.useMemo(() => crypto.randomUUID(), [])

  React.useEffect(() => {
    let cancelled = false
    async function run() {
      if (leadIdFromUrl) {
        setLeadFlowReady(false)
        const leadId = leadIdFromUrl
        try {
          const call = await apiCall<LeadListResponse>(
            `/api/insurance/leads?id=${encodeURIComponent(leadId)}&page=1&pageSize=1`,
          )
          const lead = call.result?.items?.[0]
          if (cancelled) return
          if (!lead) {
            setInitialValues(emptyInitial)
            setFormKey((k) => k + 1)
            return
          }
          if (cancelled) return
          const merged = buildPolicyCreateInitialValuesFromLead(lead, t)
          if (cancelled) return
          setInitialValues({ ...emptyInitial, ...merged })
          setFormKey((k) => k + 1)
        } finally {
          if (!cancelled) setLeadFlowReady(true)
        }
        return
      }

      setLeadFlowReady(true)

      const dupId = duplicateFromPolicyId?.trim()
      if (dupId) {
        const call = await apiCall<{ items?: PolicyApiRow[] }>(
          `/api/insurance/policies?id=${encodeURIComponent(dupId)}&page=1&pageSize=1`,
        )
        const row = call.result?.items?.[0]
        if (cancelled) return
        if (!call.ok || !row) {
          setInitialValues(emptyInitial)
          setFormKey((k) => k + 1)
          return
        }
        setInitialValues({ ...emptyInitial, ...policyApiRowToCreateFormInitial(row) })
        setFormKey((k) => k + 1)
        return
      }

      setInitialValues(emptyInitial)
      setFormKey((k) => k + 1)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [duplicateFromPolicyId, emptyInitial, leadIdFromUrl, t])

  const loadInsurerOptions = React.useCallback(async (query?: string) => loadActiveInsurerSelectOptions(query), [])

  const loadPartnerOptions = React.useCallback(
    async (query?: string) =>
      searchPartnerEntityOptions(query, {
        personPrefix: t('insurance_desk.policies.form.partnerKind.person', 'Person'),
        companyPrefix: t('insurance_desk.policies.form.partnerKind.company', 'Company'),
      }),
    [t],
  )

  const loadProductOptions = React.useCallback(async () => {
    return loadCatalogProductOptions(t('insurance_desk.policies.form.none', '— none —'))
  }, [t])

  const loadCaretakerOpts = React.useCallback(async () => {
    return loadCaretakerUserOptions(t('insurance_desk.policies.form.none', '— none —'))
  }, [t])

  const loadStatusOptions = React.useCallback(async () => {
    return loadPolicyStatusSelectOptions()
  }, [])

  const mergeLeadFromPicker = React.useCallback(
    async (nextLeadId: string, _previousLeadId: string) => {
      if (!nextLeadId.trim()) return 'cancelled' as const
      const ok = await confirm({
        title: t(
          'insurance_desk.policies.form.sourceLead.confirmMergeTitle',
          'Fill the form from this inquiry?',
        ),
        text: t(
          'insurance_desk.policies.form.sourceLead.confirmMerge',
          'Do you want to fill the policy with data from the selected inquiry? Values in contact, usage, coverage and related sections will be replaced.',
        ),
        confirmText: t('common.continue', 'Continue'),
        cancelText: t('common.cancel', 'Cancel'),
      })
      if (!ok) return 'cancelled' as const
      const call = await apiCall<LeadListResponse>(
        `/api/insurance/leads?id=${encodeURIComponent(nextLeadId.trim())}&page=1&pageSize=1`,
      )
      const lead = call.result?.items?.[0]
      if (!lead) {
        await confirm({
          title: t('insurance_desk.policies.form.sourceLead.loadLeadFailed', 'Could not load the inquiry.'),
          cancelText: false,
          confirmText: t('common.ok', 'OK'),
        })
        return 'cancelled' as const
      }
      try {
        const merged = buildPolicyCreateInitialValuesFromLead(lead, t)
        setInitialValues({ ...emptyInitial, ...merged })
        setFormKey((k) => k + 1)
        return 'merged' as const
      } catch {
        await confirm({
          title: t('insurance_desk.policies.form.sourceLead.mergeFailed', 'Could not apply inquiry data to the form.'),
          cancelText: false,
          confirmText: t('common.ok', 'OK'),
        })
        return 'cancelled' as const
      }
    },
    [confirm, t],
  )

  const fields = React.useMemo<CrudField[]>(
    () => {
      const contactField: CrudField = isLeadPrefill
        ? {
            id: 'leadContact',
            label: '',
            type: 'custom',
            layout: 'full',
            component: LeadContactHolderField,
          }
        : {
            id: 'policyClientContactShell',
            label: '',
            type: 'custom',
            layout: 'full',
            component: PolicyCreateClientContactTabs,
          }
      return [
      {
        id: 'policyNumber',
        label: t('insurance_desk.policies.form.policyNumber', 'Policy number'),
        type: 'text',
        required: true,
        layout: 'third',
      },
      {
        id: 'insurerId',
        label: t('insurance_desk.policies.form.insurer', 'Insurer'),
        type: 'select',
        required: true,
        loadOptions: loadInsurerOptions,
        layout: 'third',
        useEntitySearchCombobox: true,
        remoteSelectSearch: true,
        createInNewTabHref: `${INSURANCE_DESK_BASE}/insurers/create`,
      },
      {
        id: 'insurerContactId',
        label: t('insurance_desk.policies.form.insurerContact', 'Insurer contact'),
        type: 'custom',
        component: PolicyInsurerContactField,
        layout: 'third',
      },
      {
        id: 'caretakerUserId',
        label: t('insurance_desk.policies.form.caretaker', 'Caretaker'),
        type: 'select',
        required: true,
        loadOptions: loadCaretakerOpts,
        layout: 'third',
        useEntitySearchCombobox: true,
        createInNewTabHref: '/backend/users/create',
      },
      {
        id: 'referringPartnerEntityId',
        label: t('insurance_desk.policies.form.referringPartyEntity', 'Referring party'),
        type: 'select',
        loadOptions: loadPartnerOptions,
        layout: 'third',
        useEntitySearchCombobox: true,
        remoteSelectSearch: true,
        createInNewTabHref: '/backend/customers/companies/create',
        description: t(
          'insurance_desk.leads.form.referringPartyHint',
          'Only CRM records of type partner or referrer.',
        ),
      },
      {
        id: 'catalogProductId',
        label: t('insurance_desk.policies.form.catalogProduct', 'Catalog product'),
        type: 'select',
        loadOptions: loadProductOptions,
        layout: 'third',
        useEntitySearchCombobox: true,
        createInNewTabHref: '/backend/catalog/products/create',
      },
      {
        id: 'validFrom',
        label: t('insurance_desk.policies.form.validFrom', 'Valid from'),
        type: 'date',
        layout: 'third',
      },
      {
        id: 'validTo',
        label: t('insurance_desk.policies.form.validTo', 'Valid to'),
        type: 'date',
        layout: 'third',
      },
      {
        id: 'status',
        label: t('insurance_desk.policies.form.status', 'Status'),
        type: 'select',
        required: true,
        loadOptions: loadStatusOptions,
        layout: 'third',
        useEntitySearchCombobox: true,
        createInNewTabHref: INSURANCE_CONFIG_INSURANCES_PATH,
      },
      contactField,
      {
        id: 'leadUsage',
        label: '',
        type: 'custom',
        layout: 'full',
        component: PolicyUsageSelectField,
      },
      {
        id: 'coverages',
        label: '',
        type: 'custom',
        layout: 'full',
        component: (fieldProps) => <LeadCoverageCatalogField {...fieldProps} catalogMode="policy" />,
      },
      {
        id: 'coverageOptions',
        label: '',
        type: 'custom',
        layout: 'full',
        component: PolicyCoverageOptionsField,
      },
      {
        id: 'insuranceSubject',
        label: '',
        type: 'custom',
        layout: 'full',
        component: PolicySubjectField,
      },
      {
        id: 'sourceLeadId',
        label: '',
        type: 'custom',
        layout: 'full',
        component: PolicySourceLeadField,
      },
    ]
    },
    [isLeadPrefill, loadCaretakerOpts, loadInsurerOptions, loadPartnerOptions, loadProductOptions, loadStatusOptions, t],
  )

  const groups = React.useMemo<CrudFormGroup[]>(
    () => [
      {
        id: 'basics',
        title: t('insurance_desk.policies.form.groups.basics', 'Basics'),
        column: 1,
        fields: [
          'policyNumber',
          'insurerId',
          'insurerContactId',
          'caretakerUserId',
          'referringPartnerEntityId',
          'catalogProductId',
          'validFrom',
          'validTo',
          'status',
        ],
      },
      {
        id: 'contact',
        title: isLeadPrefill
          ? t('insurance_desk.leads.form.groups.contact', 'Contact details')
          : undefined,
        column: 1,
        fields: [isLeadPrefill ? 'leadContact' : 'policyClientContactShell'],
      },
      {
        id: 'usage',
        title: t('insurance_desk.leads.form.groups.usage', 'Vehicle use'),
        column: 1,
        fields: ['leadUsage'],
      },
      {
        id: 'coverages',
        title: t('insurance_desk.policies.form.coverages.groupTitle', 'Coverage scope'),
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
        column: 2,
        fields: ['insuranceSubject'],
      },
      {
        id: 'sourceLead',
        title: t('insurance_desk.policies.form.sourceLead.sectionTitle', 'Related inquiry'),
        column: 2,
        fields: ['sourceLeadId'],
      },
      {
        id: 'attachments',
        title: t('attachments.library.title', 'Attachments'),
        description: t(
          'insurance_desk.policies.attachments.createHint',
          'Files are uploaded to a draft and linked automatically when you save the policy.',
        ),
        column: 2,
        component: () => (
          <AttachmentsSection
            entityId={INSURANCE_POLICY_ATTACHMENT_ENTITY_ID}
            recordId={attachmentDraftRecordId}
            showHeader={false}
          />
        ),
      },
    ],
    [attachmentDraftRecordId, isLeadPrefill, t],
  )

  const onSubmit = React.useCallback(
    async (values: Record<string, unknown>) => {
      const policyNumber = typeof values.policyNumber === 'string' ? values.policyNumber.trim() : ''
      const insurerId = typeof values.insurerId === 'string' ? values.insurerId.trim() : ''
      const referringPartnerEntityId =
        typeof values.referringPartnerEntityId === 'string' ? values.referringPartnerEntityId.trim() : ''
      const sourceLeadId = trimStr(values.sourceLeadId)

      if (!policyNumber.length) {
        throw createCrudFormError(t('insurance_desk.policies.form.errors.policyNumber', 'Policy number is required.'), {
          policyNumber: t('insurance_desk.policies.form.errors.policyNumber', 'Policy number is required.'),
        })
      }
      if (!insurerId.length) {
        throw createCrudFormError(t('insurance_desk.policies.form.errors.insurer', 'Insurer is required.'), {
          insurerId: t('insurance_desk.policies.form.errors.insurer', 'Insurer is required.'),
        })
      }
      const insurerContactRaw = typeof values.insurerContactId === 'string' ? values.insurerContactId.trim() : ''
      const caretakerRaw = typeof values.caretakerUserId === 'string' ? values.caretakerUserId.trim() : ''
      if (!caretakerRaw.length) {
        throw createCrudFormError(t('insurance_desk.policies.form.errors.caretaker', 'Caretaker is required.'), {
          caretakerUserId: t('insurance_desk.policies.form.errors.caretaker', 'Caretaker is required.'),
        })
      }
      const catalogProductIdRaw =
        typeof values.catalogProductId === 'string' ? values.catalogProductId.trim() : ''
      const statusRaw = typeof values.status === 'string' ? values.status.trim() : ''
      if (!statusRaw.length) {
        throw createCrudFormError(t('insurance_desk.policies.form.errors.status', 'Policy status is required.'), {
          status: t('insurance_desk.policies.form.errors.status', 'Policy status is required.'),
        })
      }

      const validFrom =
        values.validFrom instanceof Date
          ? values.validFrom
          : typeof values.validFrom === 'string' && values.validFrom.length
            ? new Date(values.validFrom)
            : null
      const validTo =
        values.validTo instanceof Date
          ? values.validTo
          : typeof values.validTo === 'string' && values.validTo.length
            ? new Date(values.validTo)
            : null

      const coveragesMeta = buildPolicyCoveragesMetadata(values.coverages)

      const covOptRaw = values.coverageOptions
      const covOptBase =
        covOptRaw && typeof covOptRaw === 'object'
          ? (covOptRaw as ReturnType<typeof emptyCoverageOptionsValue>)
          : emptyCoverageOptionsValue()
      const covOptForm = mergeUsageIntoCoverageOptions(values.leadUsage, covOptBase)
      const coverageOptionsMeta = buildCoverageOptionsMetadata(covOptForm)

      const subsRaw = values.coverageSubSelections
      const coverageSubSelections =
        subsRaw && typeof subsRaw === 'object' ? (subsRaw as Record<string, string>) : {}
      const detRaw = values.coverageDetailValues
      const coverageDetailValues =
        detRaw && typeof detRaw === 'object' ? (detRaw as Record<string, Record<string, unknown>>) : {}
      const usageExtras = buildLeadPayloadExtras(values.leadUsage, coverageSubSelections, coverageDetailValues)

      const subjRaw = values.insuranceSubject
      const subjForm =
        subjRaw && typeof subjRaw === 'object'
          ? (subjRaw as ReturnType<typeof emptyInsuranceSubjectValue>)
          : emptyInsuranceSubjectValue()

      const newResourceNameResolved = deriveNewResourceNameForApi(subjForm)
      if (subjForm.mode === 'new_resource' && !newResourceNameResolved) {
        throw createCrudFormError(
          t(
            'insurance_desk.policies.form.subject.errors.vehicleOrName',
            'Enter at least brand and model, registration plate, or VIN for the new resource.',
          ),
          {
            insuranceSubject: t(
              'insurance_desk.policies.form.subject.errors.vehicleOrName',
              'Enter at least brand and model, registration plate, or VIN for the new resource.',
            ),
          },
        )
      }

      const manualCompany = trimStr(values.insuredCompanyEntityId)
      const manualPerson = trimStr(values.insuredPersonEntityId)
      const hasManualInsured = manualCompany.length > 0 || manualPerson.length > 0

      const contactApi = hasManualInsured ? {} : leadContactFormToApi(values.leadContact)
      const errProvision = t(
        'insurance_desk.policies.form.errors.provisionInsured',
        'Could not create insured customer from inquiry contact.',
      )

      let insuredPersonEntityId: string | null
      let insuredCompanyEntityId: string | null
      if (hasManualInsured) {
        insuredPersonEntityId = manualPerson.length ? manualPerson : null
        insuredCompanyEntityId = manualCompany.length ? manualCompany : null
      } else {
        const provisioned = await provisionPolicyInsuredEntities({
          contact: contactApi,
          leadUsage: values.leadUsage,
          referringPartnerEntityId: referringPartnerEntityId.length ? referringPartnerEntityId : '',
          sourceLeadId,
          errorMessage: errProvision,
        })
        insuredPersonEntityId = provisioned.personEntityId
        insuredCompanyEntityId = provisioned.companyEntityId
      }

      const resourceCustomerEntityId = insuredCompanyEntityId ?? insuredPersonEntityId ?? null

      let resourceId: string | null = null
      if (subjForm.mode === 'existing') {
        const rid = subjForm.resourceId.trim()
        resourceId = rid.length ? rid : null
      } else {
        const newId = await createInsuranceExternalVehicleResource({
          t,
          name: newResourceNameResolved,
          description: subjForm.newResourceDescription.trim().length
            ? subjForm.newResourceDescription.trim()
            : null,
          vehicle: subjForm.vehicle,
          customerEntityId: resourceCustomerEntityId,
        })
        resourceId = newId
      }

      const subjectMeta = buildInsuranceSubjectMetadata(subjForm)
      const metadata: Record<string, unknown> = {}
      if (Object.keys(coveragesMeta).length) metadata.coverages = coveragesMeta
      if (Object.keys(coverageOptionsMeta).length) metadata.coverageOptions = coverageOptionsMeta
      if (subjectMeta) metadata.subject = subjectMeta
      if (Object.keys(contactApi).length) metadata.contact = contactApi
      Object.assign(metadata, usageExtras)

      const createPayload: Record<string, unknown> = {
        policyNumber,
        insurerId,
        referringPartnerEntityId: referringPartnerEntityId.length ? referringPartnerEntityId : null,
        insurerContactId: insurerContactRaw.length ? insurerContactRaw : null,
        caretakerUserId: caretakerRaw,
        catalogProductId: catalogProductIdRaw.length ? catalogProductIdRaw : null,
        resourceId,
        insuredPersonEntityId,
        insuredCompanyEntityId,
        validFrom: validFrom && !Number.isNaN(validFrom.getTime()) ? validFrom.toISOString() : null,
        validTo: validTo && !Number.isNaN(validTo.getTime()) ? validTo.toISOString() : null,
        status: statusRaw,
        metadata: Object.keys(metadata).length ? metadata : null,
      }
      if (sourceLeadId.length) {
        createPayload.sourceLeadId = sourceLeadId
      }

      const created = await createCrud<{ id?: string }>('insurance/policies', createPayload)
      const newPolicyId = typeof created.result?.id === 'string' ? created.result.id : null
      if (newPolicyId) {
        try {
          await transferDraftAttachmentsToRecord(INSURANCE_POLICY_ATTACHMENT_ENTITY_ID, attachmentDraftRecordId, newPolicyId)
        } catch {
          flash(
            t(
              'insurance_desk.policies.attachments.transferWarning',
              'Policy was saved but some draft files could not be linked. You can upload them again on the policy page.',
            ),
            'warning',
          )
        }
        router.push(`${INSURANCE_DESK_BASE}/policies/${encodeURIComponent(newPolicyId)}`)
      } else {
        router.push(`${INSURANCE_DESK_BASE}/policies`)
      }
    },
    [attachmentDraftRecordId, router, t],
  )

  if (!leadFlowReady) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage label={t('common.loading', 'Loading…')} />
        </PageBody>
      </Page>
    )
  }

  return (
    <Page>
      <PageBody>
        {ConfirmDialogElement}
        <PolicyCreateLeadMergeProvider value={{ mergeLeadFromPicker }}>
          <CrudForm
            key={formKey}
            entityId="insurance_desk:policy-create"
            title={t('insurance_desk.policies.create.detailTitle', 'New policy')}
            backHref={`${INSURANCE_DESK_BASE}/policies`}
            cancelHref={`${INSURANCE_DESK_BASE}/policies`}
            submitLabel={t('common.save', 'Save')}
            fields={fields}
            groups={groups}
            initialValues={initialValues}
            onSubmit={onSubmit}
          />
        </PolicyCreateLeadMergeProvider>
      </PageBody>
    </Page>
  )
}
