import { render } from '@react-email/render'
import { parseBooleanWithDefault } from '@open-mercato/shared/lib/boolean'
import type { TransactionalEmailSendContext } from '@open-mercato/core/modules/notifications/lib/deliveryStrategies'
import {
  resolveNodemailerStrategyConfig,
} from './nodemailerConfig'
import { sendNodemailerMail } from './nodemailerSendMail'

export async function sendTransactionalViaNodemailer(ctx: TransactionalEmailSendContext): Promise<void> {
  const emailDisabled =
    parseBooleanWithDefault(process.env.OM_DISABLE_EMAIL_DELIVERY, false) ||
    parseBooleanWithDefault(process.env.OM_TEST_MODE, false)
  if (emailDisabled) {
    return
  }

  const runtimeConfig = resolveNodemailerStrategyConfig(ctx.config.config)

  if (!runtimeConfig.from) {
    throw new Error('EMAIL_FROM_NOT_CONFIGURED: set NOTIFICATIONS_EMAIL_FROM, EMAIL_FROM, or ADMIN_EMAIL')
  }

  const subjectPrefix = runtimeConfig.subjectPrefix?.trim()
  const subject = subjectPrefix ? `${subjectPrefix} ${ctx.subject}` : ctx.subject
  const html = await render(ctx.react)
  const attachments = ctx.attachments?.map((item) => ({
    filename: item.filename,
    content: Buffer.from(item.content, 'base64'),
    contentType: item.contentType,
  }))

  await sendNodemailerMail(runtimeConfig, {
    from: runtimeConfig.from,
    to: ctx.to,
    subject,
    html,
    text: ctx.text,
    ...(runtimeConfig.replyTo ? { replyTo: runtimeConfig.replyTo } : {}),
    ...(attachments?.length ? { attachments } : {}),
  })
}
