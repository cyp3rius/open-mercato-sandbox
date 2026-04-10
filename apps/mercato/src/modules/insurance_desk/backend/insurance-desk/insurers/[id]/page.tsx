"use client"

import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { FormHeader } from '@open-mercato/ui/backend/forms/FormHeader'
import { DetailFieldsSection, type DetailFieldConfig, ErrorMessage, LoadingMessage } from '@open-mercato/ui/backend/detail'
import { updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { INSURANCE_DESK_BASE } from '../../paths'
import { InsurerContactsPanel } from '../../../../components/insurers/InsurerContactsPanel'

type InsurerApiRow = {
  id: string
  code: string
  name: string
  description: string | null
  isActive: boolean
}

type ListResponse = { items?: InsurerApiRow[] }

export default function InsuranceInsurerDetailPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const insurerId = typeof params?.id === 'string' ? params.id : ''

  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [record, setRecord] = React.useState<InsurerApiRow | null>(null)
  const [loading, setLoading] = React.useState(true)

  const mutationContextId = React.useMemo(
    () => (insurerId ? `insurance-insurer:${insurerId}` : 'insurance-insurer:pending'),
    [insurerId],
  )
  const { runMutation, retryLastMutation } = useGuardedMutation({
    contextId: mutationContextId,
    blockedMessage: t('ui.forms.flash.saveBlocked', 'Save blocked by validation'),
  })

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      if (!insurerId) {
        setLoadError(t('insurance_desk.insurers.edit.missingId', 'Missing insurer id.'))
        setLoading(false)
        return
      }
      setLoading(true)
      setLoadError(null)
      try {
        const call = await apiCall<ListResponse>(
          `/api/insurance/insurers?id=${encodeURIComponent(insurerId)}&page=1&pageSize=1`,
        )
        if (cancelled) return
        const row = call.result?.items?.[0]
        if (!call.ok || !row) {
          setLoadError(t('insurance_desk.insurers.edit.notFound', 'Insurer not found.'))
          setRecord(null)
          return
        }
        setRecord(row)
      } catch (e: unknown) {
        setLoadError(e instanceof Error ? e.message : String(e))
        setRecord(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [insurerId, t])

  const persist = React.useCallback(
    async (body: { code?: string; name?: string; description?: string | null; isActive?: boolean }) => {
      await runMutation({
        operation: () =>
          updateCrud('insurance/insurers', { id: insurerId, ...body }, {
            errorMessage: t('insurance_desk.insurers.edit.saveError', 'Could not save insurer.'),
          }),
        context: {
          resourceKind: 'insurance.insurer',
          resourceId: insurerId,
          retryLastMutation,
        },
      })
      setRecord((prev) => (prev ? { ...prev, ...body } : prev))
      flash(t('insurance_desk.insurers.edit.savedFlash', 'Insurer saved.'), 'success')
    },
    [insurerId, retryLastMutation, runMutation, t],
  )

  const detailFields = React.useMemo((): DetailFieldConfig[] => {
    if (!record) return []
    const empty = t('insurance_desk.detail.emptyField', '—')
    return [
      {
        kind: 'text',
        key: 'code',
        label: t('insurance_desk.insurers.form.code', 'Code'),
        value: record.code,
        emptyLabel: empty,
        placeholder: t('insurance_desk.insurers.form.code', 'Code'),
        onSave: async (next) => {
          const code = (next ?? '').trim()
          if (!code.length) {
            flash(t('insurance_desk.insurers.form.errors.code', 'Code is required.'), 'error')
            throw new Error('validation')
          }
          await persist({ code })
        },
      },
      {
        kind: 'text',
        key: 'name',
        label: t('insurance_desk.insurers.form.name', 'Name'),
        value: record.name,
        emptyLabel: empty,
        placeholder: t('insurance_desk.insurers.form.name', 'Name'),
        onSave: async (next) => {
          const name = (next ?? '').trim()
          if (!name.length) {
            flash(t('insurance_desk.insurers.form.errors.name', 'Name is required.'), 'error')
            throw new Error('validation')
          }
          await persist({ name })
        },
      },
      {
        kind: 'select',
        key: 'isActive',
        label: t('insurance_desk.insurers.form.active', 'Active'),
        value: record.isActive ? 'true' : 'false',
        emptyLabel: empty,
        options: [
          { value: 'true', label: t('common.active', 'Active') },
          { value: 'false', label: t('common.inactive', 'Inactive') },
        ],
        onSave: async (next) => {
          await persist({ isActive: next === 'true' })
        },
      },
      {
        kind: 'multiline',
        key: 'description',
        label: t('insurance_desk.insurers.form.description', 'Description'),
        value: record.description,
        emptyLabel: empty,
        placeholder: t('insurance_desk.insurers.form.description', 'Description'),
        gridClassName: 'md:col-span-2 xl:col-span-3',
        onSave: async (next) => {
          const description =
            typeof next === 'string' && next.trim().length ? next.trim() : null
          await persist({ description })
        },
      },
    ]
  }, [persist, record, t])

  if (loading) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage label={t('common.loading', 'Loading…')} />
        </PageBody>
      </Page>
    )
  }

  if (loadError || !record) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage label={loadError ?? t('insurance_desk.insurers.edit.notFound', 'Insurer not found.')} />
        </PageBody>
      </Page>
    )
  }

  return (
    <Page>
      <PageBody className="space-y-8">
        <FormHeader
          mode="detail"
          backHref={`${INSURANCE_DESK_BASE}/insurers`}
          entityTypeLabel={t('insurance_desk.insurers.detail.entityLabel', 'Insurer')}
          title={record.name.trim().length ? record.name : record.code}
          subtitle={
            record.name.trim().length && record.code.trim().length
              ? `${record.code} · ${record.isActive ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}`
              : undefined
          }
        />

        <div className="space-y-3">
          <h2 className="text-sm font-semibold">
            {t('insurance_desk.insurers.form.group.details', 'Details')}
          </h2>
          <DetailFieldsSection fields={detailFields} />
        </div>

        <InsurerContactsPanel insurerId={insurerId} />
      </PageBody>
    </Page>
  )
}
