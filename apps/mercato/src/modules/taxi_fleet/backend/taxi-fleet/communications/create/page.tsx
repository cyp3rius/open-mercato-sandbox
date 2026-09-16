"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useFleetDriverDirectory } from '../../../../components/useFleetDriverDirectory'
import {
  DRIVER_COMMUNICATION_BODY_MAX,
  DRIVER_COMMUNICATION_TITLE_MAX,
} from '../../../../data/validators'
import { TAXI_FLEET_BASE } from '../../paths'

type FormValues = {
  kind: 'info' | 'service' | 'direct'
  title: string
  body: string
  teamMemberIds: string[]
  deliveryMode: 'now' | 'schedule' | 'draft'
  scheduledAt: string
}

export default function CreateDriverCommunicationPage() {
  const t = useT()
  const router = useRouter()
  const { organizationId, tenantId } = useOrganizationScopeDetail()
  const { profiles, resolveName } = useFleetDriverDirectory()

  const driverOptions = React.useMemo(
    () =>
      profiles
        .filter((profile) => profile.externalAppEnabled)
        .map((profile) => ({
          value: profile.teamMemberId,
          label: resolveName(profile.teamMemberId) || profile.teamMemberId,
        })),
    [profiles, resolveName],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm<FormValues>
          title={t('taxi_fleet.communications.create.title', 'New communication')}
          backHref={`${TAXI_FLEET_BASE}/communications`}
          cancelHref={`${TAXI_FLEET_BASE}/communications`}
          submitLabel={t('taxi_fleet.communications.create.submit', 'Save')}
          groups={[
            {
              id: 'basics',
              title: t('taxi_fleet.communications.form.groups.basics', 'Basics'),
              column: 1,
              fields: ['kind', 'title', 'body', 'teamMemberIds'],
            },
            {
              id: 'delivery',
              title: t('taxi_fleet.communications.form.groups.delivery', 'Delivery'),
              column: 2,
              fields: ['deliveryMode', 'scheduledAt'],
            },
          ]}
          fields={[
            {
              id: 'kind',
              label: t('taxi_fleet.communications.form.kind', 'Type'),
              type: 'select',
              required: true,
              options: [
                { value: 'info', label: t('taxi_fleet.communications.kind.info', 'Info') },
                { value: 'service', label: t('taxi_fleet.communications.kind.service', 'Service') },
                { value: 'direct', label: t('taxi_fleet.communications.kind.direct', 'Direct') },
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
              id: 'teamMemberIds',
              label: t('taxi_fleet.communications.form.recipients', 'Drivers'),
              type: 'select',
              multiple: true,
              listbox: true,
              required: true,
              options: driverOptions,
              description: t(
                'taxi_fleet.communications.form.recipientsHint',
                'Only drivers with the mobile app enabled.',
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
                {
                  value: 'draft',
                  label: t('taxi_fleet.communications.form.delivery.draft', 'Save as draft'),
                },
              ],
            },
            {
              id: 'scheduledAt',
              label: t('taxi_fleet.communications.form.scheduledAt', 'Schedule at'),
              type: 'datetime',
            },
          ]}
          initialValues={{
            kind: 'info',
            title: '',
            body: '',
            teamMemberIds: [],
            deliveryMode: 'now',
            scheduledAt: '',
          }}
          onSubmit={async (values) => {
            if (!tenantId || !organizationId) {
              throw new Error(t('taxi_fleet.errors.generic', 'Operation failed.'))
            }
            if (!values.teamMemberIds?.length) {
              throw new Error(
                t('taxi_fleet.communications.errors.recipientsRequired', 'Select at least one driver.'),
              )
            }
            if (values.title.trim().length > DRIVER_COMMUNICATION_TITLE_MAX) {
              throw new Error(
                t('taxi_fleet.communications.errors.titleTooLong', 'Title is too long.'),
              )
            }
            if (values.body.trim().length > DRIVER_COMMUNICATION_BODY_MAX) {
              throw new Error(
                t('taxi_fleet.communications.errors.bodyTooLong', 'Message is too long.'),
              )
            }
            const payload: Record<string, unknown> = {
              tenantId,
              organizationId,
              kind: values.kind,
              title: values.title.trim(),
              body: values.body.trim(),
              teamMemberIds: values.teamMemberIds,
            }
            if (values.deliveryMode === 'now') {
              payload.sendNow = true
            } else if (values.deliveryMode === 'schedule') {
              if (!values.scheduledAt) {
                throw new Error(
                  t('taxi_fleet.communications.errors.scheduleRequired', 'Pick a schedule time.'),
                )
              }
              payload.scheduledAt = new Date(values.scheduledAt).toISOString()
            }
            const call = await createCrud<{ id: string }>(
              'taxi_fleet/driver-communications',
              payload,
              {
                errorMessage: t('taxi_fleet.communications.create.error', 'Could not save communication.'),
              },
            )
            flash(t('taxi_fleet.communications.create.success', 'Communication saved.'), 'success')
            router.replace(`${TAXI_FLEET_BASE}/communications/${call.result?.id}`)
          }}
        />
      </PageBody>
    </Page>
  )
}
