---
moduleId: accounting
sidebarSection: Accounting
sidebarPaths:
  - /backend/accounting
relatedModules:
  - attachments
  - currencies
  - customers
existingUserGuideEn: []
plManualStatus: not_started
---

# Accounting

## Purpose and audience

**Accounting invoice registry** for issued in-system invoices and imported cost/sales documents. Not a full general ledger — aimed at finance staff tracking income, costs, and drafts with selling-company configuration.

## Sidebar navigation

| Menu label (i18n key) | Path | Required feature |
|-----------------------|------|------------------|
| Accounting hub | `/backend/accounting` | `accounting.invoices.view` |
| Settings | `/backend/config/accounting` | `accounting.invoices.view` |

Legacy `/backend/accounting/invoices` redirects to hub with query preserved.

## Key screens

### Hub / list
- **Path:** `/backend/accounting`
- Tabs: **Sales (income)**, **Cost**, **Drafts** (`?tab=`).
- Search, settings, import popover, **Issue invoice** CTA.

### Create (issue)
- **Path:** `/backend/accounting/invoices/create`
- `documentKind = issued`; seller from selling entity, buyer from CRM company search, line items, currency.

### Detail
- **Path:** `/backend/accounting/invoices/[id]`
- Header edit, attachments.

### Import
- **Cost:** `/backend/accounting/invoices/import-cost` (`imported_cost`)
- **Sales:** `/backend/accounting/invoices/import-sales` (`imported_sales`)

### Settings
- **Hub:** `/backend/config/accounting`
- **Selling companies:** `/backend/config/accounting/entities` (view/manage)
- Invoice numbering sequences, registry sync from customers module.

## Main workflows

### 1. Issue an invoice
1. **Daily work → Accounting** → Issue invoice.
2. Select selling company, buyer, lines, currency.
3. Save; optional draft (`isDraft`).

### 2. Import external invoice
1. Use import popover → cost or sales import route.
2. Create invoice record, then attach file via attachments API.

### 3. Manage selling companies
1. Settings → selling entities list.
2. Configure bank accounts and invoice number sequences.

## Roles and permissions

| Feature ID | What it allows | Default roles |
|------------|----------------|---------------|
| `accounting.invoices.view` | View hub and invoices | admin only |
| `accounting.invoices.manage` | Create/update/delete/import | admin only |
| `accounting.settings.view` | View selling companies | admin only |
| `accounting.settings.manage` | Manage selling companies | admin only |

No employee defaults in `setup.ts` — accounting is admin-scoped by default.

## Relations to other modules

- **attachments** — invoice PDF/files.
- **currencies** — `currencyCode` on invoices.
- **customers** — buyer/seller company search (not full sales document flow).

## Common pitfalls and FAQ

- **Q:** Employee cannot see Accounting? **A:** No default employee features; assign `accounting.invoices.view` via role.
- **Q:** Difference from sales invoices? **A:** This module is a registry (issued + imported); sales module handles quote/order commercial flow.

## Authoring todos

- [ ] Confirm Polish business terms for income/cost/draft tabs.
- [ ] Document selling entity setup steps with screenshots.
