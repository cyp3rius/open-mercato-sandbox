import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { User } from '../../../../auth/data/entities'
import { Message, MessageRecipient } from '../../../../messages/data/entities'
import { ServiceCase } from '../../../data/entities'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['cases.view', 'messages.view'] },
}

const paramsSchema = z.object({
  caseId: z.string().uuid(),
})

export async function GET(req: Request, routeContext: { params?: { caseId?: string } }) {
  try {
    const { translate } = await resolveTranslations()
    const container = await createRequestContainer()
    const auth = await getAuthFromRequest(req)
    if (!auth) {
      return NextResponse.json({ error: translate('errors.unauthorized', 'Unauthorized') }, { status: 401 })
    }
    const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
    const organizationId = scope?.selectedId ?? auth.orgId ?? null
    const parsedParams = paramsSchema.safeParse({ caseId: routeContext.params?.caseId })
    if (!parsedParams.success) {
      return NextResponse.json({ error: translate('cases.errors.invalidCaseId', 'Invalid case id.') }, { status: 400 })
    }
    const em = (container.resolve('em') as EntityManager).fork()
    const caseRow = await em.findOne(ServiceCase, {
      id: parsedParams.data.caseId,
      tenantId: auth.tenantId ?? undefined,
      deletedAt: null,
    })
    if (!caseRow) {
      return NextResponse.json({ error: translate('cases.errors.notFound', 'Case not found.') }, { status: 404 })
    }
    if (organizationId && caseRow.organizationId !== organizationId) {
      return NextResponse.json({ error: translate('errors.forbidden', 'Forbidden') }, { status: 403 })
    }
    const rows = await em.find(
      Message,
      {
        tenantId: auth.tenantId ?? undefined,
        organizationId: organizationId ?? caseRow.organizationId,
        caseId: parsedParams.data.caseId,
        deletedAt: null,
      },
      { orderBy: { sentAt: 'DESC', createdAt: 'DESC' } },
    )
    const messageIds = rows.map((m) => m.id)
    const allRecipients =
      messageIds.length > 0
        ? await em.find(MessageRecipient, { messageId: { $in: messageIds } }, { orderBy: { createdAt: 'asc' } })
        : []
    const byMessage = new Map<string, MessageRecipient[]>()
    for (const r of allRecipients) {
      const list = byMessage.get(r.messageId) ?? []
      list.push(r)
      byMessage.set(r.messageId, list)
    }
    const userIds = new Set(
      allRecipients
        .map((r) => r.recipientUserId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    )
    const users = userIds.size > 0 ? await em.find(User, { id: { $in: [...userIds] }, deletedAt: null }) : []
    const userLabel = new Map<string, string>()
    for (const u of users) {
      const name = typeof u.name === 'string' ? u.name.trim() : ''
      const email = typeof u.email === 'string' ? u.email.trim() : ''
      userLabel.set(u.id, name.length > 0 ? name : email.length > 0 ? email : u.id)
    }
    const resolveRecipient = (m: (typeof rows)[0]) => {
      const extName = m.externalName?.trim()
      const extEmail = m.externalEmail?.trim()
      if (extName || extEmail) {
        if (extName && extEmail) return `${extName} · ${extEmail}`
        return extName || extEmail || '—'
      }
      const recs = byMessage.get(m.id) ?? []
      const toFirst = recs.find((r) => r.recipientType === 'to') ?? recs[0]
      if (!toFirst) return '—'
      return userLabel.get(toFirst.recipientUserId) ?? toFirst.recipientUserId
    }
    const items = rows.map((m) => ({
      id: m.id,
      subject: m.subject,
      threadId: m.threadId ?? null,
      senderUserId: m.senderUserId,
      sentAt: m.sentAt ? m.sentAt.toISOString() : null,
      isDraft: m.isDraft,
      status: m.status,
      sendViaEmail: m.sendViaEmail,
      type: typeof m.type === 'string' && m.type.trim().length ? m.type.trim() : 'default',
      recipientDisplay: resolveRecipient(m),
      channelKind: (m.sendViaEmail ? 'email' : 'in_app') as 'email' | 'in_app',
    }))
    return NextResponse.json({ items, total: items.length })
  } catch (err) {
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    console.error('cases messages GET', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('cases.errors.loadMessages', 'Failed to load messages.') }, { status: 500 })
  }
}
