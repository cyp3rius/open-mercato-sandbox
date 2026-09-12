---
moduleId: procurement
sidebarSection: Service
sidebarPaths:
  - /backend/procurement
  - /backend/procurement/processes
relatedModules:
  - customers
  - resources
  - sales
  - workflows
  - cases
  - dictionaries
  - attachments
existingUserGuideEn: []
plManualStatus: not_started
---

# Procurement

## Purpose and audience

Internal purchasing processes for teams that compare suppliers, track specification line items, assign tasks, and hand over outcomes to **resources**. Used by procurement coordinators, handlers, and managers who need a structured pipeline from request to closure.

## Sidebar navigation

| Menu label (i18n key) | Path | Required feature |
|-----------------------|------|------------------|
| Procurement hub | `/backend/procurement` | `procurement.processes.view` |
| Processes list | `/backend/procurement/processes` | `procurement.processes.view` |
| Module settings | `/backend/config/procurement` | `procurement.settings.manage` |

Create and detail routes are hidden from nav (`navHidden`); reached from list actions.

## Key screens

### List
- **Path:** `/backend/procurement/processes`
- DataTable with status and type filters (dictionary-backed), settings link, create button.
- Hub `/backend/procurement` redirects to the processes list.

### Create
- **Path:** `/backend/procurement/processes/create`
- Title, type, status, linked customer, handler, optional sales quote/invoice and resource links.

### Detail
- **Path:** `/backend/procurement/processes/[id]`
- Tabs: **Details**, **Specification**, **Suppliers**, **Tasks** (`?tab=tasks`), **History**.
- Supplier comparison: line items per supplier, winning supplier selection.
- Status transitions follow configurable pipeline (settings).

## Main workflows

### 1. Open a procurement process
1. Open **Daily work → Service → Procurement**.
2. Click create and enter title, type, status, customer, and handler.
3. Optionally link a sales quote, invoice, or resource.
4. Save.

### 2. Compare suppliers
1. Open process detail → **Suppliers** tab.
2. Add suppliers (CRM vendor company or free-text label).
3. Enter line items per supplier.
4. Select the winning supplier or refinancing line.

### 3. Work on tasks
1. Open **Tasks** tab on the process.
2. Assignees complete tasks; tasks sync with **workflows** user tasks.
3. Notifications fire on assign and complete (if permitted).

### 4. Close process
1. Move status through the pipeline (configured in settings).
2. Process records `closedAt` and timeline events.

## Roles and permissions

| Feature ID | What it allows | Default roles |
|------------|----------------|---------------|
| `procurement.processes.view` | View processes | admin, employee |
| `procurement.processes.handle` | Work on assigned processes | admin only |
| `procurement.processes.manage` | Create/edit processes | admin, employee |
| `procurement.process_tasks.complete.notify` | Notify on task complete | admin, employee |
| `procurement.settings.manage` | Status pipeline settings | admin only |

## Relations to other modules

- **customers** — customer and vendor entities on process and suppliers.
- **resources** — optional resource link on process.
- **sales** — optional quote/invoice references.
- **workflows** — user-task sync for process tasks.
- **cases** — cases can link `procurementProcessId`.
- **dictionaries** — process status and type values.
- **attachments** — files on process context.

## Common pitfalls and FAQ

- **Q:** Why can't I change the status? **A:** Pipeline rules in settings may restrict transitions or terminal states.
- **Q:** Employee cannot access settings. **A:** `procurement.settings.manage` is admin-only by default.

## Authoring todos

- [ ] Confirm default status pipeline stages with business owners for PL manual.
- [ ] Screenshot supplier comparison tab for PDF.
