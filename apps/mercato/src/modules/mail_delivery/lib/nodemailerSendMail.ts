import type { SendMailOptions } from 'nodemailer'
import type { NodemailerStrategyRuntimeConfig } from './nodemailerConfig'
import { getNodemailerTransport } from './nodemailerTransport'
import { sendDirectSmtpMail } from './nodemailerDirectSmtp'

export async function sendNodemailerMail(
  runtimeConfig: NodemailerStrategyRuntimeConfig,
  mail: SendMailOptions,
): Promise<{ messageId?: string; response?: string }> {
  if (runtimeConfig.transport === 'direct') {
    return sendDirectSmtpMail(mail, {
      smtpPort: runtimeConfig.directSmtpPort,
      devHost: runtimeConfig.directDevHost,
      devPort: runtimeConfig.directDevPort,
    })
  }

  const transport = getNodemailerTransport(runtimeConfig)
  return transport.sendMail(mail)
}
