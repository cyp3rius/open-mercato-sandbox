"use client"

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ApplyBreadcrumb } from '@open-mercato/ui/backend/AppShell'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { LoadingMessage, ErrorMessage } from '@open-mercato/ui/backend/detail'
import { Button } from '@open-mercato/ui/primitives/button'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { ArrowRightLeft } from 'lucide-react'
import { DealForm, type DealFormSubmitPayload } from '../../../../components/detail/DealForm'
import { useCurrencyDictionary } from '../../../../components/detail/hooks/useCurrencyDictionary'
import { buildSimpleQuoteCreateFromDealHref } from '../../../../components/detail/customerEntityCreatePrefill'

const BASE_PATH = '/backend/customers/simple-deals'

type DealDetailPayload = {
  deal: {
    id: string
    title: string
    description: string | null
    status: string | null
    pipelineStage: string | null
    pipelineId: string | null
    pipelineStageId: string | null
    valueAmount: string | null
    valueCurrency: string | null
    probability: number | null
    expectedCloseAt: string | null
    ownerUserId?: string | null
    payload?: Record<string, unknown> | null
  }
  people: Array<{ id: string }>
  companies: Array<{ id: string }>
  customFields: Record<string, unknown>
}

export default function SimpleDealDetailPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const id = typeof params?.id === 'string' ? params.id : ''
  const scopeVersion = useOrganizationScopeVersion()
  useCurrencyDictionary()
  const [data, setData] = React.useState<DealDetailPayload | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [formKey, setFormKey] = React.useState(0)

  const load = React.useCallback(async () => {
    if (!id) {
      setError(t('customers.simpleDeals.errors.notFound', 'Deal not found.'))
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await readApiResultOrThrow<DealDetailPayload>(
        `/api/customers/deals/${encodeURIComponent(id)}`,
        undefined,
        { errorMessage: t('customers.simpleDeals.errors.loadOne', 'Failed to load deal.') },
      )
      setData(result)
    } catch (err) {
      console.error('simple.deal.load failed', err)
      setData(null)
      setError(
        err instanceof Error && err.message
          ? err.message
          : t('customers.simpleDeals.errors.loadOne', 'Failed to load deal.'),
      )
    } finally {
      setLoading(false)
    }
  }, [id, t])

  React.useEffect(() => {
    void load()
  }, [load, scopeVersion])

  const linkedQuoteId =
    data?.deal.payload && typeof data.deal.payload.simpleQuoteId === 'string'
      ? data.deal.payload.simpleQuoteId
      : null

  const quoteCreateHref = React.useMemo(() => {
    if (!data?.deal.id) return null
    return buildSimpleQuoteCreateFromDealHref(data.deal.id)
  }, [data?.deal.id])

  const handleSubmit = React.useCallback(
    async ({ base, custom }: DealFormSubmitPayload) => {
      if (!id || saving) return
      setSaving(true)
      try {
        const payload: Record<string, unknown> = {
          id,
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
          personIds: Array.isArray(base.personIds) ? base.personIds : [],
          companyIds: Array.isArray(base.companyIds) ? base.companyIds : [],
        }
        if (Object.keys(custom).length) payload.customFields = custom
        await updateCrud('customers/deals', payload, {
          errorMessage: t('customers.simpleDeals.errors.save', 'Failed to save deal.'),
        })
        flash(t('customers.simpleDeals.success.save', 'Deal saved.'), 'success')
        setFormKey((key) => key + 1)
        void load()
      } catch (err) {
        flash(
          err instanceof Error
            ? err.message
            : t('customers.simpleDeals.errors.save', 'Failed to save deal.'),
          'error',
        )
        throw err instanceof Error ? err : new Error(String(err))
      } finally {
        setSaving(false)
      }
    },
    [id, load, saving, t],
  )

  const handleConvert = React.useCallback(() => {
    if (!quoteCreateHref) return
    if (!data?.people.length && !data?.companies.length) {
      flash(
        t(
          'customers.simpleDeals.errors.customerRequired',
          'Link a person or company on the deal before converting to a quote.',
        ),
        'error',
      )
      return
    }
    router.push(quoteCreateHref)
  }, [data?.companies.length, data?.people.length, quoteCreateHref, router, t])

  if (loading) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage label={t('customers.simpleDeals.loading', 'Loading…')} />
        </PageBody>
      </Page>
    )
  }

  if (error || !data) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage
            label={error ?? t('customers.simpleDeals.errors.notFound', 'Deal not found.')}
            action={(
              <Button asChild type="button" variant="outline">
                <Link href={BASE_PATH}>{t('customers.simpleDeals.list.title', 'Deals')}</Link>
              </Button>
            )}
          />
        </PageBody>
      </Page>
    )
  }

  return (
    <>
      <ApplyBreadcrumb
        title={data.deal.title}
        breadcrumb={[
          { label: t('customers.simpleDeals.list.title', 'Deals'), href: BASE_PATH },
          { label: data.deal.title },
        ]}
      />
      <Page>
        <PageBody>
          <DealForm
            key={formKey}
            mode="edit"
            initialValues={{
              id: data.deal.id,
              title: data.deal.title,
              description: data.deal.description ?? '',
              status: data.deal.status ?? undefined,
              pipelineStage: data.deal.pipelineStage ?? undefined,
              pipelineId: data.deal.pipelineId ?? undefined,
              pipelineStageId: data.deal.pipelineStageId ?? undefined,
              valueAmount: data.deal.valueAmount ? Number(data.deal.valueAmount) : undefined,
              valueCurrency: data.deal.valueCurrency ?? undefined,
              probability: data.deal.probability ?? undefined,
              expectedCloseAt: data.deal.expectedCloseAt ?? undefined,
              personIds: data.people.map((person) => person.id),
              companyIds: data.companies.map((company) => company.id),
              ownerUserId: data.deal.ownerUserId ?? '',
              customFields: data.customFields,
            }}
            onSubmit={handleSubmit}
            onCancel={() => router.push(BASE_PATH)}
            isSubmitting={saving}
            submitLabel={t('customers.simpleDeals.actions.save', 'Save')}
            embedded={false}
            title={data.deal.title}
            backHref={BASE_PATH}
            cancelHref={BASE_PATH}
            extraActions={(
              <>
                {linkedQuoteId ? (
                  <Button asChild type="button" variant="outline">
                    <Link href={`/backend/sales/simple-quotes/${encodeURIComponent(linkedQuoteId)}`}>
                      {t('customers.simpleDeals.actions.openQuote', 'Open quote')}
                    </Link>
                  </Button>
                ) : quoteCreateHref && (data.people.length > 0 || data.companies.length > 0) ? (
                  <Button asChild type="button" variant="outline" disabled={saving}>
                    <Link href={quoteCreateHref}>
                      <ArrowRightLeft className="mr-2 h-4 w-4" aria-hidden />
                      {t('customers.simpleDeals.actions.convertToQuote', 'Convert to quote')}
                    </Link>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving || !quoteCreateHref}
                    onClick={handleConvert}
                  >
                    <ArrowRightLeft className="mr-2 h-4 w-4" aria-hidden />
                    {t('customers.simpleDeals.actions.convertToQuote', 'Convert to quote')}
                  </Button>
                )}
              </>
            )}
          />
        </PageBody>
      </Page>
    </>
  )
}
