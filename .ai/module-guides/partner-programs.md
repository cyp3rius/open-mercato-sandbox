---
moduleId: partner_programs
sidebarSection: Clients
sidebarPaths:
  - /backend/partner_programs/programs
relatedModules:
  - customers
  - sales
  - currencies
existingUserGuideEn: []
plManualStatus: not_started
---

# Partner programs

## Purpose and audience

**Partner loyalty and B2B agreement programs** tied to CRM partner entities (distinct from procurement suppliers). For partnership managers defining programs, memberships, incentive accrual from sales, and payouts.

## Sidebar navigation

| Menu label (i18n key) | Path | Required feature |
|-----------------------|------|------------------|
| Partner programs | `/backend/partner_programs/programs` | `partner_programs.view` |
| Module settings | `/backend/config/partner_programs` | `partner_programs.settings.manage` |

## Key screens

### List
- **Path:** `/backend/partner_programs/programs`
- All programs with validity and incentive settings.

### Create
- **Path:** `/backend/partner_programs/programs/create`
- Name, validity window, incentive percent (0–100), base (`net` | `gross`).

### Detail
- **Path:** `/backend/partner_programs/programs/[id]`
- Tabs: **Program details**, **Partners** (memberships).

### CRM injection
- Widget on **customer person/company detail**: balance, accrue, payouts (`partner_programs.injection.partner-incentives`).

## Main workflows

### 1. Define a program
1. **Daily work → Clients → Partner programs** → Create.
2. Set name, validity, incentive % and base (net/gross).
3. Save.

### 2. Add partner memberships
1. Open program detail → **Partners** tab.
2. Attach CRM customer entities with optional role.

### 3. Accrual from sales
- Subscribers on `sales.order.created/updated` create ledger entries (`partner_programs.incentive.accrued`).

### 4. Record payout
1. Use payout API/UI (`partner_programs.manage_payouts`).
2. Or record from customer detail partner tab.

## Roles and permissions

| Feature ID | What it allows | Default roles |
|------------|----------------|---------------|
| `partner_programs.view` | View programs | admin, employee |
| `partner_programs.create` | Create programs | admin only |
| `partner_programs.edit` | Edit programs | admin only |
| `partner_programs.delete` | Delete programs | admin only |
| `partner_programs.manage_memberships` | Partner memberships | admin, employee |
| `partner_programs.manage_payouts` | Payouts | admin, employee |
| `partner_programs.settings.manage` | Settings | admin only |

## Relations to other modules

- **customers** — memberships keyed by `customerEntityId`; detail tab widget.
- **sales** — accrual from orders/invoices.
- **currencies** — ledger `currencyCode`.

## Common pitfalls and FAQ

- **Q:** Partner vs supplier? **A:** Partner programs use CRM partners; procurement suppliers are a separate concept.
- **Q:** Manual accrual? **A:** Available on customer detail partner tab for adjustments.

## Authoring todos

- [ ] Confirm payout approval workflow with finance.
- [ ] Screenshot customer detail partner incentives tab.
