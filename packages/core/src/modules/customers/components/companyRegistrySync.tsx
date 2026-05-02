'use client'

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import {
  createCrudFormApplyPatchBridgeField,
  PolVatRegistrySyncToolbarButton,
  type PolVatRegistrySyncLabels,
} from '@open-mercato/ui/backend/inputs'
import type { MfRegistryCompanyData } from '../lib/mfVatRegistry'

type RegistryLookupResponse = { ok: true; data: MfRegistryCompanyData | null }

function usePolVatRegistrySyncLabelsFromCustomersModule(): PolVatRegistrySyncLabels {
  const t = useT()
  return React.useMemo(
    () => ({
      title: t('customers.companies.form.registrySync.title', 'Synchronize company data'),
      description: t(
        'customers.companies.form.registrySync.description',
        'Data is retrieved from the Polish Ministry of Finance VAT whitelist (public API, daily limits apply).',
      ),
      nip: t('customers.companies.form.nip', 'NIP'),
      regon: t('customers.companies.form.regon', 'REGON'),
      nipPlaceholder: t('customers.companies.form.nipPlaceholder', '10-digit tax number'),
      regonPlaceholder: t('customers.companies.form.regonPlaceholder', '9 or 14 digits'),
      orRule: t('customers.companies.form.registrySync.orRule', '— or —'),
      cancel: t('customers.companies.form.registrySync.cancel', 'Cancel'),
      submit: t('customers.companies.form.registrySync.submit', 'Synchronize'),
      buttonLabel: t('customers.companies.form.registrySync.label', 'Synchronize data'),
      needIdentifier: t('customers.companies.form.registrySync.needIdentifier', 'Enter NIP or REGON.'),
      nipInvalid: t('customers.companies.form.nipInvalid', 'Invalid NIP.'),
      regonInvalid: t('customers.companies.form.regonInvalid', 'Invalid REGON.'),
      notFound: t(
        'customers.companies.form.registrySync.notFound',
        'No company found for this identifier in the VAT whitelist.',
      ),
      requestError: t(
        'customers.companies.form.registrySync.requestError',
        'Could not fetch data from the registry.',
      ),
    }),
    [t],
  )
}

export function createCompanyRegistrySyncBridgeField(
  applyRef: React.MutableRefObject<((patch: Record<string, unknown>) => void) | null>,
) {
  return createCrudFormApplyPatchBridgeField(applyRef, { fieldId: '__companyRegistrySyncBridge' })
}

export function CompanyRegistrySyncToolbarButton(props: {
  onSuccess: (data: MfRegistryCompanyData) => void | Promise<void>
}) {
  const { onSuccess } = props
  const t = useT()
  const labels = usePolVatRegistrySyncLabelsFromCustomersModule()

  const onLookup = React.useCallback(
    async (args: { nip: string | null; regon: string | null }) => {
      const payload: { nip?: string; regon?: string } = {}
      if (args.nip) payload.nip = args.nip
      else if (args.regon) payload.regon = args.regon
      const result = await readApiResultOrThrow<RegistryLookupResponse>(
        '/api/customers/companies/registry-lookup',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        },
        {
          errorMessage: t(
            'customers.companies.form.registrySync.requestError',
            'Could not fetch data from the registry.',
          ),
        },
      )
      return result.data
    },
    [t],
  )

  return <PolVatRegistrySyncToolbarButton labels={labels} onLookup={onLookup} onSuccess={onSuccess} />
}
