# Customer guardian + product case activation from sales

## TLDR

Customers (company/person) expose a guardian (`ownerUserId`). Catalog products gain an offering kind and a list of case templates. Confirming a sales order creates customer offerings; non-subscription offerings activate immediately and spawn cases owned by the customer guardian. Subscriptions activate at `startsAt` and bound recurring case cycles to `endsAt`. Operators can force-activate pending offerings from the customer card; cancel/return deactivates offerings and closes spawned cases; bundle/grouped lines expand to child product offerings.

## Overview

Operators assign a guardian on CRM entities, author case templates on products, and fulfill via sales orders. Activation is automatic from order confirmation—no manual “activate product” MVP.

## Problem Statement

- Guardian existed on `CustomerEntity` but was missing from person/company forms.
- Products had no commercial offering kind (resource / services / subscription) separate from structural `productType`.
- There was no path from sold products to case creation with correct ownership and subscription windows.

## Proposed Solution

1. Require/show guardian on person and company forms.
2. Add `offeringKind` + `caseTemplates` on `CatalogProduct`.
3. Add subscription date fields on `SalesOrderLine`.
4. Introduce `CatalogCustomerOffering` entitlement; activate from `sales.order.updated` when status is `confirmed`.
5. Spawn cases via `cases.cases.create`; recurrence worker respects subscription `endsAt`.

## Architecture

- Cross-module: UUID FKs only; case create via command bus.
- Trigger: persistent subscriber on `sales.order.updated` (+ create if already confirmed).
- Deferred subscription activation: queue worker `catalog-subscription-activate`.

## Data Models

### Customer

- Reuse `customers_entities.owner_user_id` (no migration).

### CatalogProduct (additive)

| Column | Type | Notes |
|--------|------|--------|
| `offering_kind` | text | `resource` \| `internal_service` \| `external_service` \| `subscription`; default `internal_service` |
| `case_templates` | jsonb | array of templates |

Template shape: `{ id, title, playbookId?, recurrenceEnabled?, recurrenceIntervalAmount?, recurrenceIntervalUnit?, recurrenceCreateLeadTime? }`.

### SalesOrderLine (additive)

| Column | Type |
|--------|------|
| `subscription_starts_at` | timestamptz null |
| `subscription_ends_at` | timestamptz null |

Required when linked product `offeringKind === subscription`.

### CatalogCustomerOffering (new)

| Column | Type |
|--------|------|
| id, tenant_id, organization_id | uuid |
| customer_entity_id, product_id | uuid |
| sales_order_id, sales_order_line_id | uuid |
| offering_kind | text |
| status | pending \| active \| ended \| cancelled |
| starts_at, ends_at, activated_at | timestamptz |
| case_templates_snapshot | jsonb |
| spawned_case_ids | jsonb | map templateId → caseId |
| created_at, updated_at, deleted_at | |

Unique: `(sales_order_line_id)` where not deleted.

## API / Commands

- Product create/update: accept `offeringKind`, `caseTemplates`.
- Order line create/update: accept subscription dates.
- `catalog.customer_offerings.activate` — internal/command; spawns cases idempotently.
- Features: `catalog.customer_offerings.view`, `catalog.customer_offerings.manage`.

## Activation rules

- Order `status === 'confirmed'` (normalized dictionary value).
- Non-subscription: activate immediately (`startsAt = now`).
- Subscription: `pending` until `startsAt <= now`; worker activates.
- Fail closed without customer guardian: skip spawn for that line; leave offering pending/failed state documented in timeline/log.

## Recurrence bound

Case metadata may include `customerOfferingId` + `recurrenceSeriesEndsAt`. Recurrence worker skips creating an occurrence when `nextOccurrenceAt > endsAt`.

## Risks & Impact Review

| Scenario | Severity | Mitigation |
|----------|----------|------------|
| Duplicate cases on order re-save | High | Unique offering per line + spawned_case_ids map |
| Missing guardian | High | Fail closed; no partial spawn |
| Subscription without dates | High | Validation on order line when product is subscription |
| Recurrence past endsAt | Medium | Worker bound check |

## Migration & Backward Compatibility

- Additive columns/tables only.
- Existing `productType` unchanged.
- Default `offeringKind = internal_service`; empty `caseTemplates`.

## Post-MVP extensions

### Manual activation (customer card)

- Operators can activate existing `pending` offerings from the person/company detail **Offerings** tab.
- Manual activate uses `force: true` (bypasses subscription `startsAt` gate). Guardian is still required.
- No create-without-order flow.

### Deactivation / refund reverse

- Command `catalog.customer_offerings.deactivate`: set `status = cancelled`, disable recurrence on spawned cases, close each spawned case (`closedAt` + `statusValue = aborted`) at ORM level (system-safe, no cases ACL).
- Triggers:
  - `sales.order.updated` when order `status === canceled` → deactivate all offerings for `salesOrderId` (including child offerings).
  - `sales.return.created` → deactivate offerings for returned `orderLineId`s (any returned quantity).
- Idempotent: already `cancelled` / `ended` offerings are no-ops.

### Bundle / grouped expansion

- Table `catalog_product_relations` mapped by ORM entity `CatalogProductRelation`.
- On order confirm, if line product `productType` is `bundle` or `grouped`, upsert a root offering for the parent product and child offerings for each related child product (`parentOfferingId` set).
- Uniqueness: `(sales_order_line_id, product_id)` so one line can yield multiple offerings.
- Child offerings inherit subscription window from the order line; activation/deactivation follows the same rules as root offerings.

## Changelog

| Date | Description |
|------|-------------|
| 2026-07-18 | Initial spec for guardian UI, offering kinds, case templates, sales-order activation, subscription window. |
| 2026-07-18 | Post-MVP: manual pending activate on customer card; deactivate on cancel/return with case close; bundle/grouped expansion. |
