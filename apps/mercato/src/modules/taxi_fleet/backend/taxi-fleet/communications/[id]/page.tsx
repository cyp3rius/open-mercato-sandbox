'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { FormHeader } from '@open-mercato/ui/backend/forms'
import { LoadingMessage, ErrorMessage } from '@open-mercato/ui/backend/detail'
import { Button } from '@open-mercato/ui/primitives/button'
import { Badge } from '@open-mercato/ui/primitives/badge'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { ApplyBreadcrumb } from '@open-mercato/ui/backend/AppShell'
import { useFleetDriverDirectory } from '../../../../components/useFleetDriverDirectory'
import { TAXI_FLEET_BASE } from '../../paths'

type Communication = {
  id: string
  kind: string
  title: string
  body: string
  status: string
  scheduledAt?: string | null
  sentAt?: string | null
  createdAt?: string | null
}

type Recipient = {
  id: string
  teamMemberId: string
  deliveryStatus: string
  readAt: string | null
  lastError: string | null
  attemptCount: number
}

export default function DriverCommunicationDetailPage({
  params,
}: {
  params?: { id?: string }
}) {
  const t = useT()
  const router = useRouter()
  const id = params?.id ?? ''
  const scopeVersion = useOrganizationScopeVersion()
  const { resolveName } = useFleetDriverDirectory()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [row, setRow] = React.useState<Communication | null>(null)
  const [recipients, setRecipients] = React.useState<Recipient[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadToken, setReloadToken] = React.useState(0)
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    if (!id) {
      setError(t('taxi_fleet.communications.detail.notFound', 'Communication not found.'))
      setRow(null)
      setRecipients([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const [listCall, recipientsCall] = await Promise.all([
        apiCall<{ items?: Communication[] }>(
          `/api/taxi_fleet/driver-communications?ids=${encodeURIComponent(id)}&page=1&pageSize=1`,
        ),
        apiCall<{ items?: Recipient[] }>(
          `/api/taxi_fleet/driver-communications/${encodeURIComponent(id)}/recipients`,
        ),
      ])
      const item = Array.isArray(listCall.result?.items) ? listCall.result.items[0] : null
      if (!item) {
        setError(t('taxi_fleet.communications.detail.notFound', 'Communication not found.'))
        setRow(null)
        setRecipients([])
        return
      }
      setRow(item)
      setRecipients(Array.isArray(recipientsCall.result?.items) ? recipientsCall.result.items : [])
    } catch {
      setError(t('taxi_fleet.communications.detail.loadFailed', 'Could not load communication.'))
      setRow(null)
      setRecipients([])
    } finally {
      setIsLoading(false)
    }
  }, [id, t])

  React.useEffect(() => {
    void load()
  }, [load, reloadToken, scopeVersion])

  async function runAction(path: string, successKey: string, successFallback: string) {
    if (!id) return
    setBusy(true)
    try {
      const call = await apiCall(path, { method: 'POST' })
      if (!call.ok) {
        flash(t('taxi_fleet.errors.generic', 'Operation failed.'), 'error')
        return
      }
      flash(t(successKey, successFallback), 'success')
      setReloadToken((token) => token + 1)
    } finally {
      setBusy(false)
    }
  }

  if (isLoading) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage
            label={t('taxi_fleet.communications.detail.loading', 'Loading communication…')}
          />
        </PageBody>
      </Page>
    )
  }

  if (error || !row) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage
            label={error ?? t('taxi_fleet.communications.detail.notFound', 'Not found')}
          />
          <p className="mt-4 text-sm">
            <Link href={`${TAXI_FLEET_BASE}/communications`} className="text-primary hover:underline">
              {t('taxi_fleet.communications.detail.backToList', 'Back to communications')}
            </Link>
          </p>
        </PageBody>
        {ConfirmDialogElement}
      </Page>
    )
  }

  const canSend = row.status === 'draft' || row.status === 'scheduled' || row.status === 'partial'
  const canCancel = row.status === 'draft' || row.status === 'scheduled'

  return (
    <>
      <ApplyBreadcrumb
        breadcrumb={[
          { label: 'Dashboard', labelKey: 'taxi_fleet.hub.dashboardTitle', href: TAXI_FLEET_BASE },
          {
            label: 'Communications',
            labelKey: 'taxi_fleet.communications.title',
            href: `${TAXI_FLEET_BASE}/communications`,
          },
          { label: row.title },
        ]}
        title={row.title}
      />
      <Page>
        <PageBody>
          <FormHeader
            mode="detail"
            backHref={`${TAXI_FLEET_BASE}/communications`}
            backLabel={t('taxi_fleet.communications.detail.backToList', 'Back to communications')}
            entityTypeLabel={t('taxi_fleet.communications.detail.title', 'Communication')}
            title={row.title}
          />

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[7fr_3fr] lg:items-start">
            <div className="min-w-0 space-y-4">
              <section className="rounded-lg border bg-card px-4 py-3 space-y-3">
                <h2 className="text-sm font-semibold">
                  {t('taxi_fleet.communications.detail.message', 'Message')}
                </h2>
                <p className="whitespace-pre-wrap text-sm text-foreground">{row.body}</p>
              </section>

              <section className="rounded-lg border bg-card px-4 py-3 space-y-3">
                <h2 className="text-sm font-semibold">
                  {t('taxi_fleet.communications.detail.recipients', 'Recipients')}
                </h2>
                <div className="divide-y rounded-md border">
                  {recipients.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">
                      {t('taxi_fleet.communications.detail.noRecipients', 'No recipients.')}
                    </div>
                  ) : (
                    recipients.map((recipient) => (
                      <div
                        key={recipient.id}
                        className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="font-medium">
                            {resolveName(recipient.teamMemberId) || recipient.teamMemberId}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {t(
                              `taxi_fleet.communications.delivery.${recipient.deliveryStatus}`,
                              recipient.deliveryStatus,
                            )}
                            {recipient.attemptCount > 0
                              ? ` · ${t(
                                  'taxi_fleet.communications.detail.attempts',
                                  '{count} attempts',
                                  { count: recipient.attemptCount },
                                )}`
                              : ''}
                            {recipient.readAt
                              ? ` · ${t('taxi_fleet.communications.detail.readAt', 'Read')} ${new Date(recipient.readAt).toLocaleString()}`
                              : ''}
                            {recipient.lastError ? ` · ${recipient.lastError}` : ''}
                          </div>
                        </div>
                        {recipient.deliveryStatus === 'failed' ||
                        recipient.deliveryStatus === 'pending' ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              void runAction(
                                `/api/taxi_fleet/driver-communications/${encodeURIComponent(row.id)}/recipients/${encodeURIComponent(recipient.id)}/retry`,
                                'taxi_fleet.communications.detail.retrySuccess',
                                'Retry queued.',
                              )
                            }
                          >
                            {t('taxi_fleet.communications.detail.retry', 'Retry')}
                          </Button>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>

            <div className="min-w-0 space-y-3">
              <section className="rounded-lg border bg-card px-4 py-3 space-y-3">
                <h2 className="text-sm font-semibold">
                  {t('taxi_fleet.communications.detail.overview', 'Overview')}
                </h2>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {t(`taxi_fleet.communications.kind.${row.kind}`, row.kind)}
                  </Badge>
                  <Badge variant="outline">
                    {t(`taxi_fleet.communications.status.${row.status}`, row.status)}
                  </Badge>
                </div>
                <dl className="space-y-2 text-sm">
                  {row.createdAt ? (
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        {t('taxi_fleet.communications.detail.createdAt', 'Created')}
                      </dt>
                      <dd>{new Date(row.createdAt).toLocaleString()}</dd>
                    </div>
                  ) : null}
                  {row.scheduledAt ? (
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        {t('taxi_fleet.communications.detail.scheduledAt', 'Scheduled')}
                      </dt>
                      <dd>{new Date(row.scheduledAt).toLocaleString()}</dd>
                    </div>
                  ) : null}
                  {row.sentAt ? (
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        {t('taxi_fleet.communications.detail.sentAt', 'Sent')}
                      </dt>
                      <dd>{new Date(row.sentAt).toLocaleString()}</dd>
                    </div>
                  ) : null}
                </dl>
              </section>

              {(canSend || canCancel) && (
                <section className="rounded-lg border bg-card px-4 py-3 space-y-2">
                  <h2 className="text-sm font-semibold">
                    {t('taxi_fleet.communications.detail.actions', 'Actions')}
                  </h2>
                  <div className="flex flex-col gap-2">
                    {canSend ? (
                      <Button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void runAction(
                            `/api/taxi_fleet/driver-communications/${encodeURIComponent(row.id)}/send`,
                            row.status === 'partial'
                              ? 'taxi_fleet.communications.detail.retryAllSuccess'
                              : 'taxi_fleet.communications.detail.sendSuccess',
                            row.status === 'partial'
                              ? 'Retry queued for failed recipients.'
                              : 'Message sent.',
                          )
                        }
                      >
                        {row.status === 'partial'
                          ? t('taxi_fleet.communications.detail.retryAll', 'Retry failed')
                          : t('taxi_fleet.communications.detail.sendNow', 'Send now')}
                      </Button>
                    ) : null}
                    {canCancel ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={async () => {
                          const ok = await confirm({
                            text: t(
                              'taxi_fleet.communications.detail.cancelConfirm',
                              'Cancel this communication?',
                            ),
                            confirmText: t('common.confirm', 'Confirm'),
                          })
                          if (!ok) return
                          await runAction(
                            `/api/taxi_fleet/driver-communications/${encodeURIComponent(row.id)}/cancel`,
                            'taxi_fleet.communications.detail.cancelSuccess',
                            'Cancelled.',
                          )
                        }}
                      >
                        {t('taxi_fleet.communications.detail.cancel', 'Cancel')}
                      </Button>
                    ) : null}
                  </div>
                </section>
              )}
            </div>
          </div>
        </PageBody>
        {ConfirmDialogElement}
      </Page>
    </>
  )
}
