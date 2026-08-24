---
moduleId: customers
sidebarSection: Clients
sidebarPaths:
  - /backend/customers/companies
  - /backend/customers/people
  - /backend/customers/simple-deals
relatedModules:
  - sales
  - catalog
  - resources
  - cases
  - workflows
  - partner_programs
existingUserGuideEn:
  - apps/docs/docs/user-guide/customers.mdx
  - apps/docs/docs/user-guide/customers/companies.mdx
  - apps/docs/docs/user-guide/customers/people.mdx
  - apps/docs/docs/user-guide/customers/deals.mdx
plManualStatus: not_started
---

# Customers (companies, people, simple deals)

## Purpose and audience

Core **CRM**: companies, people, deals, activities, and interactions. Daily work surfaces **companies**, **people**, and **simple deals** (simplified deal hub in Sales section).

Reference CRUD module for developers; operators use this for customer master data and lightweight deal tracking.

## Sidebar navigation

| Menu label (i18n key) | Path | Required feature |
|-----------------------|------|------------------|
| Companies | `/backend/customers/companies` | `customers.companies.view` |
| People | `/backend/customers/people` | `customers.people.view` |
| Simple deals | `/backend/customers/simple-deals` | `customers.simple_deals.view` |
| Customers settings | `/backend/config/customers` | `customers.settings.manage` |

Full **deals** hub at `/backend/customers/deals` is in module group (not structured Daily work).

## Key screens

### Lists
- Companies and people: DataTable with search, export, row actions.

### Company / person detail
- **Paths:** `/backend/customers/companies/[id]`, `.../people/[id]`
- Tabs: details, addresses, people/companies, resources, tasks, notes, activities, deals, quotes, orders, cases, policies (+ injected tabs).

### Simple deals
- **List:** `/backend/customers/simple-deals` — title, status, pipeline stage, expected close.
- **Detail:** `DealForm`; **Convert to quote** when person/company linked.

## Main workflows

### 1. Register a company or person
1. **Daily work → Clients → Companies** or **People** → Create.
2. Fill required fields and save.
3. Use detail tabs for relationships and activity.

### 2. Simple deal to quote
1. **Daily work → Sales → Simple deals** (or Clients flow) → Create deal.
2. Link person or company.
3. **Convert to quote** → opens sales simple quote with prefill.

### 3. CRM activity on detail
- Notes, activities, tasks (workflows), cases, partner programs (widget).

## Roles and permissions

| Feature ID | What it allows | Default roles |
|------------|----------------|---------------|
| `customers.companies.view/manage` | Companies | admin, employee |
| `customers.people.view/manage` | People | admin, employee |
| `customers.simple_deals.view/manage` | Simple deals | admin, employee |
| `customers.deals.*` | Full deals hub | admin, employee |
| `customers.activities.*` | Activities | admin, employee |
| `customers.pipelines.*` | Pipeline stages | admin, employee |

## Relations to other modules

- **sales** — quotes/orders tabs; deal → quote conversion.
- **catalog** — customer offerings tab.
- **resources** — resources tab on detail.
- **cases**, **workflows**, **partner_programs** — tabs and widgets.

## Common pitfalls and FAQ

- **Q:** Cannot convert deal to quote? **A:** Deal must have linked person or company.
- **Q:** Simple vs full deals? **A:** Daily work uses simple-deals; advanced pipeline at `/backend/customers/deals`.

## Authoring todos

- [ ] PL manual: merge companies/people/simple-deals into one guide or split — confirm with user in phase 2.
- [ ] Map EN docs sections to PL structure.
