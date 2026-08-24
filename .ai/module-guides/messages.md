---
moduleId: messages
sidebarSection: Shortcuts
sidebarPaths:
  - /backend/messages
relatedModules:
  - cases
  - auth
  - attachments
existingUserGuideEn: []
plManualStatus: not_started
---

# Messages

## Purpose and audience

Internal messaging: inbox, threads, attachments, linked records, actionable buttons, and optional email send/forward. For all staff who communicate inside the organization and with case-linked context.

## Sidebar navigation

| Menu label (i18n key) | Path | Required feature |
|-----------------------|------|------------------|
| Messages (inbox) | `/backend/messages` | `messages.view` |

Hidden: compose, detail. Public token view: `/messages/view/[token]` (no auth).

## Key screens

### Inbox
- **Path:** `/backend/messages`
- Folders: inbox, sent, drafts, archived, all.

### Compose
- **Path:** `/backend/messages/compose`
- Recipients, subject, body (markdown/text), priority.

### Detail
- **Path:** `/backend/messages/[id]`
- Conversation thread, reply, forward, attachments, linked objects, action buttons.

## Main workflows

### 1. Send a message
1. **My shortcuts → Messages** (or Daily work shortcut).
2. Compose → select recipients → write body → send.
3. Drafts saved until sent.

### 2. Reply in a thread
1. Open message detail.
2. Reply maintains `threadId` / `parentMessageId`.

### 3. Link to a case
- Messages with `caseId` appear on case **Messages** tab.
- Compose from case context pre-fills linkage.

### 4. Send via email
- Requires `messages.email` feature.

### 5. Attach files and records
- `messages.attach_files` — file uploads.
- `messages.attach` — link CRM records (extensible object types).

## Roles and permissions

| Feature ID | What it allows | Default roles |
|------------|----------------|---------------|
| `messages.view` | Read inbox | superadmin, admin, employee |
| `messages.compose` | Compose/send | all default roles |
| `messages.attach` | Link records | all default roles |
| `messages.attach_files` | File attachments | all default roles |
| `messages.email` | Email delivery | all default roles |
| `messages.actions` | Action buttons | all default roles |
| `messages.manage` | Manage all messages | all default roles |

## Relations to other modules

- **cases** — `caseId` on messages; case Messages tab.
- **auth** — sender/recipient users.
- **attachments** — message attachment API.
- Other modules register **message object types** for compose/detail.

## Common pitfalls and FAQ

- **Q:** Message not on case? **A:** Ensure `caseId` was set when composing from case flow.
- **Q:** External recipient? **A:** Use email feature or tokenized public view link.

## Authoring todos

- [ ] List which message object types are registered in this deployment.
- [ ] Document email configuration prerequisites for operators.
