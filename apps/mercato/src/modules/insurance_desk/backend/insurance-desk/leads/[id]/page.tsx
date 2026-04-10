"use client"

import * as React from 'react'
import Link from 'next/link'
import { BadgeCheck } from 'lucide-react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { FormHeader } from '@open-mercato/ui/backend/forms/FormHeader'
import {
  DetailFieldsSection,
  type DetailFieldConfig,
  ErrorMessage,
  LoadingMessage,
  type InlineSelectOption,
} from '@open-mercato/ui/backend/detail'
import { renderDictionaryIcon } from '@open-mercato/core/modules/dictionaries/components/dictionaryAppearance'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { Button } from '@open-mercato/ui/primitives/button'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { loadPartnerEntityOptions } from '../../../../lib/loadPolicyFormOptions'
import { emptyPolicyCoveragesValue } from '../../../../components/policies/PolicyCoveragesField'
import { PolicyCoverageOptionsField, emptyCoverageOptionsValue } from '../../../../components/policies/PolicyCoverageOptionsField'
import { LeadCoverageCatalogField } from '../../../../components/leads/LeadCoverageCatalogField'
import { LeadContactHolderField } from '../../../../components/leads/LeadContactHolderField'
import { LeadUsageField } from '../../../../components/leads/LeadUsageField'
import { LeadInquiryVehicleField } from '../../../../components/leads/LeadInquiryVehicleField'
import { emptyVehicleFields } from '../../../../components/policies/PolicySubjectField'
import { INSURANCE_DESK_BASE } from '../../paths'
import { buildLeadFormValuesFromPayload } from '../../../../lib/leadFormPrefill'
import { buildLeadPayloadFromFormValues, deriveLeadTitleFromForm } from '../../../../lib/leadApiPayload'
import { emptyLeadContactForm } from '../../../../lib/leadContactForm'
import { emptyLeadUsageForm } from '../../../../lib/leadUsageForm'
import { makeLeadDetailFieldProps } from '../../../../lib/leadDetailFieldProps'
import { LeadVisualSectionCard } from '../../../../components/leads/LeadVisualSectionCard'
import {
  LeadContactPreview,
  LeadCoveragesCatalogPreview,
  LeadCoverageOptionsPreviewLines,
  LeadUsagePreviewLines,
  LeadVehiclePreview,
} from '../../../../components/leads/leadDetailPreviewUtils'
import { AttachmentItemsPreview } from '../../../../components/attachments/AttachmentItemsPreview'
import { LeadAttachmentsPanel } from '../../../../components/leads/LeadAttachmentsPanel'
import { LinkedPolicyPreviewCard } from '../../../../components/leads/LinkedPolicyPreviewCard'
import { INSURANCE_LEAD_ATTACHMENT_ENTITY_ID } from '../../../../lib/insuranceDeskConstants'

function trimStr(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function cloneFormValue(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown
}

type LeadApiRow = {
  id: string
  title: string
  status: string
  source: string | null
  payload: Record<string, unknown> | null
  referringPartnerEntityId: string | null
  linkedPolicyId: string | null
}

type ListResponse = { items?: LeadApiRow[] }

type VisualSection = 'contact' | 'usage' | 'coverages' | 'coverageOptions' | 'vehicle' | 'attachments'

const SECTION_KEYS: Record<VisualSection, string[]> = {
  contact: ['leadContact'],
  usage: ['leadUsage'],
  coverages: ['coverages', 'coverageSubSelections', 'coverageDetailValues'],
  coverageOptions: ['coverageOptions'],
  vehicle: ['leadVehicle'],
  attachments: [],
}

export default function InsuranceLeadDetailPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const leadId = typeof params?.id === 'string' ? params.id : ''

  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<Record<string, unknown> | null>(null)
  const formRef = React.useRef<Record<string, unknown> | null>(null)
  React.useEffect(() => {
    formRef.current = form
  }, [form])

  const [loading, setLoading] = React.useState(true)
  const [linkedPolicyId, setLinkedPolicyId] = React.useState<string | null>(null)
  const [canCreatePolicy, setCanCreatePolicy] = React.useState(false)
  const [recordTitle, setRecordTitle] = React.useState('')
  const [partnerOptions, setPartnerOptions] = React.useState<InlineSelectOption[]>([])
  const [editingSection, setEditingSection] = React.useState<VisualSection | null>(null)
  const [sectionSaving, setSectionSaving] = React.useState(false)
  const editingRef = React.useRef<VisualSection | null>(null)
  const sectionSnapshotRef = React.useRef<Record<string, unknown> | null>(null)

  const loadedTitleRef = React.useRef('')
  const loadedStatusRef = React.useRef('received')
  const loadedSourceRef = React.useRef<string | null>('insurance_desk')
  const [inquiryStatus, setInquiryStatus] = React.useState('')
  const [leadStatusEntries, setLeadStatusEntries] = React.useState<
    Array<{ value: string; label: string; icon?: string; color?: string }>
  >([])

  const mutationContextId = React.useMemo(
    () => (leadId ? `insurance-desk-lead:${leadId}` : 'insurance-desk-lead:pending'),
    [leadId],
  )
  const { runMutation, retryLastMutation } = useGuardedMutation({
    contextId: mutationContextId,
    blockedMessage: t('ui.forms.flash.saveBlocked', 'Save blocked by validation'),
  })

  const loadPartnerOptions = React.useCallback(async () => {
    return loadPartnerEntityOptions({
      personPrefix: t('insurance_desk.policies.form.partnerKind.person', 'Person'),
      companyPrefix: t('insurance_desk.policies.form.partnerKind.company', 'Company'),
    })
  }, [t])

  React.useEffect(() => {
    let cancelled = false
    void loadPartnerOptions().then((opts) => {
      if (!cancelled) setPartnerOptions(opts)
    })
    return () => {
      cancelled = true
    }
  }, [loadPartnerOptions])

  React.useEffect(() => {
    let cancelled = false
    void apiCall<{ entries?: Array<{ value: string; label: string; icon?: string; color?: string }> }>(
      '/api/insurance/config-lead-status',
    ).then((call) => {
      if (cancelled) return
      setLeadStatusEntries(Array.isArray(call.result?.entries) ? call.result.entries : [])
    })
    return () => {
      cancelled = true
    }
  }, [])

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

  React.useEffect(() => {
    let cancelled = false
    async function loadPerm() {
      const call = await apiCall<{ granted?: string[]; ok?: boolean }>('/api/auth/feature-check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ features: ['insurance.policies.manage'] }),
      })
      if (cancelled) return
      const granted = Array.isArray(call.result?.granted) ? call.result?.granted : []
      setCanCreatePolicy(granted.includes('insurance.policies.manage'))
    }
    void loadPerm()
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      if (!leadId) {
        setLoadError(t('insurance_desk.leads.detail.missingId', 'Missing inquiry id.'))
        setLoading(false)
        return
      }
      setLoading(true)
      setLoadError(null)
      try {
        const call = await apiCall<ListResponse>(
          `/api/insurance/leads?id=${encodeURIComponent(leadId)}&page=1&pageSize=1`,
        )
        if (cancelled) return
        const row = call.result?.items?.[0]
        if (!call.ok || !row) {
          setLoadError(t('insurance_desk.leads.detail.notFound', 'Inquiry not found.'))
          setForm(null)
          return
        }
        loadedTitleRef.current = row.title
        loadedStatusRef.current = row.status
        setInquiryStatus(row.status)
        loadedSourceRef.current = row.source
        setLinkedPolicyId(typeof row.linkedPolicyId === 'string' ? row.linkedPolicyId : null)
        setRecordTitle(row.title.trim().length ? row.title : t('insurance_desk.leads.detail.titleFallback', 'Inquiry'))
        const formValues = buildLeadFormValuesFromPayload(row.referringPartnerEntityId, row.payload)
        setForm({ ...emptyInitial, ...formValues })
      } catch (e: unknown) {
        setLoadError(e instanceof Error ? e.message : String(e))
        setForm(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [emptyInitial, leadId, t])

  React.useEffect(() => {
    if (!linkedPolicyId) return
    sectionSnapshotRef.current = null
    editingRef.current = null
    setEditingSection(null)
  }, [linkedPolicyId])

  const persistLead = React.useCallback(
    async (values: Record<string, unknown>) => {
      if (linkedPolicyId) return
      const referringPartnerEntityId = trimStr(values.referringPartnerEntityId)
      if (!referringPartnerEntityId.length) {
        flash(t('insurance_desk.policies.form.errors.partner', 'Referring party is required.'), 'error')
        return
      }

      let payload: ReturnType<typeof buildLeadPayloadFromFormValues>
      try {
        payload = buildLeadPayloadFromFormValues(values)
      } catch (e: unknown) {
        if (e instanceof Error && e.message === 'LEAD_VEHICLE_REQUIRED') {
          flash(
            t(
              'insurance_desk.leads.form.errors.vehicleRequired',
              'Enter at least brand and model, registration plate, or VIN.',
            ),
            'error',
          )
          return
        }
        throw e
      }

      const title = deriveLeadTitleFromForm(values, loadedTitleRef.current)
      if (!title.length) {
        flash(
          t('insurance_desk.leads.form.errors.title', 'Vehicle identifiers are required.'),
          'error',
        )
        return
      }

      await runMutation({
        operation: () =>
          updateCrud(
            'insurance/leads',
            {
              id: leadId,
              title,
              status: loadedStatusRef.current,
              source: loadedSourceRef.current,
              referringPartnerEntityId,
              payload,
            },
            { errorMessage: t('insurance_desk.leads.form.errors.create', 'Could not save inquiry.') },
          ),
        context: {
          resourceKind: 'insurance.lead',
          resourceId: leadId,
          retryLastMutation,
        },
      })

      flash(t('ui.forms.flash.saveSuccess', 'Saved successfully.'), 'success')
      const refresh = await apiCall<ListResponse>(
        `/api/insurance/leads?id=${encodeURIComponent(leadId)}&page=1&pageSize=1`,
      )
      const refreshed = refresh.result?.items?.[0]
      if (refreshed) {
        loadedTitleRef.current = refreshed.title
        loadedStatusRef.current = refreshed.status
        setInquiryStatus(refreshed.status)
        loadedSourceRef.current = refreshed.source
        setLinkedPolicyId(typeof refreshed.linkedPolicyId === 'string' ? refreshed.linkedPolicyId : null)
        setRecordTitle(
          refreshed.title.trim().length ? refreshed.title : t('insurance_desk.leads.detail.titleFallback', 'Inquiry'),
        )
        const formValues = buildLeadFormValuesFromPayload(refreshed.referringPartnerEntityId, refreshed.payload)
        setForm({ ...emptyInitial, ...formValues })
      }
    },
    [emptyInitial, leadId, linkedPolicyId, retryLastMutation, runMutation, t],
  )

  const beginSectionEdit = (section: VisualSection) => {
    if (linkedPolicyId) return
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
      await persistLead(current)
      sectionSnapshotRef.current = null
      editingRef.current = null
      setEditingSection(null)
    } finally {
      setSectionSaving(false)
    }
  }

  const basicsFields = React.useMemo((): DetailFieldConfig[] => {
    if (!form) return []
    const empty = t('insurance_desk.detail.emptyField', '—')
    const locked = Boolean(linkedPolicyId)
    const statusOptions: InlineSelectOption[] = leadStatusEntries.map((e) => ({
      value: e.value,
      label: e.label,
    }))
    const statusValue = inquiryStatus.trim()
    if (statusValue.length && !statusOptions.some((o) => o.value === statusValue)) {
      statusOptions.push({ value: statusValue, label: statusValue })
    }
    return [
      {
        kind: 'select',
        key: 'inquiryStatus',
        label: t('insurance_desk.leads.col.status', 'Status'),
        value: statusValue,
        emptyLabel: empty,
        options: statusOptions,
        gridClassName: 'md:col-span-2 xl:col-span-3',
        activateOnClick: !locked,
        showEditTrigger: !locked,
        renderDisplay: ({ value: v, emptyLabel: el }) => {
          const raw = typeof v === 'string' ? v.trim() : ''
          if (!raw.length) {
            return <span className="text-muted-foreground">{el}</span>
          }
          const meta = leadStatusEntries.find((e) => e.value === raw)
          const label = meta?.label ?? raw
          const icon = meta?.icon?.trim()
          const color = meta?.color?.trim()
          return (
            <div className="space-y-0.5">
              <p className="font-medium leading-tight">
                <span className="inline-flex items-center gap-2">
                  {icon ? (
                    <span className="shrink-0 text-muted-foreground">{renderDictionaryIcon(icon, 'h-4 w-4')}</span>
                  ) : null}
                  {color ? (
                    <span
                      className="inline-block size-2.5 shrink-0 rounded-full border border-border"
                      style={{ backgroundColor: color }}
                    />
                  ) : null}
                  <span>{label}</span>
                </span>
              </p>
            </div>
          )
        },
        onSave: async (next) => {
          if (linkedPolicyId) return
          const status = (next ?? '').trim()
          if (!status.length) {
            flash(t('insurance_desk.leads.form.errors.statusRequired', 'Status is required.'), 'error')
            throw new Error('validation')
          }
          await runMutation({
            operation: () =>
              updateCrud(
                'insurance/leads',
                { id: leadId, status },
                { errorMessage: t('insurance_desk.leads.form.errors.statusSave', 'Could not save status.') },
              ),
            context: {
              resourceKind: 'insurance.lead',
              resourceId: leadId,
              retryLastMutation,
            },
          })
          loadedStatusRef.current = status
          setInquiryStatus(status)
          flash(t('ui.forms.flash.saveSuccess', 'Saved successfully.'), 'success')
        },
      },
      {
        kind: 'select',
        key: 'referringPartnerEntityId',
        label: t('insurance_desk.policies.form.referringPartyEntity', 'Referring party'),
        value: typeof form.referringPartnerEntityId === 'string' ? form.referringPartnerEntityId : '',
        emptyLabel: empty,
        options: partnerOptions,
        gridClassName: 'md:col-span-2 xl:col-span-3',
        activateOnClick: !locked,
        showEditTrigger: !locked,
        onSave: async (next) => {
          const id = (next ?? '').trim()
          if (!id.length) {
            flash(t('insurance_desk.policies.form.errors.partner', 'Referring party is required.'), 'error')
            throw new Error('validation')
          }
          const merged = { ...(formRef.current ?? {}), referringPartnerEntityId: id }
          setForm(merged)
          await persistLead(merged)
        },
      },
    ]
  }, [
    form,
    inquiryStatus,
    leadStatusEntries,
    leadId,
    linkedPolicyId,
    partnerOptions,
    persistLead,
    retryLastMutation,
    runMutation,
    t,
  ])

  const notesFields = React.useMemo((): DetailFieldConfig[] => {
    if (!form) return []
    const empty = t('insurance_desk.detail.emptyField', '—')
    const locked = Boolean(linkedPolicyId)
    return [
      {
        kind: 'multiline',
        key: 'notes',
        label: t('insurance_desk.leads.form.notes', 'Notes'),
        value: typeof form.notes === 'string' ? form.notes : '',
        emptyLabel: empty,
        placeholder: t('insurance_desk.leads.form.notes', 'Notes'),
        gridClassName: 'md:col-span-2 xl:col-span-3',
        activateOnClick: !locked,
        showEditTrigger: !locked,
        onSave: async (next) => {
          const notes = typeof next === 'string' ? next : ''
          const merged = { ...(formRef.current ?? {}), notes }
          setForm(merged)
          await persistLead(merged)
        },
      },
    ]
  }, [form, linkedPolicyId, persistLead, t])

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
          <ErrorMessage label={loadError ?? t('insurance_desk.leads.detail.notFound', 'Inquiry not found.')} />
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

  const readOnly = Boolean(linkedPolicyId)

  return (
    <Page>
      <PageBody className="space-y-8">
        <FormHeader
          mode="detail"
          backHref={`${INSURANCE_DESK_BASE}/leads`}
          entityTypeLabel={t('insurance_desk.leads.detail.entityLabel', 'Inquiry')}
          title={recordTitle}
          utilityActions={
            canCreatePolicy && !linkedPolicyId ? (
              <Button type="button" variant="outline" asChild>
                <Link
                  href={`${INSURANCE_DESK_BASE}/policies/create?leadId=${encodeURIComponent(leadId)}`}
                  className="inline-flex items-center gap-2"
                >
                  <BadgeCheck className="size-4 shrink-0" aria-hidden />
                  {t('insurance_desk.leads.generatePolicy', 'Generate policy')}
                </Link>
              </Button>
            ) : null
          }
        />

        <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">{t('insurance_desk.leads.form.groups.basics', 'Basics')}</h2>
              <DetailFieldsSection fields={basicsFields} />
            </div>

            <LeadVisualSectionCard
              title={t('insurance_desk.leads.form.groups.contact', 'Contact details')}
              editing={editingSection === 'contact'}
              onBeginEdit={() => beginSectionEdit('contact')}
              onCancelEdit={cancelSectionEdit}
              onSaveEdit={saveSectionEdit}
              saving={sectionSaving}
              readOnly={readOnly}
              preview={<LeadContactPreview leadContact={form.leadContact} t={t} />}
              editContent={<LeadContactHolderField {...makeLeadDetailFieldProps(form, setForm, 'leadContact')} />}
            />

            <LeadVisualSectionCard
              title={t('insurance_desk.leads.form.groups.usage', 'Vehicle use')}
              editing={editingSection === 'usage'}
              onBeginEdit={() => beginSectionEdit('usage')}
              onCancelEdit={cancelSectionEdit}
              onSaveEdit={saveSectionEdit}
              saving={sectionSaving}
              readOnly={readOnly}
              preview={<LeadUsagePreviewLines leadUsage={form.leadUsage} t={t} />}
              editContent={<LeadUsageField {...makeLeadDetailFieldProps(form, setForm, 'leadUsage')} />}
            />

            <LeadVisualSectionCard
              title={t('insurance_desk.leads.form.groups.coverageScope', 'Coverage scope')}
              editing={editingSection === 'coverages'}
              onBeginEdit={() => beginSectionEdit('coverages')}
              onCancelEdit={cancelSectionEdit}
              onSaveEdit={saveSectionEdit}
              saving={sectionSaving}
              readOnly={readOnly}
              preview={
                <LeadCoveragesCatalogPreview
                  coverages={form.coverages}
                  coverageSubSelections={subs}
                  coverageDetailValues={det}
                />
              }
              editContent={
                <LeadCoverageCatalogField
                  {...makeLeadDetailFieldProps(form, setForm, 'coverages')}
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
              readOnly={readOnly}
              preview={
                <LeadCoverageOptionsPreviewLines
                  coverageOptions={form.coverageOptions}
                  leadUsage={form.leadUsage}
                  coverages={form.coverages}
                  t={t}
                />
              }
              editContent={
                <PolicyCoverageOptionsField {...makeLeadDetailFieldProps(form, setForm, 'coverageOptions')} />
              }
            />
          </div>

          <div className="space-y-6">
            <LeadVisualSectionCard
              title={t('insurance_desk.policies.form.subject.title', 'Subject of insurance')}
              description={t(
                'insurance_desk.leads.form.vehicleIntro',
                'Vehicle data describes the inquiry subject. It is not a registered resource in the system (external lead).',
              )}
              editing={editingSection === 'vehicle'}
              onBeginEdit={() => beginSectionEdit('vehicle')}
              onCancelEdit={cancelSectionEdit}
              onSaveEdit={saveSectionEdit}
              saving={sectionSaving}
              readOnly={readOnly}
              preview={<LeadVehiclePreview leadVehicle={form.leadVehicle} t={t} />}
              editContent={
                <LeadInquiryVehicleField {...makeLeadDetailFieldProps(form, setForm, 'leadVehicle')} />
              }
            />

            {linkedPolicyId ? <LinkedPolicyPreviewCard policyId={linkedPolicyId} /> : null}

            <div className="space-y-3">
              <h2 className="text-sm font-semibold">{t('insurance_desk.leads.form.groups.notes', 'Notes')}</h2>
              <DetailFieldsSection fields={notesFields} />
            </div>

            <LeadVisualSectionCard
              title={t('attachments.library.title', 'Attachments')}
              description={t(
                'insurance_desk.leads.attachments.detailHint',
                'Files stored in the platform attachment library for this inquiry.',
              )}
              editing={editingSection === 'attachments'}
              onBeginEdit={() => beginSectionEdit('attachments')}
              onCancelEdit={cancelSectionEdit}
              onSaveEdit={saveSectionEdit}
              saving={sectionSaving}
              readOnly={readOnly}
              preview={
                <AttachmentItemsPreview entityId={INSURANCE_LEAD_ATTACHMENT_ENTITY_ID} recordId={leadId} />
              }
              editContent={<LeadAttachmentsPanel leadId={leadId} canUpload={!readOnly} embedded />}
            />
          </div>
        </div>
      </PageBody>
    </Page>
  )
}
