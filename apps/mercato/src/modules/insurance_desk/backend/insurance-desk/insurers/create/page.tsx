"use client"

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { createCrudFormError } from '@open-mercato/ui/backend/utils/serverErrors'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { INSURANCE_DESK_BASE } from '../../paths'
import {
  InsurerContactDraftTiles,
  type InsurerContactDraft,
} from '../../../../components/insurers/InsurerContactDraftTiles'
import { joinFullName } from '../../../../lib/insurerContactName'

function duplicateInsurerCode(base: string): string {
  const suffix = '-copy'
  const max = 100
  const trimmed = base.trim()
  if (trimmed.length + suffix.length <= max) return `${trimmed}${suffix}`
  return `${trimmed.slice(0, max - suffix.length)}${suffix}`
}

function trimToNull(value: string): string | null {
  const s = value.trim()
  return s.length ? s : null
}

function isValidEmail(value: string): boolean {
  const s = value.trim()
  if (!s.length) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

export default function InsuranceInsurerCreatePage() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const duplicateFromId = searchParams.get('duplicateFrom')

  const fields = React.useMemo<CrudField[]>(
    () => [
      {
        id: 'code',
        label: t('insurance_desk.insurers.form.code', 'Code'),
        type: 'text',
        required: true,
        layout: 'half',
      },
      {
        id: 'name',
        label: t('insurance_desk.insurers.form.name', 'Name'),
        type: 'text',
        required: true,
        layout: 'half',
      },
      {
        id: 'description',
        label: t('insurance_desk.insurers.form.description', 'Description'),
        type: 'textarea',
        layout: 'full',
      },
      {
        id: 'insurerContacts',
        label: t('insurance_desk.insurers.contacts.title', 'Contacts'),
        type: 'custom',
        layout: 'full',
        component: InsurerContactDraftTiles,
      },
    ],
    [t],
  )

  const groups = React.useMemo<CrudFormGroup[]>(
    () => [
      {
        id: 'basics',
        title: t('insurance_desk.insurers.form.group.basics', 'Basics'),
        column: 1,
        fields: ['code', 'name'],
      },
      {
        id: 'details',
        title: t('insurance_desk.insurers.form.group.details', 'Details'),
        column: 1,
        fields: ['description'],
      },
      {
        id: 'contacts',
        title: t('insurance_desk.insurers.contacts.title', 'Contacts'),
        column: 2,
        fields: ['insurerContacts'],
      },
    ],
    [t],
  )

  const emptyValues = React.useMemo(
    () => ({
      code: '',
      name: '',
      description: '',
      insurerContacts: [] as InsurerContactDraft[],
    }),
    [],
  )

  const [initialValues, setInitialValues] = React.useState(emptyValues)
  const [formKey, setFormKey] = React.useState(0)

  React.useEffect(() => {
    const fromId = duplicateFromId?.trim()
    if (!fromId) {
      setInitialValues(emptyValues)
      setFormKey((k) => k + 1)
      return
    }
    let cancelled = false
    async function loadDup() {
      const id = fromId
      if (!id) return
      const call = await apiCall<{
        items?: Array<{ code: string; name: string; description: string | null }>
      }>(`/api/insurance/insurers?id=${encodeURIComponent(id)}&page=1&pageSize=1`)
      const row = call.result?.items?.[0]
      if (cancelled || !row) return
      setInitialValues({
        code: duplicateInsurerCode(row.code),
        name: row.name,
        description: row.description ?? '',
        insurerContacts: [],
      })
      setFormKey((k) => k + 1)
    }
    void loadDup()
    return () => {
      cancelled = true
    }
  }, [duplicateFromId, emptyValues])

  const onSubmit = React.useCallback(
    async (values: Record<string, unknown>) => {
      const code = typeof values.code === 'string' ? values.code.trim() : ''
      const name = typeof values.name === 'string' ? values.name.trim() : ''
      if (!code.length) {
        throw createCrudFormError(t('insurance_desk.insurers.form.errors.code', 'Code is required.'), {
          code: t('insurance_desk.insurers.form.errors.code', 'Code is required.'),
        })
      }
      if (!name.length) {
        throw createCrudFormError(t('insurance_desk.insurers.form.errors.name', 'Name is required.'), {
          name: t('insurance_desk.insurers.form.errors.name', 'Name is required.'),
        })
      }
      const description =
        typeof values.description === 'string' && values.description.trim().length
          ? values.description.trim()
          : null
      const rawContacts = values.insurerContacts
      const contactRows = Array.isArray(rawContacts) ? (rawContacts as InsurerContactDraft[]) : []
      for (const c of contactRows) {
        if (!isValidEmail(c.email ?? '')) {
          throw createCrudFormError(t('insurance_desk.insurers.contacts.errors.email', 'Invalid e-mail.'), {
            insurerContacts: t('insurance_desk.insurers.contacts.errors.email', 'Invalid e-mail.'),
          })
        }
      }

      const created = await createCrud<{ id?: string }>('insurance/insurers', {
        code,
        name,
        description,
        isActive: true,
      })
      const newId =
        created.result && typeof created.result === 'object' && created.result !== null && 'id' in created.result
          ? String((created.result as { id: unknown }).id).trim()
          : ''

      if (newId.length) {
        let contactFailures = 0
        for (const c of contactRows) {
          const fullName = joinFullName(c.firstName ?? '', c.lastName ?? '')
          if (!fullName.length) continue
          const email = trimToNull(c.email ?? '')
          const phone = trimToNull(c.phone ?? '')
          const role = trimToNull(c.role ?? '')
          try {
            await createCrud(
              'insurance/insurer-contacts',
              {
                insurerId: newId,
                fullName,
                email,
                phone,
                role,
                isActive: true,
              },
              { errorMessage: t('insurance_desk.insurers.contacts.errors.save', 'Could not save contact.') },
            )
          } catch {
            contactFailures += 1
          }
        }
        if (contactFailures > 0) {
          flash(
            t(
              'insurance_desk.insurers.create.contactPartialFlash',
              'Insurer saved; some contacts could not be added.',
            ),
            'error',
          )
        } else {
          flash(t('ui.forms.flash.saveSuccess', 'Saved successfully.'), 'success')
        }
        router.push(`${INSURANCE_DESK_BASE}/insurers/${encodeURIComponent(newId)}`)
        return
      }
      router.push(`${INSURANCE_DESK_BASE}/insurers`)
    },
    [router, t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm
          key={formKey}
          title={t('insurance_desk.insurers.create.detailTitle', 'New insurer')}
          backHref={`${INSURANCE_DESK_BASE}/insurers`}
          cancelHref={`${INSURANCE_DESK_BASE}/insurers`}
          submitLabel={t('common.save', 'Save')}
          fields={fields}
          groups={groups}
          initialValues={initialValues}
          onSubmit={onSubmit}
        />
      </PageBody>
    </Page>
  )
}
