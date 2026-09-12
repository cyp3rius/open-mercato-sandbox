---
moduleId: cases
sidebarSection: Service
sidebarPaths:
  - /backend/cases
relatedModules:
  - customers
  - messages
  - playbooks
  - procurement
  - insurance
  - resources
  - attachments
existingUserGuideEn: []
plManualStatus: pilot
---

# Cases

## Purpose and audience

Omnichannel **service cases** with timeline, linked messages, and playbook-driven procedures. For service desk staff, case owners, and team leads handling customer issues from intake through resolution.

## Sidebar navigation

| Menu label (i18n key) | Path | Required feature |
|-----------------------|------|------------------|
| Cases | `/backend/cases` | `cases.view` |
| Module settings | `/backend/config/cases` | `cases.settings.manage` |

Hidden: create, detail, procedure-task executor routes.

## Key screens

### List
- **Path:** `/backend/cases`
- DataTable: status, procedure label, filters.

### Create
- **Path:** `/backend/cases/create`
- Title, status, customer, owner, due date, priority; optional resource, procurement, insurance policy links.

### Detail
- **Path:** `/backend/cases/[id]`
- Tabs: **Details**, **Timeline**, **Messages**.
- Procedure executor for active playbook steps.
- Attachments section.

### Procedure task
- **Path:** `/backend/cases/[id]/procedure-task/[taskId]`
- Dedicated step executor (notify, yes/no, entity selection, nested procedure).

## Main workflows

### 1. Open a case
1. **Daily work → Service → Cases** → Create.
2. Fill title, customer, owner, due date, priority.
3. Save.

### 2. Run a procedure (playbook)
1. On case detail, select/start a **playbook** procedure.
2. Complete steps (assign owners where required).
3. Timeline records events; messages may be sent from procedure steps.

### 3. Handle messages on a case
1. Open **Messages** tab — lists messages with `caseId`.
2. Compose links into the **messages** module with case context.

### 4. Close a case
1. Use close action (`cases.close`).
2. If procedure is running, `cases.close.interruptProcedure` may be required.
3. Recurring cases can schedule next occurrence (`cases.recurrence.manage`).

### 5. Overdue handling
- Scheduler checks overdue cases every 5 minutes; notifications to team and owner.

## Roles and permissions

| Feature ID | What it allows | Default roles |
|------------|----------------|---------------|
| `cases.view` | View cases | admin, employee |
| `cases.create` | Create cases | admin, employee |
| `cases.edit` | Edit case fields | admin, employee |
| `cases.close` | Close cases | admin, employee |
| `cases.delete` | Delete cases | admin only |
| `cases.owner.assign` | Assign procedure owners | admin only |
| `cases.recurrence.manage` | Recurring cases | admin only |
| `cases.close.interruptProcedure` | Close with active procedure | admin only |
| `cases.settings.manage` | Settings hub | admin only |
| `cases.cases.*.notify` | Team notifications | admin, employee |

## Relations to other modules

- **customers** — `customerEntityId`.
- **messages** — case-linked inbox threads.
- **playbooks** — procedure engine and bindings.
- **procurement** — optional `procurementProcessId`.
- **insurance** — optional `insurancePolicyId`.
- **resources** — optional `resourceId`.
- **attachments** — case detail files.

## Common pitfalls and FAQ

- **Q:** Procedure stuck? **A:** Check owner assignment and whether close requires interrupt permission.
- **Q:** No messages tab content? **A:** User needs `messages.view`; messages must have `caseId` set.

## Authoring todos

- [ ] Document which playbooks are standard for RS Moto / deployment.
- [ ] PL pilot manual created at `apps/docs/docs/user-guide/pl/cases.mdx`.
