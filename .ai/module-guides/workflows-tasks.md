---
moduleId: workflows
sidebarSection: Shortcuts
sidebarPaths:
  - /backend/tasks
relatedModules:
  - procurement
  - sales
  - dashboards
existingUserGuideEn:
  - apps/docs/docs/user-guide/workflows/user-tasks.mdx
plManualStatus: not_started
---

# Workflows (tasks inbox)

## Purpose and audience

**User task inbox** for human-in-the-loop workflow steps. Operators claim and complete tasks assigned by automated workflows; admins manage definitions and instances elsewhere in the Workflows module group.

Daily work shortcut focuses on **Tasks** only (`/backend/tasks`).

## Sidebar navigation

| Menu label (i18n key) | Path | Required feature |
|-----------------------|------|------------------|
| Tasks | `/backend/tasks` | `workflows.view_tasks` |

Other workflow routes (module group, not structured Daily work):

| Item | Path | Feature |
|------|------|---------|
| Definitions | `/backend/definitions` | `workflows.view` |
| Instances | `/backend/instances` | `workflows.view_instances` |
| Events | `/backend/events` | `workflows.view_logs` |
| Visual editor | `/backend/definitions/visual-editor` | `workflows.manage` |

## Key screens

### Task inbox
- **Path:** `/backend/tasks`
- DataTable; default filter **My tasks**; status, overdue, workflow instance filters.
- APIs: list, claim, complete.

### Task detail
- **Path:** `/backend/tasks/[id]`
- Dynamic form from `formSchema`, claim, complete with comments.
- Links to workflow instance and procurement process when present.

## Main workflows

### 1. Work my tasks
1. **My shortcuts → Tasks** (or Daily work).
2. Filter **My tasks**.
3. Open task → **Claim** if unassigned.
4. Fill form (if any) → **Complete**.

### 2. Handle overdue tasks
- Filter overdue; `dueDate` and escalation fields on entity.

### 3. Procurement-linked task
- Task detail shows procurement process title and deep link when `procurementProcessId` is set.

## Roles and permissions

| Feature ID | What it allows | Default roles |
|------------|----------------|---------------|
| `workflows.view_tasks` | View inbox | admin only |
| `workflows.tasks.claim` | Claim task | admin only |
| `workflows.tasks.complete` | Complete task | admin only |
| `workflows.view` | Definitions | admin only |
| `workflows.manage` | Edit definitions | admin only |

Grant task features to employee roles as needed for operational staff.

## Relations to other modules

- **procurement** — tasks synced from procurement process tasks.
- **sales** — order approval widget on full order detail.
- **dashboards** — QC pending widget needs `workflows.view_tasks`.

## Common pitfalls and FAQ

- **Q:** Empty inbox? **A:** Check filter (My tasks vs all); user may need claim permission.
- **Q:** Where are workflows defined? **A:** `/backend/definitions` — admin surface, not Daily work shortcut.

## Authoring todos

- [ ] Document which workflows are active in this deployment for operators.
- [ ] PL manual: focus on inbox; link EN workflows section for admins.
