import * as React from 'react'
import crypto from 'node:crypto'
import type { EntityManager } from '@mikro-orm/postgresql'
import { loadDictionary } from '@open-mercato/shared/lib/i18n/server'
import { emailDefaultLocale, type Locale } from '@open-mercato/shared/lib/i18n/config'
import { createFallbackTranslator } from '@open-mercato/shared/lib/i18n/translate'
import { resolveUserLocale } from '../../auth/lib/userLocale'
import ProcedureNotifyCustomerEmail from '../../cases/emails/ProcedureNotifyCustomerEmail'
import ProcedureNotifyOwnerEmail from '../../cases/emails/ProcedureNotifyOwnerEmail'
import { htmlToPlainText } from '../../cases/lib/htmlToPlainText'
import {
  isProcedureNotifyCustomerMessageType,
  isProcedureNotifyMessageType,
  isProcedureNotifyOwnerMessageType,
} from '../../cases/lib/procedureNotifyMessageTypes'
import type { Message, MessageObject } from '../data/entities'
import { MessageAccessToken } from '../data/entities'
import MessageEmail from '../emails/MessageEmail'
import { getStorageDriverFactory } from '../../attachments/lib/drivers'
import { sendTransactionalEmailWithResolver } from '../../notifications/lib/transactionalEmailDelivery'
import type { MessageEmailAttachment } from './attachments'

const ACCESS_TOKEN_EXPIRY_HOURS = 24 * 7
const DEBUG = process.env.MESSAGES_EMAIL_DEBUG === 'true'
const MAX_EMAIL_ATTACHMENTS = 10
const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024

export type SenderIdentity = {
  name: string | null
  email: string | null
}

type Resolver = {
  resolve: <T = unknown>(name: string) => T
}

function logDebug(message: string, details?: Record<string, unknown>) {
  if (!DEBUG) return
  if (details) {
    console.log(`[messages:email-sender] ${message}`, details)
    return
  }
  console.log(`[messages:email-sender] ${message}`)
}

function resolveAppUrl(): string | null {
  const raw = process.env.APP_URL?.trim()
  if (!raw) return null
  return raw.replace(/\/$/, '')
}

function buildSenderLabel(sender: SenderIdentity): string {
  const name = sender.name?.trim()
  if (name) return name
  const email = sender.email?.trim()
  if (email) return email
  return 'System'
}

function generateAccessToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

function resolveObjectLabels(objects: MessageObject[]): string[] {
  return objects.map((item) => `${item.entityModule}.${item.entityType} (${item.entityId})`)
}

type EmailAttachment = {
  filename: string
  content: string
  contentType?: string
}

async function mapAttachmentsForEmail(
  messageId: string,
  attachments: MessageEmailAttachment[],
): Promise<EmailAttachment[]> {
  const emailAttachments: EmailAttachment[] = []
  let totalBytes = 0

  for (const attachment of attachments.slice(0, MAX_EMAIL_ATTACHMENTS)) {
    let buffer: Buffer
    try {
      const result = await getStorageDriverFactory()
        .resolve(attachment.storageDriver)
        .read(attachment.partitionCode, attachment.storagePath)
      buffer = result.buffer
    } catch (error) {
      logDebug('Attachment skipped: file read failed', {
        messageId,
        fileName: attachment.fileName,
        error: error instanceof Error ? error.message : String(error),
      })
      continue
    }

    if ((totalBytes + buffer.length) > MAX_TOTAL_ATTACHMENT_BYTES) {
      logDebug('Attachment skipped: total size limit exceeded', {
        messageId,
        fileName: attachment.fileName,
        nextTotalBytes: totalBytes + buffer.length,
      })
      continue
    }

    totalBytes += buffer.length
    emailAttachments.push({
      filename: attachment.fileName,
      content: buffer.toString('base64'),
      contentType: attachment.mimeType || undefined,
    })
  }

  return emailAttachments
}

async function renderMarkdownEmailBody(body: string) {
  const ReactMarkdownModule = await import('react-markdown')
  const remarkGfmModule = await import('remark-gfm')
  const ReactMarkdown =
    (ReactMarkdownModule.default ?? ReactMarkdownModule) as React.ComponentType<{
      remarkPlugins?: unknown
      children?: React.ReactNode
    }>
  const remarkGfmPlugin = remarkGfmModule.default ?? remarkGfmModule
  const { renderToStaticMarkup } = await import('react-dom/server')

  return renderToStaticMarkup(
    React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfmPlugin] }, body),
  )
}

async function buildEmailBodyHtml(message: Message): Promise<string | undefined> {
  if (isProcedureNotifyMessageType(message.type)) {
    return message.body
  }
  if (message.bodyFormat !== 'markdown') return undefined
  if (!message.body) return undefined
  return renderMarkdownEmailBody(message.body)
}

async function buildMessageEmailCopy(sentAt: Date, locale: Locale) {
  const dict = await loadDictionary(locale)
  const t = createFallbackTranslator(dict)
  return {
    preview: t('messages.email.preview', 'You received a message in Open Mercato'),
    heading: t('messages.email.heading', 'New message'),
    from: t('messages.email.from', 'From'),
    sentAt: t('messages.email.sentAt', 'Sent'),
    sentAtLabel: sentAt.toISOString(),
    viewCta: t('messages.email.viewCta', 'View message'),
    attachmentsLabel: t('messages.email.attachments', 'Attachments'),
    objectsLabel: t('messages.email.objects', 'Related records'),
    footer: t('messages.email.footer', 'Open Mercato messages'),
  }
}

async function buildProcedureOwnerEmailCopy(locale: Locale) {
  const dict = await loadDictionary(locale)
  const t = createFallbackTranslator(dict)
  return {
    preview: t('cases.email.procedureNotify.owner.preview', 'Procedure notification'),
    heading: t('cases.email.procedureNotify.owner.heading', 'Procedure notification'),
    caseLabel: t('cases.email.procedureNotify.owner.caseLabel', 'Case'),
    stepLabel: t('cases.email.procedureNotify.owner.stepLabel', 'Step'),
    viewCta: t('cases.email.procedureNotify.owner.viewCta', 'View message'),
    footer: t('cases.email.procedureNotify.owner.footer', 'Open Mercato'),
  }
}

async function buildProcedureCustomerEmailCopy(locale: Locale) {
  const dict = await loadDictionary(locale)
  const t = createFallbackTranslator(dict)
  return {
    preview: t('cases.email.procedureNotify.customer.preview', 'Message from us'),
    heading: t('cases.email.procedureNotify.customer.heading', 'You have a new message'),
    footer: t('cases.email.procedureNotify.customer.footer', 'Thank you'),
  }
}

function parseProcedureNotifySubjectParts(subject: string): { caseTitle: string; stepLabel: string | null } {
  const separator = ' — '
  const index = subject.indexOf(separator)
  if (index === -1) {
    return { caseTitle: subject, stepLabel: null }
  }
  return {
    caseTitle: subject.slice(0, index).trim(),
    stepLabel: subject.slice(index + separator.length).trim() || null,
  }
}

async function buildProcedureNotifyEmailElement(params: {
  message: Message
  viewUrl?: string | null
  locale: Locale
}) {
  const { message, viewUrl, locale } = params
  const bodyHtml = message.body
  const plainText = htmlToPlainText(bodyHtml)

  if (isProcedureNotifyOwnerMessageType(message.type)) {
    const { caseTitle, stepLabel } = parseProcedureNotifySubjectParts(message.subject)
    const copy = await buildProcedureOwnerEmailCopy(locale)
    return {
      react: ProcedureNotifyOwnerEmail({
        subject: message.subject,
        caseTitle,
        stepLabel,
        bodyHtml,
        viewUrl: viewUrl ?? null,
        copy,
      }),
      text: plainText,
    }
  }

  if (isProcedureNotifyCustomerMessageType(message.type)) {
    const copy = await buildProcedureCustomerEmailCopy(locale)
    return {
      react: ProcedureNotifyCustomerEmail({
        subject: message.subject,
        bodyHtml,
        copy,
      }),
      text: plainText,
    }
  }

  throw new Error(`Unsupported procedure notify message type: ${message.type}`)
}

export async function createMessageAccessToken(
  em: EntityManager,
  messageId: string,
  recipientUserId: string,
): Promise<string> {
  const token = generateAccessToken()
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)
  const record = em.create(MessageAccessToken, {
    messageId,
    recipientUserId,
    token,
    expiresAt,
    useCount: 0,
  })
  await em.persistAndFlush(record)
  logDebug('Created access token', {
    messageId,
    recipientUserId,
    expiresAt: expiresAt.toISOString(),
  })
  return token
}

export async function sendMessageEmailToRecipient(params: {
  em: EntityManager
  message: Message
  recipientUserId: string
  recipientEmail: string
  sender: SenderIdentity
  objects: MessageObject[]
  attachments: MessageEmailAttachment[]
  resolve: Resolver
}): Promise<void> {
  const { em, message, recipientUserId, recipientEmail, sender, objects, attachments, resolve } = params
  const recipientLocale = await resolveUserLocale(em, {
    userId: recipientUserId,
    tenantId: message.tenantId,
    organizationId: message.organizationId,
  })
  const token = await createMessageAccessToken(em, message.id, recipientUserId)
  const appUrl = resolveAppUrl()
  const viewUrl = appUrl ? `${appUrl}/messages/view/${token}` : null
  if (!appUrl) {
    logDebug('APP_URL missing - email link omitted', { messageId: message.id })
  }
  const emailAttachments = await mapAttachmentsForEmail(message.id, attachments)

  if (isProcedureNotifyMessageType(message.type)) {
    const { react, text } = await buildProcedureNotifyEmailElement({ message, viewUrl, locale: recipientLocale })
    logDebug('Sending procedure notify email to recipient', {
      messageId: message.id,
      recipientUserId,
      recipientEmail,
      messageType: message.type,
    })
    await sendTransactionalEmailWithResolver(resolve, {
      to: recipientEmail,
      subject: message.subject,
      react,
      text,
      attachments: emailAttachments,
    })
    return
  }

  const copy = await buildMessageEmailCopy(message.sentAt ?? new Date(), recipientLocale)
  const bodyHtml = await buildEmailBodyHtml(message)
  logDebug('Sending recipient email', {
    messageId: message.id,
    recipientUserId,
    recipientEmail,
    hasViewUrl: Boolean(viewUrl),
    attachmentsCount: emailAttachments.length,
  })

  await sendTransactionalEmailWithResolver(resolve, {
    to: recipientEmail,
    subject: message.subject,
    react: MessageEmail({
      subject: message.subject,
      body: message.body,
      bodyHtml,
      senderName: buildSenderLabel(sender),
      sentAtLabel: copy.sentAtLabel,
      viewUrl,
      copy,
      attachmentNames: attachments.map((item) => item.fileName),
      objectLabels: resolveObjectLabels(objects),
    }),
    attachments: emailAttachments,
  })
}

export async function sendMessageEmailToExternal(params: {
  message: Message
  email: string
  sender: SenderIdentity
  objects: MessageObject[]
  attachments: MessageEmailAttachment[]
  resolve: Resolver
}): Promise<void> {
  const { message, email, sender, objects, attachments, resolve } = params
  const externalLocale = emailDefaultLocale
  const emailAttachments = await mapAttachmentsForEmail(message.id, attachments)

  if (isProcedureNotifyMessageType(message.type)) {
    const { react, text } = await buildProcedureNotifyEmailElement({ message, viewUrl: null, locale: externalLocale })
    logDebug('Sending procedure notify email to external recipient', {
      messageId: message.id,
      email,
      messageType: message.type,
    })
    await sendTransactionalEmailWithResolver(resolve, {
      to: email,
      subject: message.subject,
      react,
      text,
      attachments: emailAttachments,
    })
    return
  }

  const copy = await buildMessageEmailCopy(message.sentAt ?? new Date(), externalLocale)
  const bodyHtml = await buildEmailBodyHtml(message)
  logDebug('Sending external email', {
    messageId: message.id,
    email,
    attachmentsCount: emailAttachments.length,
  })

  await sendTransactionalEmailWithResolver(resolve, {
    to: email,
    subject: message.subject,
    react: MessageEmail({
      subject: message.subject,
      body: message.body,
      bodyHtml,
      senderName: buildSenderLabel(sender),
      sentAtLabel: copy.sentAtLabel,
      viewUrl: null,
      copy,
      attachmentNames: attachments.map((item) => item.fileName),
      objectLabels: resolveObjectLabels(objects),
    }),
    attachments: emailAttachments,
  })
  logDebug('External email sent', {
    messageId: message.id,
    email,
  })
}
