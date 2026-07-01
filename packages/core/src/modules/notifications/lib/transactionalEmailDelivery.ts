import React from 'react'
import { parseBooleanWithDefault } from '@open-mercato/shared/lib/boolean'
import { sendEmail } from '@open-mercato/shared/lib/email/send'
import { resolveDefaultEmailFromAddress } from '@open-mercato/shared/lib/email/config'
import {
  DEFAULT_NOTIFICATION_DELIVERY_CONFIG,
  resolveNotificationDeliveryConfig,
  type NotificationCustomDeliveryConfig,
  type NotificationDeliveryConfig,
  type NotificationEmailDeliveryConfig,
} from './deliveryConfig'
import {
  getNotificationDeliveryStrategies,
  type NotificationDeliveryStrategy,
  type TransactionalEmailAttachment,
  type TransactionalEmailSendContext,
} from './deliveryStrategies'

export type TransactionalEmailPayload = {
  to: string
  subject: string
  react: React.ReactElement
  text?: string
  attachments?: TransactionalEmailAttachment[]
  resolve?: { resolve: <T = unknown>(name: string) => T }
}

export type ResolvedEmailDeliveryStrategy =
  | { kind: 'resend'; config: NotificationEmailDeliveryConfig }
  | {
      kind: 'custom'
      strategy: NotificationDeliveryStrategy
      strategyConfig: NotificationCustomDeliveryConfig
    }

type Resolver = {
  resolve: <T = unknown>(name: string) => T
}

export function resolveFirstEnabledEmailDeliveryStrategy(
  deliveryConfig: NotificationDeliveryConfig,
): ResolvedEmailDeliveryStrategy | null {
  const strategyConfigs = deliveryConfig.strategies.custom ?? {}
  for (const strategy of getNotificationDeliveryStrategies()) {
    const strategyConfig = strategyConfigs[strategy.id]
    const enabled = strategyConfig?.enabled ?? strategy.defaultEnabled ?? false
    if (!enabled || typeof strategy.sendTransactionalEmail !== 'function') {
      continue
    }
    return { kind: 'custom', strategy, strategyConfig: strategyConfig ?? {} }
  }

  if (deliveryConfig.strategies.email.enabled) {
    return { kind: 'resend', config: deliveryConfig.strategies.email }
  }

  return null
}

export async function sendTransactionalEmail(payload: TransactionalEmailPayload): Promise<void> {
  const emailDisabled =
    parseBooleanWithDefault(process.env.OM_DISABLE_EMAIL_DELIVERY, false) ||
    parseBooleanWithDefault(process.env.OM_TEST_MODE, false)
  if (emailDisabled) {
    return
  }

  const deliveryConfig = payload.resolve
    ? await resolveNotificationDeliveryConfig(payload.resolve, {
        defaultValue: DEFAULT_NOTIFICATION_DELIVERY_CONFIG,
      })
    : DEFAULT_NOTIFICATION_DELIVERY_CONFIG

  const resolved = resolveFirstEnabledEmailDeliveryStrategy(deliveryConfig)
  if (!resolved) {
    throw new Error('TRANSACTIONAL_EMAIL_NO_STRATEGY: no enabled email delivery strategy')
  }

  if (resolved.kind === 'resend') {
    const emailConfig = resolved.config
    const from = emailConfig.from ?? resolveDefaultEmailFromAddress()
    if (!from) {
      throw new Error('EMAIL_FROM_NOT_CONFIGURED: set NOTIFICATIONS_EMAIL_FROM, EMAIL_FROM, or ADMIN_EMAIL')
    }
    const subjectPrefix = emailConfig.subjectPrefix?.trim()
    const subject = subjectPrefix ? `${subjectPrefix} ${payload.subject}` : payload.subject
    await sendEmail({
      to: payload.to,
      subject,
      from,
      replyTo: emailConfig.replyTo,
      react: payload.react,
      attachments: payload.attachments,
    })
    return
  }

  const sendContext: TransactionalEmailSendContext = {
    to: payload.to,
    subject: payload.subject,
    react: payload.react,
    text: payload.text,
    attachments: payload.attachments,
    deliveryConfig,
    config: resolved.strategyConfig,
    resolve: payload.resolve?.resolve,
  }
  await resolved.strategy.sendTransactionalEmail!(sendContext)
}

export async function sendTransactionalEmailWithResolver(
  resolver: Resolver,
  payload: Omit<TransactionalEmailPayload, 'resolve'>,
): Promise<void> {
  await sendTransactionalEmail({ ...payload, resolve: resolver })
}
