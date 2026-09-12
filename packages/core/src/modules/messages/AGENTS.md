# Messages Module — Agent Guidelines

Internal messaging: inbox, threads, attachments, linked records, actionable buttons, and optional email delivery.

## MUST Rules

1. **MUST use folder views** — inbox, sent, drafts, archived, all on list page
2. **MUST support threading** via `threadId` and `parentMessageId`
3. **MUST gate email send** behind `messages.email` feature
4. **MUST link to cases** via `caseId` when composed from case context
5. **MUST use attachments API** for files — not ad-hoc storage

## Key Reference Files

| When you need | Copy from |
|---------------|-----------|
| Inbox list | `backend/messages/page.tsx` |
| Compose | `backend/messages/compose/page.tsx` |
| Detail / thread | `backend/messages/[id]/page.tsx` |
| Public token view | `frontend/messages/view/[token]/` |
| Email worker | `workers/` (email send queue) |
| ACL / setup | `acl.ts`, `setup.ts` |

## Data Model

- **Message** — sender, recipients, body, priority, `caseId`, `actionData`
- **Attachments** — via attachments module API

## Relations

- **cases** — `caseId`; case Messages tab
- **auth** — users as senders/recipients
- **attachments** — file uploads
- Extensible **message object types** — other modules register for compose/detail

## Operator documentation

- Module guide: [`.ai/module-guides/messages.md`](../../../../.ai/module-guides/messages.md)
