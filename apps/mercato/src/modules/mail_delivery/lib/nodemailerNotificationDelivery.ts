import { render } from '@react-email/render'
import { parseBooleanWithDefault } from '@open-mercato/shared/lib/boolean'
import { registerNotificationDeliveryStrategy } from '@open-mercato/core/modules/notifications/lib/deliveryStrategies'
import type { NotificationDeliveryContext } from '@open-mercato/core/modules/notifications/lib/deliveryStrategies'
import NotificationEmail from '@open-mercato/core/modules/notifications/emails/NotificationEmail'
import {
  isNodemailerDeliveryEnabledByDefault,
  resolveNodemailerStrategyConfig,
} from './nodemailerConfig'
import { sendNodemailerMail } from './nodemailerSendMail'
import { sendTransactionalViaNodemailer } from './nodemailerTransactionalEmail'
import { NODEMAILER_NOTIFICATION_STRATEGY_ID } from './constants'

const STRATEGY_ID = NODEMAILER_NOTIFICATION_STRATEGY_ID

function buildPlainText(
  title: string,
  body: string | null,
  panelLink: string | null,
  actionLinks: NotificationDeliveryContext['actionLinks'],
  copy: {
    heading: string
    bodyIntro: string
    actionNotice: string
    openCta: string
  },
): string {
  const lines = [
    copy.heading,
    '',
    title,
  ]

  if (body) {
    lines.push('', body)
  }

  lines.push('', copy.bodyIntro)

  if (actionLinks.length > 0) {
    lines.push('', copy.actionNotice, '')
    for (const action of actionLinks) {
      lines.push(`${action.label}: ${action.href}`)
    }
  }

  if (panelLink) {
    lines.push('', `${copy.openCta}: ${panelLink}`)
  }

  return lines.join('\n')
}

export async function deliverNotificationViaNodemailer(ctx: NotificationDeliveryContext): Promise<void> {
  const emailDisabled =
    parseBooleanWithDefault(process.env.OM_DISABLE_EMAIL_DELIVERY, false) ||
    parseBooleanWithDefault(process.env.OM_TEST_MODE, false)
  if (emailDisabled) return

  if (!ctx.recipient.email || !ctx.panelLink) return

  const runtimeConfig = resolveNodemailerStrategyConfig(ctx.config.config)

  if (!runtimeConfig.from) {
    throw new Error('EMAIL_FROM_NOT_CONFIGURED: set NOTIFICATIONS_EMAIL_FROM, EMAIL_FROM, or ADMIN_EMAIL')
  }

  const subjectPrefix = runtimeConfig.subjectPrefix?.trim()
  const subject = subjectPrefix ? `${subjectPrefix} ${ctx.title}` : ctx.title
  const copy = {
    preview: ctx.t('notifications.delivery.email.preview', 'New notification'),
    heading: ctx.t('notifications.delivery.email.heading', 'You have a new notification'),
    bodyIntro: ctx.t('notifications.delivery.email.bodyIntro', 'Review the notification details and take any required actions.'),
    actionNotice: ctx.t('notifications.delivery.email.actionNotice', 'Actions are available in Open Mercato and are read-only in this email.'),
    openCta: ctx.t('notifications.delivery.email.openCta', 'Open notification center'),
    footer: ctx.t('notifications.delivery.email.footer', 'Open Mercato notifications'),
  }

  const html = await render(
    NotificationEmail({
      title: ctx.title,
      body: ctx.body,
      actions: ctx.actionLinks,
      panelUrl: ctx.panelLink,
      copy,
    }),
  )

  await sendNodemailerMail(runtimeConfig, {
    from: runtimeConfig.from,
    to: ctx.recipient.email,
    subject,
    html,
    text: buildPlainText(ctx.title, ctx.body, ctx.panelLink, ctx.actionLinks, copy),
    ...(runtimeConfig.replyTo ? { replyTo: runtimeConfig.replyTo } : {}),
  })
}

export function registerNodemailerNotificationDeliveryStrategy(): void {
  registerNotificationDeliveryStrategy(
    {
      id: STRATEGY_ID,
      label: 'Email (Nodemailer)',
      defaultEnabled: isNodemailerDeliveryEnabledByDefault(),
      deliver: deliverNotificationViaNodemailer,
      sendTransactionalEmail: sendTransactionalViaNodemailer,
    },
    { priority: 20 },
  )
}

export { NODEMAILER_NOTIFICATION_STRATEGY_ID }
