---
moduleId: sales
sidebarSection: Sales
sidebarPaths:
  - /backend/sales/simple-quotes
  - /backend/sales/simple-orders
relatedModules:
  - catalog
  - customers
  - workflows
  - dashboards
existingUserGuideEn:
  - apps/docs/docs/user-guide/sales/orders-and-quotes.mdx
plManualStatus: not_started
---

# Sales (simple quotes and orders)

## Purpose and audience

Lightweight **simple quotes** and **simple orders** for daily sales — customer-linked documents with lines, statuses, and totals. Complements full sales hubs (`/backend/sales/quotes`, `/backend/sales/orders`) which are outside the Mercato Daily work structured block.

## Sidebar navigation

| Menu label (i18n key) | Path | Required feature |
|-----------------------|------|------------------|
| Simple quotes | `/backend/sales/simple-quotes` | `sales.simple_quotes.view` |
| Simple orders | `/backend/sales/simple-orders` | `sales.simple_orders.view` |
| Sales settings | `/backend/config/sales` | `sales.settings.manage` |

## Key screens

### Quotes list
- **Path:** `/backend/sales/simple-quotes`
- Number, status, customer, currency, date, total.

### Orders list
- **Path:** `/backend/sales/simple-orders`
- Same pattern for orders.

### Create / edit
- **Paths:** `.../create`, `.../[id]`
- `SimpleDocumentEditor`: lines (catalog products), customer, dates, currency.
- Query prefill: `productId`, `customerEntityId`, `sourceDealId`, `sourceOfferId`.

## Main workflows

### 1. Create a quote
1. **Daily work → Sales → Simple quotes** → Create.
2. Select customer, add catalog product lines.
3. Save.

### 2. Deal → quote
1. From **simple deal** detail → Convert to quote.
2. Opens quote create with deal prefill.

### 3. Quote → order
1. On quote detail → Convert to order.
2. Order create prefilled from quote.

### 4. Order from offering
- Create order with `sourceOfferId` / customer offering prefill.

## Roles and permissions

| Feature ID | What it allows | Default roles |
|------------|----------------|---------------|
| `sales.simple_quotes.view` | View quotes | admin, employee |
| `sales.simple_quotes.manage` | Create/edit quotes | admin, employee |
| `sales.simple_orders.view` | View orders | admin, employee |
| `sales.simple_orders.manage` | Create/edit orders | admin, employee |

Full sales ACL includes channels, shipments, payments, full quote/order hubs.

## Relations to other modules

- **catalog** — product lines and pricing.
- **customers** — `customerEntityId`; prefill from deals.
- **workflows** — order approval widget on full order detail.
- **dashboards** — new quotes/orders widgets.

## Common pitfalls and FAQ

- **Q:** Simple vs full sales documents? **A:** Daily work uses simple UI; advanced flows use `/backend/sales/quotes` and `/backend/sales/orders`.
- **Q:** Missing products on lines? **A:** Need `catalog.products.view` and products in catalog.

## Authoring todos

- [ ] PL manual should focus on simple flow; link to full sales EN docs for advanced topics.
- [ ] Screenshot convert-to-order action on quote detail.
