"use client"

import * as React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { CrudCustomFieldRenderProps } from '@open-mercato/ui/backend/CrudForm'
import { Button } from '@open-mercato/ui/primitives/button'
import { Label } from '@open-mercato/ui/primitives/label'
import { cn } from '@open-mercato/shared/lib/utils'
import { CRUD_FORM_TEXT_INPUT_CLASS } from '@open-mercato/ui/backend/CrudForm'

export type InsurerContactDraft = {
  firstName: string
  lastName: string
  phone: string
  email: string
  role: string
}

function emptyContact(): InsurerContactDraft {
  return { firstName: '', lastName: '', phone: '', email: '', role: '' }
}

function normalize(raw: unknown): InsurerContactDraft[] {
  if (!Array.isArray(raw)) return []
  return raw.map((row) => {
    if (!row || typeof row !== 'object') return emptyContact()
    const o = row as Record<string, unknown>
    const str = (k: keyof InsurerContactDraft) => (typeof o[k] === 'string' ? o[k] : '')
    return {
      firstName: str('firstName'),
      lastName: str('lastName'),
      phone: str('phone'),
      email: str('email'),
      role: str('role'),
    }
  })
}

export function InsurerContactDraftTiles(props: CrudCustomFieldRenderProps) {
  const t = useT()
  const { value, setValue, disabled } = props
  const rows = normalize(value)

  const patch = React.useCallback(
    (next: InsurerContactDraft[]) => {
      setValue(next)
    },
    [setValue],
  )

  const updateRow = React.useCallback(
    (index: number, partial: Partial<InsurerContactDraft>) => {
      const next = [...rows]
      const cur = next[index] ?? emptyContact()
      next[index] = { ...cur, ...partial }
      patch(next)
    },
    [patch, rows],
  )

  const addRow = React.useCallback(() => {
    patch([...rows, emptyContact()])
  }, [patch, rows])

  const removeRow = React.useCallback(
    (index: number) => {
      patch(rows.filter((_, i) => i !== index))
    },
    [patch, rows],
  )

  return (
    <div className={cn('space-y-3', props.error && 'rounded-md border border-destructive/40 p-3')}>
      <p className="text-sm text-muted-foreground">
        {t(
          'insurance_desk.insurers.form.contactsIntro',
          'Add one or more contact persons for this insurer. They are saved after the insurer is created.',
        )}
      </p>
      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
          {t('insurance_desk.insurers.form.contactsEmpty', 'No contacts yet.')}
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row, index) => (
            <li key={index} className="rounded-lg border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {`${t('insurance_desk.insurers.form.contactLabel', 'Contact')} ${index + 1}`}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-destructive"
                  disabled={disabled}
                  onClick={() => removeRow(index)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">{t('insurance_desk.insurers.contacts.col.firstName', 'First name')}</Label>
                  <input
                    className={CRUD_FORM_TEXT_INPUT_CLASS}
                    value={row.firstName}
                    onChange={(e) => updateRow(index, { firstName: e.target.value })}
                    disabled={disabled}
                    data-crud-focus-target=""
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('insurance_desk.insurers.contacts.col.lastName', 'Last name')}</Label>
                  <input
                    className={CRUD_FORM_TEXT_INPUT_CLASS}
                    value={row.lastName}
                    onChange={(e) => updateRow(index, { lastName: e.target.value })}
                    disabled={disabled}
                    data-crud-focus-target=""
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('insurance_desk.insurers.contacts.col.email', 'E-mail')}</Label>
                  <input
                    className={CRUD_FORM_TEXT_INPUT_CLASS}
                    type="email"
                    value={row.email}
                    onChange={(e) => updateRow(index, { email: e.target.value })}
                    disabled={disabled}
                    data-crud-focus-target=""
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('insurance_desk.insurers.contacts.col.phone', 'Phone')}</Label>
                  <input
                    className={CRUD_FORM_TEXT_INPUT_CLASS}
                    value={row.phone}
                    onChange={(e) => updateRow(index, { phone: e.target.value })}
                    disabled={disabled}
                    data-crud-focus-target=""
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">{t('insurance_desk.insurers.contacts.col.role', 'Position')}</Label>
                  <input
                    className={CRUD_FORM_TEXT_INPUT_CLASS}
                    value={row.role}
                    onChange={(e) => updateRow(index, { role: e.target.value })}
                    disabled={disabled}
                    data-crud-focus-target=""
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={addRow}>
        <Plus className="size-4 mr-1" />
        {t('insurance_desk.insurers.contacts.add', 'Add contact')}
      </Button>
      {props.error ? <p className="text-sm text-destructive">{props.error}</p> : null}
    </div>
  )
}
