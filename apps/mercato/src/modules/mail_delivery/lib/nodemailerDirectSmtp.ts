import dns from 'node:dns/promises'
import os from 'node:os'
import nodemailer from 'nodemailer'
import type { SendMailOptions } from 'nodemailer'

export type DirectSmtpDeliveryOptions = {
  smtpPort?: number
  devHost?: string
  devPort?: number
}

function extractEmailAddress(value: string): string {
  const trimmed = value.trim()
  const match = trimmed.match(/<([^>]+)>/)
  return (match ? match[1] : trimmed).trim()
}

function domainFromEmail(email: string): string | null {
  const at = email.lastIndexOf('@')
  if (at < 0) return null
  const domain = email.slice(at + 1).trim().toLowerCase()
  return domain.length > 0 ? domain : null
}

function collectRecipientAddresses(to: SendMailOptions['to']): string[] {
  if (!to) return []
  const items = Array.isArray(to) ? to : [to]
  const addresses: string[] = []
  for (const item of items) {
    if (typeof item === 'string') {
      for (const part of item.split(',')) {
        const email = extractEmailAddress(part)
        if (email) addresses.push(email)
      }
      continue
    }
    if (item && typeof item === 'object' && 'address' in item && typeof item.address === 'string') {
      addresses.push(extractEmailAddress(item.address))
    }
  }
  return addresses
}

function groupRecipientsByDomain(recipients: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>()
  for (const recipient of recipients) {
    const domain = domainFromEmail(recipient)
    if (!domain) continue
    const existing = groups.get(domain)
    if (existing) {
      existing.push(recipient)
    } else {
      groups.set(domain, [recipient])
    }
  }
  return groups
}

async function resolveMxHosts(domain: string, options: DirectSmtpDeliveryOptions): Promise<Array<{ exchange: string }>> {
  const devPort = options.devPort ?? -1
  if (devPort > 0) {
    return [{ exchange: options.devHost || 'localhost' }]
  }

  let records: Array<{ exchange: string; priority: number }>
  try {
    records = await dns.resolveMx(domain)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`can not resolve MX for <${domain}>: ${message}`)
  }

  if (!records.length) {
    throw new Error(`can not resolve MX for <${domain}>`)
  }

  records.sort((left, right) => left.priority - right.priority)
  return records.map((record) => ({
    exchange: record.exchange.replace(/\.$/, ''),
  }))
}

function resolveOutboundSmtpPort(options: DirectSmtpDeliveryOptions): number {
  const devPort = options.devPort ?? -1
  if (devPort > 0) return devPort
  return options.smtpPort ?? 25
}

/**
 * Direct SMTP delivery (MX lookup per recipient domain, port 25).
 * Same model as Strapi @strapi/provider-email-sendmail — bypasses local Postfix/sendmail.
 */
export async function sendDirectSmtpMail(
  mail: SendMailOptions,
  options: DirectSmtpDeliveryOptions = {},
): Promise<{ messageId?: string; response?: string }> {
  const fromAddress = extractEmailAddress(String(mail.from || ''))
  if (!fromAddress) {
    throw new Error('DIRECT_SMTP_FROM_REQUIRED: set a valid From address')
  }

  const srcHost = domainFromEmail(fromAddress) || os.hostname() || 'localhost'
  const smtpPort = resolveOutboundSmtpPort(options)
  const recipients = collectRecipientAddresses(mail.to)

  if (recipients.length === 0) {
    throw new Error('DIRECT_SMTP_NO_RECIPIENTS: no recipients defined')
  }

  const groups = groupRecipientsByDomain(recipients)
  let lastResult: { messageId?: string; response?: string } | undefined
  let anyDelivered = false

  for (const [domain, domainRecipients] of groups) {
    const hosts = await resolveMxHosts(domain, options)
    let sent = false
    let lastError: Error | undefined

    for (const { exchange } of hosts) {
      const transporter = nodemailer.createTransport({
        host: exchange,
        port: smtpPort,
        secure: false,
        ignoreTLS: true,
        requireTLS: false,
        name: srcHost,
        connectionTimeout: 60_000,
        greetingTimeout: 30_000,
        socketTimeout: 60_000,
      })

      try {
        lastResult = await transporter.sendMail({
          ...mail,
          to: domainRecipients,
          envelope: {
            from: fromAddress,
            to: domainRecipients,
          },
        })
        sent = true
        break
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.error(`[notifications][nodemailer][direct] failed via ${exchange}:${smtpPort}`, lastError)
      } finally {
        transporter.close()
      }
    }

    if (sent) {
      anyDelivered = true
    } else {
      throw lastError ?? new Error(`Failed to deliver mail for domain ${domain}`)
    }
  }

  if (!anyDelivered) {
    throw new Error('Failed to deliver mail for all recipient domains')
  }

  return lastResult ?? {}
}
