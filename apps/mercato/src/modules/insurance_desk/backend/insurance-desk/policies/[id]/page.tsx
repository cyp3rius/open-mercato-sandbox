"use client"

import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { FormHeader } from '@open-mercato/ui/backend/forms/FormHeader'
import { ErrorMessage, LoadingMessage, type InlineSelectOption } from '@open-mercato/ui/backend/detail'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { resolvePolicyListRowMatchingRule, type PolicyListColorRule } from '@open-mercato/core/modules/insurance/lib/policyListColorRules'
import {
  loadActiveInsurerSelectOptions,
  loadCaretakerUserOptions,
  loadCatalogProductOptions,
  mergeInsurerOptionIfMissing,
  mergePartnerEntityOptionIfMissing,
  searchPartnerEntityOptions,
  loadPolicyStatusDisplayEntries,
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
  type CoverageOptionsFormValue,
} from '../../../../components/policies/PolicyCoverageOptionsField'
import {
  PolicySubjectField,
  buildInsuranceSubjectMetadata,
  deriveNewResourceNameForApi,
  emptyInsuranceSubjectValue,
  type InsuranceSubjectFormValue,
} from '../../../../components/policies/PolicySubjectField'
import { PolicyAttachmentsPanel } from '../../../../components/policies/PolicyAttachmentsPanel'
import { INSURANCE_POLICY_ATTACHMENT_ENTITY_ID } from '../../../../lib/insuranceDeskConstants'
import { INSURANCE_DESK_BASE } from '../../paths'
import { createInsuranceExternalVehicleResource } from '../../../../lib/externalVehicleResource'
import {
  policyApiRowToListColorEvalRow,
  policyRowToDetailForm,
  type PolicyApiRow,
} from '../../../../lib/policyDuplicatePrefill'
import { fetchResourceNamesByIds } from '../../../../lib/policyListLookups'
import { LeadVisualSectionCard } from '../../../../components/leads/LeadVisualSectionCard'
import {
  LeadCoverageOptionsPreviewLines,
  LeadUsagePreviewLines,
} from '../../../../components/leads/leadDetailPreviewUtils'
import { LeadCoverageCatalogField } from '../../../../components/leads/LeadCoverageCatalogField'
import { PolicyUsageSelectField } from '../../../../components/policies/PolicyUsageSelectField'
import { PolicyCoverageScopeDetailPreview } from '../../../../components/policies/PolicyCoverageScopeDetailPreview'
import { PolicyBasicsInlineSection } from '../../../../components/policies/PolicyBasicsInlineSection'
import {
  PolicyCustomerDetailPreview,
  PolicyCustomerInlineSection,
} from '../../../../components/policies/PolicyCustomerInlineSection'
import { PolicySubjectDetailPreview } from '../../../../components/policies/PolicySubjectDetailPreview'
import { LinkedLeadPreviewCard } from '../../../../components/policies/LinkedLeadPreviewCard'
import { PolicyDetailListRuleBanner } from '../../../../components/policies/PolicyDetailListRuleBanner'
import { makePolicyDetailFieldProps } from '../../../../components/policies/policyDetailFieldProps'
import { AttachmentItemsPreview } from '../../../../components/attachments/AttachmentItemsPreview'
import {
  buildLeadPayloadExtras,
  leadContactFormToApi,
  mergeUsageIntoCoverageOptions,
} from '../../../../lib/leadPayloadMappers'

function shortId(value: string, len = 8) {
  if (!value.length) return '—'
  return value.length > len ? `${value.slice(0, len)}…` : value
}

function cloneFormValue(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown
}

type VisualSection = 'customer' | 'usage' | 'subject' | 'coverages' | 'coverageOptions' | 'attachments'

const SECTION_KEYS: Record<VisualSection, string[]> = {
  customer: ['insuredPersonEntityId', 'insuredCompanyEntityId'],
  usage: ['leadUsage'],
  subject: ['insuranceSubject'],
  coverages: ['coverages', 'coverageSubSelections', 'coverageDetailValues'],
  coverageOptions: ['coverageOptions'],
  attachments: [],
}

export default function InsurancePolicyDetailPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const policyId = typeof params?.id === 'string' ? params.id : ''

  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<Record<string, unknown> | null>(null)
  const formRef = React.useRef<Record<string, unknown> | null>(null)
  React.useEffect(() => {
    formRef.current = form
  }, [form])

  const [loading, setLoading] = React.useState(true)
  const [recordTitle, setRecordTitle] = React.useState('')
  const [insurerOptions, setInsurerOptions] = React.useState<InlineSelectOption[]>([])
  const [partnerOptions, setPartnerOptions] = React.useState<InlineSelectOption[]>([])
  const [productOptions, setProductOptions] = React.useState<InlineSelectOption[]>([])
  const [caretakerOptions, setCaretakerOptions] = React.useState<InlineSelectOption[]>([])
  const [statusOptions, setStatusOptions] = React.useState<InlineSelectOption[]>([])
  const [statusDisplayEntries, setStatusDisplayEntries] = React.useState<
    Array<{ value: string; label: string; icon?: string; color?: string }>
  >([])

  const [policySourceRow, setPolicySourceRow] = React.useState<PolicyApiRow | null>(null)
  const [listColorRules, setListColorRules] = React.useState<PolicyListColorRule[]>([])
  const [resourceDisplayName, setResourceDisplayName] = React.useState<string | null>(null)

  const [editingSection, setEditingSection] = React.useState<VisualSection | null>(null)
  const [sectionSaving, setSectionSaving] = React.useState(false)
  const editingRef = React.useRef<VisualSection | null>(null)
  const sectionSnapshotRef = React.useRef<Record<string, unknown> | null>(null)

  const mutationContextId = React.useMemo(
    () => (policyId ? `insurance-desk-policy:${policyId}` : 'insurance-desk-policy:pending'),
    [policyId],
  )
  const { runMutation, retryLastMutation } = useGuardedMutation({
    contextId: mutationContextId,
    blockedMessage: t('ui.forms.flash.saveBlocked', 'Save blocked by validation'),
  })

  const partnerPrefixes = React.useMemo(
    () => ({
      personPrefix: t('insurance_desk.policies.form.partnerKind.person', 'Person'),
      companyPrefix: t('insurance_desk.policies.form.partnerKind.company', 'Company'),
    }),
    [t],
  )

  const loadProductOptionsCb = React.useCallback(async () => {
    return loadCatalogProductOptions(t('insurance_desk.policies.form.none', '— none —'))
  }, [t])

  const loadCaretakerOptsCb = React.useCallback(async () => {
    return loadCaretakerUserOptions(t('insurance_desk.policies.form.none', '— none —'))
  }, [t])

  const loadStatusOptsCb = React.useCallback(async () => {
    return loadPolicyStatusSelectOptions()
  }, [])

  React.useEffect(() => {
    let cancelled = false
    void Promise.all([
      loadProductOptionsCb(),
      loadCaretakerOptsCb(),
      loadStatusOptsCb(),
      loadPolicyStatusDisplayEntries(),
    ]).then(([prod, caret, st, stDisp]) => {
      if (cancelled) return
      setProductOptions(prod)
      setCaretakerOptions(caret)
      setStatusOptions(st)
      setStatusDisplayEntries(stDisp)
    })
    return () => {
      cancelled = true
    }
  }, [loadCaretakerOptsCb, loadProductOptionsCb, loadStatusOptsCb])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const current = policySourceRow?.insurerId?.trim()
      let opts = await loadActiveInsurerSelectOptions()
      opts = await mergeInsurerOptionIfMissing(opts, current ?? null)
      if (!cancelled) setInsurerOptions(opts)
    })()
    return () => {
      cancelled = true
    }
  }, [policySourceRow?.insurerId, scopeVersion])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const current = policySourceRow?.referringPartnerEntityId?.trim()
      let opts = await searchPartnerEntityOptions(undefined, partnerPrefixes)
      opts = await mergePartnerEntityOptionIfMissing(opts, current ?? null, partnerPrefixes)
      if (!cancelled) setPartnerOptions(opts)
    })()
    return () => {
      cancelled = true
    }
  }, [partnerPrefixes, policySourceRow?.referringPartnerEntityId, scopeVersion])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const call = await apiCall<{ rules?: PolicyListColorRule[] }>('/api/insurance/config-policy-list-color-rules')
      if (cancelled) return
      setListColorRules(Array.isArray(call.result?.rules) ? call.result.rules : [])
    })()
    return () => {
      cancelled = true
    }
  }, [scopeVersion])

  React.useEffect(() => {
    const rid = policySourceRow?.resourceId?.trim()
    if (!rid?.length) {
      setResourceDisplayName(null)
      return
    }
    let cancelled = false
    void fetchResourceNamesByIds([rid]).then((m) => {
      if (!cancelled) setResourceDisplayName(m.get(rid) ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [policySourceRow?.resourceId])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      if (!policyId) {
        setLoadError(t('insurance_desk.policies.detail.missingId', 'Missing policy id.'))
        setLoading(false)
        setPolicySourceRow(null)
        return
      }
      setLoading(true)
      setLoadError(null)
      try {
        const call = await apiCall<{ items?: PolicyApiRow[] }>(
          `/api/insurance/policies?id=${encodeURIComponent(policyId)}&page=1&pageSize=1`,
        )
        if (cancelled) return
        const row = call.result?.items?.[0]
        if (!call.ok || !row) {
          setLoadError(t('insurance_desk.policies.detail.notFound', 'Policy not found.'))
          setForm(null)
          setPolicySourceRow(null)
          return
        }
        setPolicySourceRow(row)
        setRecordTitle(
          row.policyNumber.trim().length ? row.policyNumber.trim() : t('insurance_desk.policies.detail.titleFallback', 'Policy'),
        )
        setForm(policyRowToDetailForm(row))
      } catch (e: unknown) {
        setLoadError(e instanceof Error ? e.message : String(e))
        setForm(null)
        setPolicySourceRow(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [policyId, t])

  const listRuleEvalRow = React.useMemo(
    () => (policySourceRow ? policyApiRowToListColorEvalRow(policySourceRow) : null),
    [policySourceRow],
  )

  const listRuleMatch = React.useMemo(() => {
    if (!listRuleEvalRow) return null
    return resolvePolicyListRowMatchingRule(listRuleEvalRow, listColorRules)
  }, [listRuleEvalRow, listColorRules])

  const getStatusLabel = React.useCallback(
    (value: string) => {
      const entry = statusDisplayEntries.find((x) => x.value.trim() === value.trim())
      return entry?.label ?? value
    },
    [statusDisplayEntries],
  )

  const getInsurerLabel = React.useCallback(
    (id: string) => insurerOptions.find((o) => o.value === id)?.label ?? shortId(id),
    [insurerOptions],
  )

  const getPartnerLabel = React.useCallback(
    (id: string) => partnerOptions.find((o) => o.value === id)?.label ?? shortId(id, 12),
    [partnerOptions],
  )

  const getProductLabel = React.useCallback(
    (id: string | null) => {
      if (id == null || !String(id).trim().length) return t('insurance_desk.detail.emptyField', '—')
      return productOptions.find((o) => o.value === id)?.label ?? shortId(String(id))
    },
    [productOptions, t],
  )

  const getResourceLabel = React.useCallback(
    (id: string | null) => {
      if (id == null || !id.trim().length) return t('insurance_desk.detail.emptyField', '—')
      if (resourceDisplayName && policySourceRow?.resourceId === id) return resourceDisplayName
      return shortId(id)
    },
    [resourceDisplayName, policySourceRow?.resourceId, t],
  )

  const persistPolicy = React.useCallback(
    async (values: Record<string, unknown>) => {
      const policyNumber = typeof values.policyNumber === 'string' ? values.policyNumber.trim() : ''
      const insurerId = typeof values.insurerId === 'string' ? values.insurerId.trim() : ''
      const referringPartnerEntityId =
        typeof values.referringPartnerEntityId === 'string' ? values.referringPartnerEntityId.trim() : ''
      if (!policyNumber.length || !insurerId.length) {
        flash(t('insurance_desk.policies.form.errors.policyNumber', 'Check required fields.'), 'error')
        return
      }
      const insurerContactRaw = typeof values.insurerContactId === 'string' ? values.insurerContactId.trim() : ''
      const caretakerRaw = typeof values.caretakerUserId === 'string' ? values.caretakerUserId.trim() : ''
      if (!caretakerRaw.length) {
        flash(t('insurance_desk.policies.form.errors.caretaker', 'Caretaker is required.'), 'error')
        return
      }
      const catalogProductIdRaw = typeof values.catalogProductId === 'string' ? values.catalogProductId.trim() : ''
      const insuredPersonRaw =
        typeof values.insuredPersonEntityId === 'string' ? values.insuredPersonEntityId.trim() : ''
      const insuredCompanyRaw =
        typeof values.insuredCompanyEntityId === 'string' ? values.insuredCompanyEntityId.trim() : ''
      const statusRaw = typeof values.status === 'string' ? values.status.trim() : ''
      if (!statusRaw.length) {
        flash(t('insurance_desk.policies.form.errors.status', 'Policy status is required.'), 'error')
        return
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

      const coveragesForm = normalizeCoveragesValue(values.coverages)
      const covOptBase =
        values.coverageOptions && typeof values.coverageOptions === 'object'
          ? (values.coverageOptions as CoverageOptionsFormValue)
          : emptyCoverageOptionsValue()
      const covOptForm = mergeUsageIntoCoverageOptions(values.leadUsage, covOptBase)

      const subsRaw = values.coverageSubSelections
      const coverageSubSelections =
        subsRaw && typeof subsRaw === 'object' ? (subsRaw as Record<string, string>) : {}
      const detRaw = values.coverageDetailValues
      const coverageDetailValues =
        detRaw && typeof detRaw === 'object' ? (detRaw as Record<string, Record<string, unknown>>) : {}
      const usageExtras = buildLeadPayloadExtras(values.leadUsage, coverageSubSelections, coverageDetailValues)

      const subjForm =
        values.insuranceSubject && typeof values.insuranceSubject === 'object'
          ? (values.insuranceSubject as InsuranceSubjectFormValue)
          : emptyInsuranceSubjectValue()

      const newResourceNameResolved = deriveNewResourceNameForApi(subjForm)
      if (subjForm.mode === 'new_resource' && !newResourceNameResolved) {
        flash(
          t(
            'insurance_desk.policies.form.subject.errors.vehicleOrName',
            'Enter at least brand and model, registration plate, or VIN for the new resource.',
          ),
          'error',
        )
        return
      }

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
        })
        resourceId = newId
      }

      const coveragesMeta = buildPolicyCoveragesMetadata(coveragesForm)
      const coverageOptionsMeta = buildCoverageOptionsMetadata(covOptForm)
      const subjectMeta = buildInsuranceSubjectMetadata(subjForm)
      const contactApi = leadContactFormToApi(values.leadContact)

      const metadata: Record<string, unknown> = {}
      if (Object.keys(coveragesMeta).length) metadata.coverages = coveragesMeta
      if (Object.keys(coverageOptionsMeta).length) metadata.coverageOptions = coverageOptionsMeta
      if (subjectMeta) metadata.subject = subjectMeta
      if (Object.keys(contactApi).length) metadata.contact = contactApi
      Object.assign(metadata, usageExtras)

      await runMutation({
        operation: () =>
          updateCrud(
            'insurance/policies',
            {
        id: policyId,
        policyNumber,
        insurerId,
              referringPartnerEntityId: referringPartnerEntityId.length ? referringPartnerEntityId : null,
        insurerContactId: insurerContactRaw.length ? insurerContactRaw : null,
              caretakerUserId: caretakerRaw,
        catalogProductId: catalogProductIdRaw.length ? catalogProductIdRaw : null,
        resourceId,
              insuredPersonEntityId: insuredPersonRaw.length ? insuredPersonRaw : null,
              insuredCompanyEntityId: insuredCompanyRaw.length ? insuredCompanyRaw : null,
        validFrom: validFrom && !Number.isNaN(validFrom.getTime()) ? validFrom.toISOString() : null,
        validTo: validTo && !Number.isNaN(validTo.getTime()) ? validTo.toISOString() : null,
              status: statusRaw,
        metadata: Object.keys(metadata).length ? metadata : null,
            },
            { errorMessage: t('ui.forms.flash.saveError', 'Could not save.') },
          ),
        context: {
          resourceKind: 'insurance.policy',
          resourceId: policyId,
          retryLastMutation,
        },
      })

      flash(t('ui.forms.flash.saveSuccess', 'Saved successfully.'), 'success')
      const refresh = await apiCall<{ items?: PolicyApiRow[] }>(
        `/api/insurance/policies?id=${encodeURIComponent(policyId)}&page=1&pageSize=1`,
      )
      const refreshed = refresh.result?.items?.[0]
      if (refreshed) {
        setPolicySourceRow(refreshed)
        setRecordTitle(
          refreshed.policyNumber.trim().length
            ? refreshed.policyNumber.trim()
            : t('insurance_desk.policies.detail.titleFallback', 'Policy'),
        )
        setForm(policyRowToDetailForm(refreshed))
      }
    },
    [policyId, retryLastMutation, runMutation, t],
  )

  const beginSectionEdit = (section: VisualSection) => {
    const keys = SECTION_KEYS[section]
    setForm((current) => {
      if (!current) return current
      let base = current
      if (editingRef.current && sectionSnapshotRef.current) {
        base = { ...current, ...sectionSnapshotRef.current }
      }
      const snap: Record<string, unknown> = {}
      for (const k of keys) {
        snap[k] = cloneFormValue((base as Record<string, unknown>)[k])
      }
      sectionSnapshotRef.current = snap
      editingRef.current = section
      return base
    })
    setEditingSection(section)
  }

  const cancelSectionEdit = () => {
    setForm((current) => {
      if (!current || !sectionSnapshotRef.current) return current
      return { ...current, ...sectionSnapshotRef.current }
    })
    sectionSnapshotRef.current = null
    editingRef.current = null
    setEditingSection(null)
  }

  const saveSectionEdit = async () => {
    if (editingSection === 'attachments') {
      sectionSnapshotRef.current = null
      editingRef.current = null
      setEditingSection(null)
      return
    }
    const current = formRef.current
    if (!current) return
    setSectionSaving(true)
    try {
      await persistPolicy(current)
      sectionSnapshotRef.current = null
      editingRef.current = null
      setEditingSection(null)
    } finally {
      setSectionSaving(false)
    }
  }

  if (loading) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage label={t('common.loading', 'Loading…')} />
        </PageBody>
      </Page>
    )
  }

  if (loadError || !form) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage label={loadError ?? t('insurance_desk.policies.detail.notFound', 'Policy not found.')} />
        </PageBody>
      </Page>
    )
  }

  const subs =
    form.coverageSubSelections && typeof form.coverageSubSelections === 'object'
      ? (form.coverageSubSelections as Record<string, string>)
      : {}
  const det =
    form.coverageDetailValues && typeof form.coverageDetailValues === 'object'
      ? (form.coverageDetailValues as Record<string, Record<string, unknown>>)
      : {}

  return (
    <Page>
      <PageBody className="space-y-8">
        <FormHeader
          mode="detail"
          backHref={`${INSURANCE_DESK_BASE}/policies`}
          entityTypeLabel={t('insurance_desk.policies.detail.entityLabel', 'Policy')}
          title={recordTitle}
        />

        {listRuleMatch && listRuleEvalRow ? (
          <PolicyDetailListRuleBanner
            rule={listRuleMatch}
            evalRow={listRuleEvalRow}
            t={t}
            getStatusLabel={getStatusLabel}
            getInsurerLabel={getInsurerLabel}
            getPartnerLabel={getPartnerLabel}
            getProductLabel={getProductLabel}
            getResourceLabel={getResourceLabel}
          />
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[7fr_3fr] lg:items-start">
          <div className="min-w-0 space-y-6">
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">
                {t('insurance_desk.policies.form.groups.basics', 'Basics')}
              </h2>
              <PolicyBasicsInlineSection
                form={form}
                setForm={setForm}
                persistPolicy={persistPolicy}
                insurerOptions={insurerOptions}
                partnerOptions={partnerOptions}
                productOptions={productOptions}
                caretakerOptions={caretakerOptions}
                statusOptions={statusOptions}
                statusDisplay={statusDisplayEntries}
              />
            </div>

            <LeadVisualSectionCard
              title={t('insurance_desk.policies.detail.customer.sectionTitle', 'Customer data')}
              editing={editingSection === 'customer'}
              onBeginEdit={() => beginSectionEdit('customer')}
              onCancelEdit={cancelSectionEdit}
              onSaveEdit={saveSectionEdit}
              saving={sectionSaving}
              preview={
                <PolicyCustomerDetailPreview
                  companyId={
                    typeof form.insuredCompanyEntityId === 'string' ? form.insuredCompanyEntityId.trim() : ''
                  }
                  personId={
                    typeof form.insuredPersonEntityId === 'string' ? form.insuredPersonEntityId.trim() : ''
                  }
                  t={t}
                />
              }
              editContent={<PolicyCustomerInlineSection mode="record" form={form} setForm={setForm} />}
            />

            <LeadVisualSectionCard
              title={t('insurance_desk.leads.form.groups.usage', 'Vehicle use')}
              description={t(
                'insurance_desk.policies.detail.insured.hint',
                'How the vehicle is used (stored in policy metadata).',
              )}
              editing={editingSection === 'usage'}
              onBeginEdit={() => beginSectionEdit('usage')}
              onCancelEdit={cancelSectionEdit}
              onSaveEdit={saveSectionEdit}
              saving={sectionSaving}
              preview={<LeadUsagePreviewLines leadUsage={form.leadUsage} t={t} />}
              editContent={<PolicyUsageSelectField {...makePolicyDetailFieldProps(form, setForm, 'leadUsage')} />}
            />

            <LeadVisualSectionCard
              title={t('insurance_desk.policies.form.coverages.groupTitle', 'Coverage scope')}
              editing={editingSection === 'coverages'}
              onBeginEdit={() => beginSectionEdit('coverages')}
              onCancelEdit={cancelSectionEdit}
              onSaveEdit={saveSectionEdit}
              saving={sectionSaving}
              preview={
                <PolicyCoverageScopeDetailPreview
                  coverages={form.coverages}
                  coverageSubSelections={subs}
                  coverageDetailValues={det}
                />
              }
              editContent={
                <LeadCoverageCatalogField
                  {...makePolicyDetailFieldProps(form, setForm, 'coverages')}
                  catalogMode="policy"
                  omitSectionHeading
                />
              }
            />

            <LeadVisualSectionCard
              title={t('insurance_desk.leads.form.groups.protectionDetails', 'Protection details')}
              description={t(
                'insurance_desk.leads.coverageDetails.intro',
                'Protection preferences — sections follow the coverage types selected above.',
              )}
              editing={editingSection === 'coverageOptions'}
              onBeginEdit={() => beginSectionEdit('coverageOptions')}
              onCancelEdit={cancelSectionEdit}
              onSaveEdit={saveSectionEdit}
              saving={sectionSaving}
              preview={
                <LeadCoverageOptionsPreviewLines
                  coverageOptions={form.coverageOptions}
                  leadUsage={form.leadUsage}
                  coverages={form.coverages}
                  t={t}
                />
              }
              editContent={
                <PolicyCoverageOptionsField {...makePolicyDetailFieldProps(form, setForm, 'coverageOptions')} />
              }
            />
          </div>

          <div className="space-y-6 min-w-0">
            <LeadVisualSectionCard
              title={t('insurance_desk.policies.detail.subject.sectionTitle', 'Subject of insurance')}
              description={t(
                'insurance_desk.policies.detail.subject.hint',
                'Linked platform resource and vehicle details from policy metadata.',
              )}
              editing={editingSection === 'subject'}
              onBeginEdit={() => beginSectionEdit('subject')}
              onCancelEdit={cancelSectionEdit}
              onSaveEdit={saveSectionEdit}
              saving={sectionSaving}
              preview={
                <PolicySubjectDetailPreview
                  insuranceSubject={form.insuranceSubject}
                  t={t}
                  policyResourceId={policySourceRow?.resourceId ?? null}
                  resourceDisplayName={resourceDisplayName}
                />
              }
              editContent={<PolicySubjectField {...makePolicyDetailFieldProps(form, setForm, 'insuranceSubject')} />}
            />

            <LinkedLeadPreviewCard policyId={policyId} />

            <LeadVisualSectionCard
              title={t('insurance_desk.policies.attachments.title', 'Attachments')}
              description={t(
                'insurance_desk.policies.attachments.hint',
                'Choose a category, then upload. You can add multiple files.',
              )}
              editing={editingSection === 'attachments'}
              onBeginEdit={() => beginSectionEdit('attachments')}
              onCancelEdit={cancelSectionEdit}
              onSaveEdit={saveSectionEdit}
              saving={sectionSaving}
              preview={<AttachmentItemsPreview entityId={INSURANCE_POLICY_ATTACHMENT_ENTITY_ID} recordId={policyId} />}
              editContent={<PolicyAttachmentsPanel policyId={policyId} embedded />}
            />
          </div>
        </div>
      </PageBody>
    </Page>
  )
}
