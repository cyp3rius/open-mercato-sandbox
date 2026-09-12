---
moduleId: dashboards
sidebarSection: Dashboard
sidebarPaths:
  - /backend
relatedModules:
  - sales
  - customers
  - cases
  - resources
  - workflows
existingUserGuideEn:
  - apps/docs/docs/user-guide/overview.mdx
plManualStatus: not_started
---

# Dashboard

## Purpose and audience

Configurable **admin home** at `/backend` with module-provided widgets (KPIs, shortcuts, analytics). First item in **Daily work** structured nav (`backend.nav.dailyWorkHome`).

For all backend users; layout personalization for those with configure permission.

## Sidebar navigation

| Menu label (i18n key) | Path | Required feature |
|-----------------------|------|------------------|
| Dashboard | `/backend` | Auth + per-widget features |

Implemented in `apps/mercato/src/app/(backend)/backend/page.tsx` → `DashboardScreen` (no module `page.meta.ts`).

## Key screens

### Dashboard home
- **Path:** `/backend`
- Widget grid loaded from `/api/dashboards/layout`.
- Add/remove/reorder widgets when `dashboards.configure` is granted.
- Each widget may require additional features (e.g. `sales.widgets.new-quotes`).

### Widget assignment (admin)
- Role/user widget assignment via `dashboards.admin.assign-widgets`.

## Main workflows

### 1. Open daily overview
1. Sign in → land on **Dashboard** (Daily work home).
2. View widgets allowed for your role.

### 2. Customize layout
1. Enter customize mode (`dashboards.configure`).
2. Add widgets from catalog, drag to reorder, remove.
3. Save layout (per user).

### 3. Admin: assign widgets to roles
1. Settings / role widgets APIs.
2. `seedDashboardDefaultsForTenant` runs on tenant create.

## Example widgets (cross-module)

| Widget | Module | Extra feature |
|--------|--------|---------------|
| New quotes / orders | sales | `sales.widgets.new-quotes/orders` |
| New deals / customers | customers | `customers.widgets.*` |
| Open cases SLA | dashboards | `cases.view` |
| Overdue resource tasks | dashboards | `resources.view` |
| QC pending | dashboards | `workflows.view_tasks` |
| Analytics KPIs | dashboards | `analytics.view` |

## Roles and permissions

| Feature ID | What it allows | Default roles |
|------------|----------------|---------------|
| `dashboards.view` | See dashboard | admin, employee |
| `dashboards.configure` | Personalize layout | admin, employee |
| `dashboards.admin.assign-widgets` | Role widget defaults | admin only |
| `analytics.view` | Analytics widgets | admin, employee |

## Relations to other modules

Aggregates data from **sales**, **customers**, **cases**, **resources**, **workflows** — does not own business entities.

## Common pitfalls and FAQ

- **Q:** Widget missing? **A:** Role may lack widget-specific feature (e.g. `cases.view` for cases widget).
- **Q:** Empty dashboard? **A:** New tenant may need widget assignment or configure to add widgets.

## Authoring todos

- [ ] Screenshot default dashboard for this deployment.
- [ ] List which widgets are enabled for employee role in PL manual.
