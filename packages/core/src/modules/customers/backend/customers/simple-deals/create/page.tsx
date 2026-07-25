'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { DealForm, type DealFormSubmitPayload } from '../../../../components/detail/DealForm'
import { useCurrencyDictionary } from '../../../../components/detail/hooks/useCurrencyDictionary'
import { readPrefillUuid } from '../../../../components/detail/customerEntityCreatePrefill'

const BASE_PATH = '/backend/customers/simple-deals'

export default function CreateSimpleDealPage() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  useCurrencyDictionary()

  const initialValues = React.useMemo(() => {
    const personId = readPrefillUuid(searchParams.get('personId'))
    const companyId = readPrefillUuid(searchParams.get('companyId'))
    const ownerUserId = readPrefillUuid(searchParams.get('ownerUserId'))
    return {
      personIds: personId ? [personId] : [],
      companyIds: companyId ? [companyId] : [],
      ownerUserId,
    }
  }, [searchParams])

  const handleSubmit = React.useCallback(
    async ({ base, custom }: DealFormSubmitPayload) => {
      if (isSubmitting) return
      setIsSubmitting(true)
      try {
        const payload: Record<string, unknown> = {
          title: base.title,
          status: base.status ?? undefined,
          pipelineStage: base.pipelineStage ?? undefined,
          pipelineId: base.pipelineId ?? undefined,
          pipelineStageId: base.pipelineStageId ?? undefined,
          valueAmount: typeof base.valueAmount === 'number' ? base.valueAmount : undefined,
          valueCurrency: base.valueCurrency ?? undefined,
          probability: typeof base.probability === 'number' ? base.probability : undefined,
          expectedCloseAt: base.expectedCloseAt ?? undefined,
          description: base.description ?? undefined,
          ownerUserId: base.ownerUserId,
          personIds: Array.isArray(base.personIds) && base.personIds.length ? base.personIds : undefined,
          companyIds: Array.isArray(base.companyIds) && base.companyIds.length ? base.companyIds : undefined,
        }
        if (Object.keys(custom).length) payload.customFields = custom

        const created = await createCrud<{ id?: string }>('customers/deals', payload, {
          errorMessage: t('customers.simpleDeals.errors.create', 'Failed to create deal.'),
        })
        flash(t('customers.simpleDeals.success.create', 'Deal created.'), 'success')
        const id = created.result?.id
        router.push(id ? `${BASE_PATH}/${id}` : BASE_PATH)
      } catch (err) {
        flash(
          err instanceof Error
            ? err.message
            : t('customers.simpleDeals.errors.create', 'Failed to create deal.'),
          'error',
        )
        throw err instanceof Error ? err : new Error(String(err))
      } finally {
        setIsSubmitting(false)
      }
    },
    [isSubmitting, router, t],
  )

  return (
    <Page>
      <PageBody>
        <DealForm
          mode="create"
          initialValues={initialValues}
          onSubmit={handleSubmit}
          onCancel={() => router.push(BASE_PATH)}
          isSubmitting={isSubmitting}
          submitLabel={t('customers.simpleDeals.create.submit', 'Create deal')}
          embedded={false}
          title={t('customers.simpleDeals.create.title', 'Create deal')}
          backHref={BASE_PATH}
          cancelHref={BASE_PATH}
        />
      </PageBody>
    </Page>
  )
}
