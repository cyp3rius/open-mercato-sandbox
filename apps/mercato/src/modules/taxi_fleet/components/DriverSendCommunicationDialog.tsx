'use client'

import * as React from 'react'
import { z } from 'zod'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { CrudForm, type CrudField } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import {
  DRIVER_COMMUNICATION_BODY_MAX,
  DRIVER_COMMUNICATION_TITLE_MAX,
} from '../data/validators'
import {
  TaxiFleetDialogFrame,
  taxiFleetDialogCrudBodyClass,
  useTaxiFleetDialogShortcuts,
} from './TaxiFleetDialogShell'

type DriverSendCommunicationDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamMemberId: string
  driverDisplayName: string
  externalAppEnabled?: boolean
}

type FormValues = {
  kind: 'info' | 'service' | 'direct'
  title: string
  body: string
  deliveryMode: 'now' | 'schedule'
  scheduledAt?: string
}

function formSchema() {
  return z.object({
    kind: z.enum(['info', 'service', 'direct']),
    title: z.string().trim().min(1).max(DRIVER_COMMUNICATION_TITLE_MAX),
    body: z.string().trim().min(1).max(DRIVER_COMMUNICATION_BODY_MAX),
    deliveryMode: z.enum(['now', 'schedule']),
    scheduledAt: z.string().optional(),
  })
}

export function DriverSendCommunicationDialog({
  open,
  onOpenChange,
  teamMemberId,
  driverDisplayName,
  externalAppEnabled = true,
}: DriverSendCommunicationDialogProps) {
  const t = useT()
  const { organizationId, tenantId } = useOrganizationScopeDetail()
  const dialogContentRef = React.useRef<HTMLDivElement | null>(null)
  const [formKey, setFormKey] = React.useState(0)

  React.useEffect(() => {
    if (!open) return
    setFormKey((value) => value + 1)
  }, [open, teamMemberId])

  const handleCancel = React.useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const handleDialogKeyDown = useTaxiFleetDialogShortcuts({
    contentRef: dialogContentRef,
    onCancel: handleCancel,
    canSubmit: true,
  })

  const fields = React.useMemo((): CrudField[] => {
    return [
      {
        id: 'recipient',
        type: 'custom',
        label: t('taxi_fleet.communications.form.recipient', 'Recipient'),
        layout: 'full',
        component: () => (
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <div className="font-medium text-foreground">{driverDisplayName}</div>
            <p className="text-muted-foreground mt-1 text-xs">
              {t(
                'taxi_fleet.communications.form.pushHint',
                'Sent as a push notification to the driver app.',
              )}
            </p>
            {!externalAppEnabled ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                {t(
                  'taxi_fleet.communications.form.appDisabledWarning',
                  'This driver does not have the mobile app enabled — delivery may fail.',
                )}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'kind',
        label: t('taxi_fleet.communications.form.kind', 'Type'),
        type: 'select',
        required: true,
        options: [
          { value: 'direct', label: t('taxi_fleet.communications.kind.direct', 'Direct') },
          { value: 'info', label: t('taxi_fleet.communications.kind.info', 'Info') },
          { value: 'service', label: t('taxi_fleet.communications.kind.service', 'Service') },
        ],
      },
      {
        id: 'title',
        label: t('taxi_fleet.communications.form.title', 'Title'),
        type: 'text',
        required: true,
        description: t(
          'taxi_fleet.communications.form.titleHint',
          'Max {max} characters',
          { max: String(DRIVER_COMMUNICATION_TITLE_MAX) },
        ),
      },
      {
        id: 'body',
        label: t('taxi_fleet.communications.form.body', 'Message'),
        type: 'textarea',
        required: true,
        description: t(
          'taxi_fleet.communications.form.bodyHint',
          'Max {max} characters',
          { max: String(DRIVER_COMMUNICATION_BODY_MAX) },
        ),
      },
      {
        id: 'deliveryMode',
        label: t('taxi_fleet.communications.form.deliveryMode', 'Delivery'),
        type: 'select',
        required: true,
        options: [
          {
            value: 'now',
            label: t('taxi_fleet.communications.form.delivery.now', 'Send now'),
          },
          {
            value: 'schedule',
            label: t('taxi_fleet.communications.form.delivery.schedule', 'Schedule'),
          },
        ],
      },
      {
        id: 'scheduledAt',
        label: t('taxi_fleet.communications.form.scheduledAt', 'Schedule at'),
        type: 'datetime',
        visibleWhen: { field: 'deliveryMode', operator: 'eq', value: 'schedule' },
      },
    ]
  }, [driverDisplayName, externalAppEnabled, t])

  const handleSubmit = React.useCallback(
    async (values: FormValues) => {
      if (!tenantId || !organizationId) {
        throw new Error(t('taxi_fleet.errors.generic', 'Operation failed.'))
      }
      if (!teamMemberId.trim()) {
        throw new Error(
          t('taxi_fleet.communications.errors.recipientsRequired', 'Select at least one driver.'),
        )
      }
      const payload: Record<string, unknown> = {
        tenantId,
        organizationId,
        kind: values.kind,
        title: values.title.trim(),
        body: values.body.trim(),
        teamMemberIds: [teamMemberId],
      }
      if (values.deliveryMode === 'now') {
        payload.sendNow = true
      } else {
        if (!values.scheduledAt?.trim()) {
          throw new Error(
            t('taxi_fleet.communications.errors.scheduleRequired', 'Pick a schedule time.'),
          )
        }
        payload.scheduledAt = new Date(values.scheduledAt).toISOString()
      }
      await createCrud<{ id: string }>(
        'taxi_fleet/driver-communications',
        payload,
        {
          errorMessage: t(
            'taxi_fleet.communications.create.error',
            'Could not save communication.',
          ),
        },
      )
      flash(
        values.deliveryMode === 'now'
          ? t(
              'taxi_fleet.communications.sendToDriver.successNow',
              'Message sent to the driver as a push notification.',
            )
          : t(
              'taxi_fleet.communications.sendToDriver.successScheduled',
              'Message scheduled for the driver.',
            ),
        'success',
      )
      onOpenChange(false)
    },
    [onOpenChange, organizationId, t, teamMemberId, tenantId],
  )

  return (
    <TaxiFleetDialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title={t('taxi_fleet.communications.sendToDriver.title', 'Send message')}
      size="lg"
      contentRef={dialogContentRef}
      onKeyDown={handleDialogKeyDown}
    >
      <div className={taxiFleetDialogCrudBodyClass}>
        <CrudForm<FormValues>
          key={formKey}
          embedded
          fields={fields}
          schema={formSchema()}
          initialValues={{
            kind: 'direct',
            title: '',
            body: '',
            deliveryMode: 'now',
            scheduledAt: '',
          }}
          submitLabel={t(
            'taxi_fleet.communications.sendToDriver.submit',
            'Send (⌘/Ctrl + Enter)',
          )}
          onSubmit={handleSubmit}
        />
      </div>
    </TaxiFleetDialogFrame>
  )
}
