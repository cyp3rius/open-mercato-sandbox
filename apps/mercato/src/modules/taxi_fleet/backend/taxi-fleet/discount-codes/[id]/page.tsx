'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@open-mercato/ui/primitives/button'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { LoadingMessage, ErrorMessage } from '@open-mercato/ui/backend/detail'
import { ApplyBreadcrumb } from '@open-mercato/ui/backend/AppShell'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { updateCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeDetail, useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { parseNumericValue } from '@open-mercato/shared/lib/numeric'
import {
  buildDiscountCodeFormFields,
  buildDiscountCodeFormGroups,
  mapDiscountCodeRowToFormValues,
  type DiscountCodeFormValues,
} from '../../../../components/discountCodeFormConfig'
import { TAXI_FLEET_BASE } from '../../paths'

type DiscountCodeDetail = {
  id: string
  code: string
  label?: string | null
  discountType: 'percent' | 'amount'
  value: string
  usageLimit?: string | null
  usedAmount?: string | null
  active: boolean
}

export default function DiscountCodeDetailPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const id = params?.id ?? ''
  const scopeVersion = useOrganizationScopeVersion()
  const { organizationId, tenantId } = useOrganizationScopeDetail()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [row, setRow] = React.useState<DiscountCodeDetail | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [formKey, setFormKey] = React.useState(0)

  const fields = React.useMemo(() => buildDiscountCodeFormFields(t, { includeUsedAmount: true }), [t])
  const groups = React.useMemo(() => buildDiscountCodeFormGroups(t), [t])

  const load = React.useCallback(async () => {
    if (!id) {
      setError(t('taxi_fleet.discount_codes.detail.notFound', 'Discount code not found.'))
      setRow(null)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    const call = await apiCall<DiscountCodeDetail>(`/api/taxi_fleet/discount-codes/${encodeURIComponent(id)}`)
    if (!call.ok || !call.result?.id) {
      setError(t('taxi_fleet.discount_codes.detail.notFound', 'Discount code not found.'))
      setRow(null)
      setIsLoading(false)
      return
    }
    setRow(call.result)
    setIsLoading(false)
  }, [id, t])

  React.useEffect(() => {
    void load()
  }, [load, scopeVersion])

  const initialValues = React.useMemo((): DiscountCodeFormValues => {
    if (!row) {
      return mapDiscountCodeRowToFormValues({
        code: '',
        discountType: 'percent',
        value: '0',
        active: true,
      })
    }
    return mapDiscountCodeRowToFormValues(row)
  }, [row])

  const breadcrumbTitle = row?.code ?? ''

  if (isLoading) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage label={t('taxi_fleet.discount_codes.detail.loading', 'Loading discount code…')} />
        </PageBody>
      </Page>
    )
  }

  if (error || !row) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage
            label={error ?? t('taxi_fleet.discount_codes.detail.notFound', 'Discount code not found.')}
            action={
              <Button asChild variant="outline" size="sm" type="button">
                <Link href={`${TAXI_FLEET_BASE}/discount-codes`}>
                  {t('taxi_fleet.discount_codes.detail.backToList', 'Back to discount codes')}
                </Link>
              </Button>
            }
          />
        </PageBody>
      </Page>
    )
  }

  return (
    <>
      <ApplyBreadcrumb
        breadcrumb={[
          { label: 'Dashboard', labelKey: 'taxi_fleet.hub.dashboardTitle', href: '/backend/taxi-fleet' },
          {
            label: 'Discount codes',
            labelKey: 'taxi_fleet.discount_codes.title',
            href: `${TAXI_FLEET_BASE}/discount-codes`,
          },
          { label: breadcrumbTitle },
        ]}
        title={breadcrumbTitle}
      />
      <Page>
        <PageBody>
          <CrudForm<DiscountCodeFormValues>
            key={formKey}
            title={t('taxi_fleet.discount_codes.detail.title', 'Discount code')}
            backHref={`${TAXI_FLEET_BASE}/discount-codes`}
            cancelHref={`${TAXI_FLEET_BASE}/discount-codes`}
            submitLabel={t('taxi_fleet.discount_codes.detail.save', 'Save changes')}
            fields={fields}
            groups={groups}
            initialValues={initialValues}
            onDelete={async () => {
              const ok = await confirm({
                text: t('taxi_fleet.discount_codes.detail.deleteConfirm', 'Delete this discount code?'),
                confirmText: t('common.delete', 'Delete'),
                variant: 'destructive',
              })
              if (!ok) return
              await deleteCrud('taxi_fleet/discount-codes', row.id)
              flash(t('taxi_fleet.discount_codes.detail.deleted', 'Discount code deleted.'), 'success')
              router.push(`${TAXI_FLEET_BASE}/discount-codes`)
            }}
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
              const usedAmount =
                values.discountType === 'amount' ? parseNumericValue(values.usedAmount) ?? 0 : undefined

              await updateCrud(
                `taxi_fleet/discount-codes/${encodeURIComponent(row.id)}`,
                {
                  id: row.id,
                  organizationId,
                  tenantId,
                  code: values.code.trim(),
                  label: values.label.trim() || null,
                  discountType: values.discountType,
                  value,
                  usageLimit,
                  ...(usedAmount != null ? { usedAmount } : {}),
                  active: values.active,
                },
                { errorMessage: t('taxi_fleet.errors.generic', 'Operation failed.') },
              )
              flash(t('taxi_fleet.discount_codes.detail.saved', 'Changes saved.'), 'success')
              setFormKey((key) => key + 1)
              void load()
            }}
          />
        </PageBody>
        {ConfirmDialogElement}
      </Page>
    </>
  )
}
