'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LoadingMessage } from '@open-mercato/ui/backend/detail'
import { ApplyBreadcrumb } from '@open-mercato/ui/backend/AppShell'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { deleteCrud, updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import {
  playbookFormSchema,
  buildPlaybookFormFields,
  buildPlaybookFormGroups,
  parsePlaybookBooleanField,
  rowToPlaybookFormValues,
  type PlaybookFormValues,
} from '../../../components/playbookFormConfig'
import { PlaybookFormTabProvider } from '../../../components/PlaybookFormTabContext'

type Row = {
  id: string
  slug: string
  title: string
  body: string
  contextTags?: string[]
  context_tags?: string[]
  procedureDefinition?: unknown
  procedure_definition?: unknown
  audience?: string
  version?: number
  isActive?: boolean
  is_active?: boolean
}

function truncatePlaybookBreadcrumbTitle(name: string, maxLen = 36): string {
  const s = name.trim()
  const base = s.length ? s : '—'
  if (base.length <= maxLen) return base
  return `${base.slice(0, maxLen)}…`
}

function normalizePlaybookRow(raw: Record<string, unknown> | null | undefined): Row | null {
  if (!raw || typeof raw !== 'object') return null
  const id = typeof raw.id === 'string' ? raw.id : ''
  if (!id) return null
  const tagSource = raw.contextTags ?? raw.context_tags
  const contextTags = Array.isArray(tagSource) ? tagSource.map((x) => String(x)).filter(Boolean) : undefined
  return {
    id,
    slug: String(raw.slug ?? ''),
    title: String(raw.title ?? ''),
    body: String(raw.body ?? ''),
    contextTags,
    procedure_definition: raw.procedure_definition ?? raw.procedureDefinition,
    audience: typeof raw.audience === 'string' ? raw.audience : undefined,
    version: typeof raw.version === 'number' ? raw.version : undefined,
    isActive: parsePlaybookBooleanField(raw.isActive, raw.is_active),
  }
}

export default function PlaybookDetailPage({ params }: { params?: { id?: string } }) {
  const id = params?.id
  const t = useT()
  const router = useRouter()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [row, setRow] = React.useState<Row | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [formKey, setFormKey] = React.useState(0)
  const [canEdit, setCanEdit] = React.useState(false)
  const [canDelete, setCanDelete] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    async function perm() {
      const call = await apiCall<{ granted?: string[]; ok?: boolean }>('/api/auth/feature-check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ features: ['playbooks.edit', 'playbooks.delete'] }),
      })
      if (cancelled) return
      const granted = Array.isArray(call.result?.granted) ? call.result.granted : []
      setCanEdit(granted.includes('playbooks.edit'))
      setCanDelete(granted.includes('playbooks.delete'))
    }
    void perm()
    return () => {
      cancelled = true
    }
  }, [])

  const load = React.useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    const call = await apiCall<{ items?: Record<string, unknown>[] }>(
      `/api/playbooks?ids=${encodeURIComponent(id)}&pageSize=1`,
    )
    if (!call.ok) {
      setError(t('playbooks.detail.notFound', 'Playbook not found.'))
      setRow(null)
      setLoading(false)
      return
    }
    const items = Array.isArray(call.result?.items) ? call.result.items : []
    const item = normalizePlaybookRow(items[0] as Record<string, unknown>)
    setRow(item)
    if (!item) setError(t('playbooks.detail.notFound', 'Playbook not found.'))
    setLoading(false)
  }, [id, t])

  React.useEffect(() => {
    void load()
  }, [load])

  const schema = React.useMemo(() => playbookFormSchema(), [])
  const fields = React.useMemo(() => buildPlaybookFormFields(t), [t])
  const groups = React.useMemo(() => buildPlaybookFormGroups(t), [t])

  const playbookDetailBreadcrumb = React.useMemo(() => {
    const label = row?.title ?? ''
    return [
      { label: 'Playbooks', labelKey: 'playbooks.list.title', href: '/backend/playbooks' },
      { label: truncatePlaybookBreadcrumbTitle(label) },
    ]
  }, [row?.title])

  const initialValues = React.useMemo((): PlaybookFormValues => {
    if (!row) {
      return rowToPlaybookFormValues({
        slug: '',
        title: '',
        body: '',
        contextTags: [],
        audience: 'internal',
        version: 0,
        isActive: true,
      })
    }
    return rowToPlaybookFormValues(row)
  }, [row])

  const handleDelete = React.useCallback(async () => {
    if (!row) return
    const ok = await confirm({
      title: t('playbooks.list.deleteTitle', 'Delete playbook?'),
      text: t('playbooks.list.deleteMessage', 'This will soft-delete the playbook.'),
      confirmText: t('common.delete', 'Delete'),
      variant: 'destructive',
    })
    if (!ok) return
    await deleteCrud('playbooks', row.id, {
      errorMessage: t('playbooks.list.errors.delete', 'Could not delete playbook.'),
    })
    flash(t('playbooks.list.deleted', 'Playbook deleted.'), 'success')
    router.push('/backend/playbooks')
  }, [confirm, row, router, t])

  if (!id) return null

  if (loading) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage label={t('playbooks.detail.loading', 'Loading…')} />
        </PageBody>
        {ConfirmDialogElement}
      </Page>
    )
  }

  const isArchived = row != null && row.isActive === false

  if (error || !row) {
    return (
      <Page>
        <PageBody>
          <p className="text-destructive text-sm">{error ?? t('playbooks.detail.notFound', 'Playbook not found.')}</p>
          <Button type="button" variant="outline" className="mt-4" asChild>
            <Link href="/backend/playbooks">{t('playbooks.list.title', 'Playbooks')}</Link>
          </Button>
        </PageBody>
        {ConfirmDialogElement}
      </Page>
    )
  }

  return (
    <>
      <ApplyBreadcrumb breadcrumb={playbookDetailBreadcrumb} title={truncatePlaybookBreadcrumbTitle(row.title)} />
      <Page>
        <PageBody>
          {isArchived ? (
            <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
              {t(
                'playbooks.detail.archivedVersionHint',
                'You are viewing an inactive version. Cases that started on this version keep it; new cases use the current active version.',
              )}
            </div>
          ) : null}
          <PlaybookFormTabProvider>
          <CrudForm<PlaybookFormValues>
            key={formKey}
            title={row.title}
            entityTypeLabel={t('playbooks.detail.title', 'Playbook')}
            backHref="/backend/playbooks"
            submitLabel={t('common.save', 'Save')}
            schema={schema}
            fields={fields}
            groups={groups}
            initialValues={initialValues}
            readOnly={!canEdit || isArchived}
            onDelete={canDelete ? handleDelete : undefined}
            onSubmit={async (values) => {
              if (!canEdit || isArchived) return
              const slug = values.slug.trim().toLowerCase()
              const tags = Array.isArray(values.contextTags)
                ? values.contextTags.map((x) => String(x).trim()).filter(Boolean)
                : []
              const resp = await updateCrud<{ ok?: boolean; playbookId?: string }>(
                'playbooks',
                {
                  id: row.id,
                  slug,
                  title: values.title.trim(),
                  body: values.body,
                  contextTags: tags,
                  procedureDefinition: Array.isArray(values.procedureDefinition) ? values.procedureDefinition : [],
                  audience: values.audience,
                  isActive: values.isActive,
                },
                { errorMessage: t('playbooks.detail.saveError', 'Could not save.') },
              )
              const nextId =
                resp.ok && typeof resp.result?.playbookId === 'string' ? resp.result.playbookId.trim() : ''
              if (nextId.length && nextId !== row.id) {
                flash(t('playbooks.detail.newVersionSaved', 'Saved as a new version. You are now editing the latest revision.'), 'success')
                router.replace(`/backend/playbooks/${encodeURIComponent(nextId)}`)
                return
              }
              flash(t('playbooks.detail.saved', 'Saved.'), 'success')
              setFormKey((k) => k + 1)
              void load()
            }}
          />
          </PlaybookFormTabProvider>
        </PageBody>
        {ConfirmDialogElement}
      </Page>
    </>
  )
}
