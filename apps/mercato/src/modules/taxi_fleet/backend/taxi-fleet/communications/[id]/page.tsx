"use client"

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { LoadingMessage, ErrorMessage } from '@open-mercato/ui/backend/detail'
import { Button } from '@open-mercato/ui/primitives/button'
import { Badge } from '@open-mercato/ui/primitives/badge'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
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
}

type Recipient = {
  id: string
  teamMemberId: string
  deliveryStatus: string
  readAt: string | null
  lastError: string | null
  attemptCount: number
}

export default function DriverCommunicationDetailPage() {
  const t = useT()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id
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
    if (!id) return
    setIsLoading(true)
    setError(null)
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
      setIsLoading(false)
      return
    }
    setRow(item)
    setRecipients(Array.isArray(recipientsCall.result?.items) ? recipientsCall.result.items : [])
    setIsLoading(false)
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
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => router.push(`${TAXI_FLEET_BASE}/communications`)}
          >
            {t('common.back', 'Back')}
          </Button>
        </PageBody>
      </Page>
    )
  }

  const canSend = row.status === 'draft' || row.status === 'scheduled'
  const canCancel = row.status === 'draft' || row.status === 'scheduled'

  return (
    <Page>
      <PageBody className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">{row.title}</h1>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {t(`taxi_fleet.communications.kind.${row.kind}`, row.kind)}
              </Badge>
              <Badge variant="outline">
                {t(`taxi_fleet.communications.status.${row.status}`, row.status)}
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`${TAXI_FLEET_BASE}/communications`)}
            >
              {t('common.back', 'Back')}
            </Button>
            {canSend ? (
              <Button
                type="button"
                disabled={busy}
                onClick={() =>
                  void runAction(
                    `/api/taxi_fleet/driver-communications/${encodeURIComponent(row.id)}/send`,
                    'taxi_fleet.communications.detail.sendSuccess',
                    'Message sent.',
                  )
                }
              >
                {t('taxi_fleet.communications.detail.sendNow', 'Send now')}
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
        </div>

        <div className="rounded border p-4 space-y-2">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{row.body}</p>
          <div className="text-xs text-muted-foreground space-y-1">
            {row.scheduledAt ? (
              <div>
                {t('taxi_fleet.communications.detail.scheduledAt', 'Scheduled')}:{' '}
                {new Date(row.scheduledAt).toLocaleString()}
              </div>
            ) : null}
            {row.sentAt ? (
              <div>
                {t('taxi_fleet.communications.detail.sentAt', 'Sent')}:{' '}
                {new Date(row.sentAt).toLocaleString()}
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold">
            {t('taxi_fleet.communications.detail.recipients', 'Recipients')}
          </h2>
          <div className="rounded border divide-y">
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
                  <div>
                    <div className="font-medium">
                      {resolveName(recipient.teamMemberId) || recipient.teamMemberId}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t(
                        `taxi_fleet.communications.delivery.${recipient.deliveryStatus}`,
                        recipient.deliveryStatus,
                      )}
                      {recipient.readAt
                        ? ` · ${t('taxi_fleet.communications.detail.readAt', 'Read')} ${new Date(recipient.readAt).toLocaleString()}`
                        : ''}
                      {recipient.lastError ? ` · ${recipient.lastError}` : ''}
                    </div>
                  </div>
                  {recipient.deliveryStatus === 'failed' || recipient.deliveryStatus === 'pending' ? (
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
        </div>
      </PageBody>
      {ConfirmDialogElement}
    </Page>
  )
}
