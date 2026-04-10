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
import { renderDictionaryIcon } from '@open-mercato/core/modules/dictionaries/components/dictionaryAppearance'
import type { InlineSelectOption } from '@open-mercato/ui/backend/detail'
import { EntitySearchCombobox } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import { INSURANCE_DESK_BASE } from '../../paths'
import { InsurerContactsPanel } from '../../../../components/insurers/InsurerContactsPanel'

type StatusDictEntry = { value: string; label: string; icon?: string; color?: string }

type InsurerApiRow = {
  id: string
  code: string
  name: string
  description: string | null
  status: string
  isActive: boolean
}

type ListResponse = { items?: InsurerApiRow[] }

export default function InsuranceInsurerDetailPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const insurerId = typeof params?.id === 'string' ? params.id : ''

  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [record, setRecord] = React.useState<InsurerApiRow | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [statusDict, setStatusDict] = React.useState<StatusDictEntry[]>([])

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

  React.useEffect(() => {
    let cancelled = false
    async function loadDict() {
      const call = await apiCall<{ entries?: StatusDictEntry[] }>('/api/insurance/config-insurer-status')
      if (cancelled) return
      setStatusDict(Array.isArray(call.result?.entries) ? call.result.entries : [])
    }
    void loadDict()
    return () => {
      cancelled = true
    }
  }, [])

  const persist = React.useCallback(
    async (body: { code?: string; name?: string; description?: string | null; status?: string }) => {
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
      setRecord((prev) => {
        if (!prev) return prev
        const merged = { ...prev, ...body }
        if (body.status !== undefined) {
          merged.isActive = body.status !== 'inactive'
        }
        return merged
      })
      flash(t('insurance_desk.insurers.edit.savedFlash', 'Insurer saved.'), 'success')
    },
    [insurerId, retryLastMutation, runMutation, t],
  )

  const insurerBasicsFields = React.useMemo((): DetailFieldConfig[] => {
    if (!record) return []
    const empty = t('insurance_desk.detail.emptyField', '—')
    const statusOptions: InlineSelectOption[] = statusDict.map((e) => ({
      value: e.value,
      label: e.label,
    }))
    const statusValue = record.status.trim()
    if (statusValue.length && !statusOptions.some((o) => o.value === statusValue)) {
      statusOptions.push({ value: statusValue, label: statusValue })
    }
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
        key: 'status',
        label: t('insurance_desk.insurers.form.status', 'Status'),
        value: statusValue,
        emptyLabel: empty,
        options: statusOptions,
        renderDisplay: ({ value: v, emptyLabel: el }) => {
          const raw = typeof v === 'string' ? v.trim() : ''
          if (!raw.length) {
            return <span className="text-muted-foreground">{el}</span>
          }
          const meta = statusDict.find((e) => e.value === raw)
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
        renderEditor: ({ value: draft, onChange }) => (
          <EntitySearchCombobox
            value={draft}
            onChange={onChange}
            options={statusDict.map((e) => ({
              value: e.value,
              label: e.label,
              icon: e.icon,
              color: e.color,
            }))}
            placeholder={empty}
          />
        ),
        onSave: async (next) => {
          const status = (next ?? '').trim()
          if (!status.length) {
            flash(t('insurance_desk.insurers.form.errors.status', 'Status is required.'), 'error')
            throw new Error('validation')
          }
          await persist({ status })
        },
      },
    ]
  }, [persist, record, statusDict, t])

  const insurerRemainderFields = React.useMemo((): DetailFieldConfig[] => {
    if (!record) return []
    const empty = t('insurance_desk.detail.emptyField', '—')
    return [
      {
        kind: 'multiline',
        key: 'description',
        label: t('insurance_desk.insurers.form.description', 'Description'),
        value: record.description,
        emptyLabel: empty,
        placeholder: t('insurance_desk.insurers.form.description', 'Description'),
        gridClassName: 'sm:col-span-2 md:col-span-3',
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
              ? (() => {
                  const st = record.status.trim()
                  const meta = statusDict.find((e) => e.value === st)
                  const statusLabel = meta?.label ?? st
                  return `${record.code} · ${statusLabel}`
                })()
              : undefined
          }
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[7fr_3fr] lg:items-start">
          <div className="min-w-0 space-y-6">
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">
                {t('insurance_desk.insurers.form.group.basics', 'Basics')}
              </h2>
              <DetailFieldsSection fields={insurerBasicsFields} />
            </div>
            <section className="space-y-3 rounded-lg border bg-card px-4 py-3">
              <InsurerContactsPanel insurerId={insurerId} />
            </section>
          </div>
          <div className="min-w-0 space-y-6">
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">
                {t('insurance_desk.insurers.form.group.remainder', 'Other')}
              </h2>
              <DetailFieldsSection fields={insurerRemainderFields} />
            </div>
          </div>
        </div>
      </PageBody>
    </Page>
  )
}
