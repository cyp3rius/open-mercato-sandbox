---
moduleId: catalog
sidebarSection: Sales
sidebarPaths:
  - /backend/catalog/products
relatedModules:
  - sales
  - customers
existingUserGuideEn:
  - apps/docs/docs/user-guide/products-and-sales-channels.mdx
plManualStatus: not_started
---

# Catalog (products)

## Purpose and audience

Product catalog for **products**, variants, categories, pricing, and customer offerings. Sales staff and catalog managers maintain items used on simple and full sales documents.

## Sidebar navigation

| Menu label (i18n key) | Path | Required feature |
|-----------------------|------|------------------|
| Products | `/backend/catalog/products` | `catalog.products.view` |
| Categories | `/backend/catalog/categories` | `catalog.categories.view` |
| Simple offerings | `/backend/catalog/simple-offerings` | `catalog.simple_offerings.view` |
| Catalog settings | `/backend/config/catalog` | `catalog.settings.manage` |

Daily work structured nav includes **Products** only; categories/offerings are in module group below.

## Key screens

### Products list
- **Path:** `/backend/catalog/products`
- Search, filters, bulk delete (injection), export.

### Product detail
- **Path:** `/backend/catalog/products/[id]`
- Basics, media, variants, pricing, categories, option schema, service lines, custom fields.

### Categories
- Tree/list + create/edit.

### Simple offerings
- Activate/deactivate customer product offerings per CRM entity.

## Main workflows

### 1. Create a product
1. **Daily work → Sales → Products** → Create.
2. Fill name, categories, prices; optional variants.
3. Save.

### 2. Set pricing for sales
- Prices resolved via `selectBestPrice` when adding lines on quotes/orders.

### 3. Customer offerings
1. Open **simple offerings** or customer detail **offerings** tab.
2. Activate/deactivate offerings; sales order events update subscription state.

## Roles and permissions

| Feature ID | What it allows | Default roles |
|------------|----------------|---------------|
| `catalog.products.view` | View products | admin, employee |
| `catalog.products.manage` | Edit products | admin, employee |
| `catalog.categories.view/manage` | Categories | admin, employee |
| `catalog.pricing.manage` | Pricing | admin, employee |
| `catalog.customer_offerings.view/manage` | Per-customer offerings | admin, employee |
| `catalog.simple_offerings.view/manage` | Simple offerings admin | admin, employee |

## Relations to other modules

- **sales** — lines on documents; order subscribers for offerings.
- **customers** — offerings widget on person/company detail.

## Common pitfalls and FAQ

- **Q:** Product not on quote line search? **A:** Check product is active and user has catalog view.
- **Q:** Channel-specific pricing? **A:** See full EN guide `products-and-sales-channels.mdx`.

## Authoring todos

- [ ] Daily work PL manual covers products only; categories/offerings as appendix.
- [ ] Screenshot product detail pricing section.
