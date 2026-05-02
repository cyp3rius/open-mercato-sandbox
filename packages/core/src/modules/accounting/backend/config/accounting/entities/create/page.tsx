'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { CompanyRegistrySyncToolbarButton } from '@open-mercato/core/modules/customers/components/companyRegistrySync'
import {
  formatMfRegistryAddressBlock,
  type MfRegistryCompanyData,
} from '@open-mercato/core/modules/customers/lib/mfVatRegistry'
import {
  bankAccountsToPayload,
  buildSellingEntityFormFields,
  buildSellingEntityFormGroups,
  defaultSellingEntityInitialValues,
  type SellingEntityFormValues,
} from '../../../../../components/sellingEntityFormConfig'

export default function CreateSellingEntityPage() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { organizationId, tenantId } = useOrganizationScopeDetail()
  const sellingEntitySyncApplyRef = React.useRef<((patch: Record<string, unknown>) => void) | null>(null)

  const fields = React.useMemo(
    () => buildSellingEntityFormFields(t, { registrySyncApplyRef: sellingEntitySyncApplyRef }),
    [t],
  )
  const groups = React.useMemo(
    () => buildSellingEntityFormGroups(t, { includeRegistrySyncBridge: true }),
    [t],
  )

  const applyMfRegistryToSellingEntityForm = React.useCallback((data: MfRegistryCompanyData) => {
    const patch: Record<string, unknown> = {
      name: (data.legalName || data.displayName || '').trim(),
    }
    if (data.nip) patch.nip = data.nip
    if (data.regon) patch.regon = data.regon
    patch.address = formatMfRegistryAddressBlock(data)
    sellingEntitySyncApplyRef.current?.(patch)
  }, [])

  const prefillInitialValues = React.useMemo((): SellingEntityFormValues => {
    const base = defaultSellingEntityInitialValues()
    const name = searchParams.get('prefillName')
    if (name) base.name = name
    const nip = searchParams.get('prefillNip')
    if (nip) base.nip = nip
    const regon = searchParams.get('prefillRegon')
    if (regon) base.regon = regon
    const address = searchParams.get('prefillAddress')
    if (address) base.address = address
    return base
  }, [searchParams])

  return (
    <Page>
      <PageBody>
        <CrudForm<SellingEntityFormValues>
          title={t('accounting.settings.entities.create.title', 'Add selling company')}
          backHref="/backend/config/accounting/entities"
          cancelHref="/backend/config/accounting/entities"
          submitLabel={t('accounting.settings.entities.form.submit', 'Save')}
          fields={fields}
          groups={groups}
          initialValues={prefillInitialValues}
          extraActions={<CompanyRegistrySyncToolbarButton onSuccess={applyMfRegistryToSellingEntityForm} />}
          onSubmit={async (values) => {
            const call = await createCrud<{ id?: string }>(
              'accounting/selling-entities',
              {
                name: String(values.name ?? '').trim(),
                nip: String(values.nip ?? '').trim() || null,
                regon: String(values.regon ?? '').trim() || null,
                address: String(values.address ?? '').trim() || null,
                bankAccounts: bankAccountsToPayload(values.bankAccounts ?? []),
                invoiceNumberingMode: values.invoiceNumberingMode,
                invoiceNumberingCustom: String(values.invoiceNumberingCustom ?? '').trim() || null,
                organizationId,
                tenantId,
              },
              { errorMessage: t('accounting.settings.entities.form.saveError', 'Could not save company.') },
            )
            const newId = typeof call.result?.id === 'string' ? call.result.id : ''
            if (!newId) throw new Error(t('accounting.settings.entities.form.missingId', 'No id returned.'))
            flash(t('accounting.settings.entities.flash.created', 'Company saved.'), 'success')
            router.push(`/backend/config/accounting/entities/${encodeURIComponent(newId)}`)
          }}
        />
      </PageBody>
    </Page>
  )
}
