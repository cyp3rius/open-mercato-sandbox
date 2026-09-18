'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { parseNumericValue } from '@open-mercato/shared/lib/numeric'
import {
  buildDiscountCodeFormFields,
  buildDiscountCodeFormGroups,
  defaultDiscountCodeFormValues,
  type DiscountCodeFormValues,
} from '../../../../components/discountCodeFormConfig'
import { TAXI_FLEET_BASE } from '../../paths'

export default function CreateDiscountCodePage() {
  const t = useT()
  const router = useRouter()
  const { organizationId, tenantId } = useOrganizationScopeDetail()

  const fields = React.useMemo(() => buildDiscountCodeFormFields(t), [t])
  const groups = React.useMemo(() => buildDiscountCodeFormGroups(t), [t])

  return (
    <Page>
      <PageBody>
        <CrudForm<DiscountCodeFormValues>
          title={t('taxi_fleet.discount_codes.create.title', 'New discount code')}
          backHref={`${TAXI_FLEET_BASE}/discount-codes`}
          cancelHref={`${TAXI_FLEET_BASE}/discount-codes`}
          submitLabel={t('taxi_fleet.discount_codes.create.submit', 'Save')}
          fields={fields}
          groups={groups}
          initialValues={defaultDiscountCodeFormValues()}
          onSubmit={async (values) => {
            const value = parseNumericValue(values.value)
            if (value == null || value <= 0) {
              flash(t('taxi_fleet.discount_codes.form.errors.value', 'Enter a valid value.'), 'error')
              return
            }
            const usageLimitRaw = values.usageLimit.trim()
            const usageLimit =
              values.discountType === 'amount'
                ? parseNumericValue(usageLimitRaw)
                : null
            if (values.discountType === 'amount' && (usageLimit == null || usageLimit <= 0)) {
              flash(
                t('taxi_fleet.discount_codes.form.errors.usageLimit', 'Usage limit is required for amount codes.'),
                'error',
              )
              return
            }
            const call = await createCrud<{ id?: string }>('taxi_fleet/discount-codes', {
              tenantId,
              organizationId,
              code: values.code.trim(),
              label: values.label.trim() || null,
              discountType: values.discountType,
              value,
              usageLimit,
              active: values.active,
            })
            if (!call.ok || !call.result?.id) {
              flash(t('taxi_fleet.errors.generic', 'Operation failed.'), 'error')
              return
            }
            flash(t('taxi_fleet.discount_codes.create.success', 'Discount code created.'), 'success')
            router.replace(`${TAXI_FLEET_BASE}/discount-codes/${call.result.id}`)
          }}
        />
      </PageBody>
    </Page>
  )
}
