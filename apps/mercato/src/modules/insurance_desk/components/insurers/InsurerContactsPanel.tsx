"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { createCrud, deleteCrud, updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { Button } from '@open-mercato/ui/primitives/button'
import { CRUD_FORM_TEXT_INPUT_CLASS } from '@open-mercato/ui/backend/CrudForm'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { joinFullName, splitFullName } from '../../lib/insurerContactName'

type ContactRow = {
  id: string
  insurerId: string
  fullName: string
  email: string | null
  phone: string | null
  role: string | null
}

type ListResponse = { items?: ContactRow[] }

type Draft = {
  firstName: string
  lastName: string
  phone: string
  email: string
  role: string
}

const emptyDraft = (): Draft => ({
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  role: '',
})

function trimToNull(value: string): string | null {
  const t = value.trim()
  return t.length ? t : null
}

function isValidEmail(value: string): boolean {
  const t = value.trim()
  if (!t.length) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)
}

export type InsurerContactsPanelProps = {
  insurerId: string
}

export function InsurerContactsPanel(props: InsurerContactsPanelProps) {
  const { insurerId } = props
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()

  const [canView, setCanView] = React.useState(false)
  const [canManage, setCanManage] = React.useState(false)
  const [rows, setRows] = React.useState<ContactRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [reloadToken, setReloadToken] = React.useState(0)

  const [editingId, setEditingId] = React.useState<string | 'new' | null>(null)
  const [draft, setDraft] = React.useState<Draft>(emptyDraft)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    async function loadPerm() {
      const [viewCall, manageCall] = await Promise.all([
        apiCall<{ ok?: boolean }>('/api/auth/feature-check', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ features: ['insurance.insurer_contacts.view'] }),
        }),
        apiCall<{ ok?: boolean }>('/api/auth/feature-check', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ features: ['insurance.insurer_contacts.manage'] }),
        }),
      ])
      if (cancelled) return
      setCanView(viewCall.result?.ok === true)
      setCanManage(manageCall.result?.ok === true)
    }
    void loadPerm()
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if ((!canView && !canManage) || !insurerId.trim().length) {
      setRows([])
      setLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const call = await apiCall<ListResponse>(
          `/api/insurance/insurer-contacts?insurerId=${encodeURIComponent(insurerId.trim())}&page=1&pageSize=100`,
        )
        if (cancelled) return
        if (!call.ok || !call.result?.items) {
          setRows([])
          return
        }
        setRows(Array.isArray(call.result.items) ? call.result.items : [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [canManage, canView, insurerId, scopeVersion, reloadToken])

  const cancelEdit = React.useCallback(() => {
    setEditingId(null)
    setDraft(emptyDraft())
  }, [])

  const startEdit = React.useCallback((row: ContactRow) => {
    const { firstName, lastName } = splitFullName(row.fullName)
    setEditingId(row.id)
    setDraft({
      firstName,
      lastName,
      phone: row.phone ?? '',
      email: row.email ?? '',
      role: row.role ?? '',
    })
  }, [])

  const startNew = React.useCallback(() => {
    setEditingId('new')
    setDraft(emptyDraft())
  }, [])

  const bumpReload = React.useCallback(() => {
    setReloadToken((n) => n + 1)
  }, [])

  const save = React.useCallback(async () => {
    const fullName = joinFullName(draft.firstName, draft.lastName)
    if (!fullName.length) {
      flash(t('insurance_desk.insurers.contacts.errors.name', 'Enter first or last name.'), 'error')
      return
    }
    if (!isValidEmail(draft.email)) {
      flash(t('insurance_desk.insurers.contacts.errors.email', 'Invalid e-mail.'), 'error')
      return
    }
    const email = trimToNull(draft.email)
    const phone = trimToNull(draft.phone)
    const role = trimToNull(draft.role)
    setSaving(true)
    try {
      if (editingId === 'new') {
        await createCrud(
          'insurance/insurer-contacts',
          {
            insurerId: insurerId.trim(),
            fullName,
            email,
            phone,
            role,
            isActive: true,
          },
          { errorMessage: t('insurance_desk.insurers.contacts.errors.save', 'Could not save contact.') },
        )
        flash(t('insurance_desk.insurers.contacts.createdFlash', 'Contact added.'), 'success')
      } else if (editingId) {
        await updateCrud(
          'insurance/insurer-contacts',
          {
            id: editingId,
            fullName,
            email,
            phone,
            role,
          },
          { errorMessage: t('insurance_desk.insurers.contacts.errors.save', 'Could not save contact.') },
        )
        flash(t('insurance_desk.insurers.contacts.updatedFlash', 'Contact saved.'), 'success')
      }
      cancelEdit()
      bumpReload()
    } finally {
      setSaving(false)
    }
  }, [bumpReload, cancelEdit, draft, editingId, insurerId, t])

  const remove = React.useCallback(
    async (row: ContactRow) => {
      const ok = await confirm({
        title: t('common.delete', 'Delete'),
        text: row.fullName,
        variant: 'destructive',
      })
      if (!ok) return
      await deleteCrud('insurance/insurer-contacts', row.id, {
        errorMessage: t('insurance_desk.insurers.contacts.errors.delete', 'Could not delete contact.'),
      })
      flash(t('insurance_desk.insurers.contacts.deletedFlash', 'Contact removed.'), 'success')
      if (editingId === row.id) cancelEdit()
      bumpReload()
    },
    [bumpReload, cancelEdit, confirm, editingId, t],
  )

  if (!canView && !canManage) {
    return null
  }

  return (
    <section className="mt-10 space-y-4 border-t pt-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">
          {t('insurance_desk.insurers.contacts.title', 'Contacts')}
        </h2>
        {canManage && editingId === null ? (
          <Button type="button" variant="secondary" size="sm" onClick={startNew}>
            {t('insurance_desk.insurers.contacts.add', 'Add contact')}
          </Button>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">
        {t(
          'insurance_desk.insurers.contacts.hint',
          'Contacts are used when assigning policies to this insurer. At least first or last name is required.',
        )}
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading…')}</p>
      ) : rows.length === 0 && editingId !== 'new' ? (
        <p className="text-sm text-muted-foreground">
          {t('insurance_desk.insurers.contacts.empty', 'No contacts yet.')}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium">
                {t('insurance_desk.insurers.contacts.col.firstName', 'First name')}
              </th>
              <th className="px-3 py-2 text-left font-medium">
                {t('insurance_desk.insurers.contacts.col.lastName', 'Last name')}
              </th>
              <th className="px-3 py-2 text-left font-medium">
                {t('insurance_desk.insurers.contacts.col.phone', 'Phone')}
              </th>
              <th className="px-3 py-2 text-left font-medium">
                {t('insurance_desk.insurers.contacts.col.email', 'E-mail')}
              </th>
              <th className="px-3 py-2 text-left font-medium">
                {t('insurance_desk.insurers.contacts.col.role', 'Position')}
              </th>
              {canManage ? (
                <th className="px-3 py-2 text-right font-medium">
                  {t('insurance_desk.insurers.contacts.col.actions', 'Actions')}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isEditing = editingId === row.id
              if (isEditing) {
                return (
                  <tr key={row.id} className="border-b align-top">
                    <td className="px-3 py-2">
                      <input
                        className={CRUD_FORM_TEXT_INPUT_CLASS}
                        value={draft.firstName}
                        onChange={(e) => setDraft((d) => ({ ...d, firstName: e.target.value }))}
                        disabled={saving}
                        data-crud-focus-target=""
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className={CRUD_FORM_TEXT_INPUT_CLASS}
                        value={draft.lastName}
                        onChange={(e) => setDraft((d) => ({ ...d, lastName: e.target.value }))}
                        disabled={saving}
                        data-crud-focus-target=""
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className={CRUD_FORM_TEXT_INPUT_CLASS}
                        value={draft.phone}
                        onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                        disabled={saving}
                        data-crud-focus-target=""
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className={CRUD_FORM_TEXT_INPUT_CLASS}
                        type="email"
                        value={draft.email}
                        onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                        disabled={saving}
                        data-crud-focus-target=""
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className={CRUD_FORM_TEXT_INPUT_CLASS}
                        value={draft.role}
                        onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
                        disabled={saving}
                        data-crud-focus-target=""
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button type="button" size="sm" onClick={save} disabled={saving}>
                          {t('common.save', 'Save')}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={cancelEdit} disabled={saving}>
                          {t('ui.forms.actions.cancel', 'Cancel')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              }
              const { firstName, lastName } = splitFullName(row.fullName)
              return (
                <tr key={row.id} className="border-b align-top">
                  <td className="px-3 py-2">{firstName || '—'}</td>
                  <td className="px-3 py-2">{lastName || '—'}</td>
                  <td className="px-3 py-2">{row.phone?.trim().length ? row.phone : '—'}</td>
                  <td className="px-3 py-2 break-all">{row.email?.trim().length ? row.email : '—'}</td>
                  <td className="px-3 py-2">{row.role?.trim().length ? row.role : '—'}</td>
                  {canManage ? (
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(row)}
                          disabled={editingId !== null}
                        >
                          {t('common.edit', 'Edit')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => void remove(row)}
                          disabled={editingId !== null}
                        >
                          {t('common.delete', 'Delete')}
                        </Button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              )
            })}
            {editingId === 'new' ? (
              <tr className="border-b align-top">
                <td className="px-3 py-2">
                  <input
                    className={CRUD_FORM_TEXT_INPUT_CLASS}
                    value={draft.firstName}
                    onChange={(e) => setDraft((d) => ({ ...d, firstName: e.target.value }))}
                    disabled={saving}
                    data-crud-focus-target=""
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    className={CRUD_FORM_TEXT_INPUT_CLASS}
                    value={draft.lastName}
                    onChange={(e) => setDraft((d) => ({ ...d, lastName: e.target.value }))}
                    disabled={saving}
                    data-crud-focus-target=""
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    className={CRUD_FORM_TEXT_INPUT_CLASS}
                    value={draft.phone}
                    onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                    disabled={saving}
                    data-crud-focus-target=""
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    className={CRUD_FORM_TEXT_INPUT_CLASS}
                    type="email"
                    value={draft.email}
                    onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                    disabled={saving}
                    data-crud-focus-target=""
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    className={CRUD_FORM_TEXT_INPUT_CLASS}
                    value={draft.role}
                    onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
                    disabled={saving}
                    data-crud-focus-target=""
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
                      {t('common.save', 'Save')}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={cancelEdit} disabled={saving}>
                      {t('ui.forms.actions.cancel', 'Cancel')}
                    </Button>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {ConfirmDialogElement}
    </section>
  )
}
