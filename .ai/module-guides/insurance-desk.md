---
moduleId: insurance_desk
sidebarSection: Insurance
sidebarPaths:
  - /backend/insurance-desk
  - /backend/insurance-desk/policies
  - /backend/insurance-desk/leads
  - /backend/insurance-desk/insurers
relatedModules:
  - insurance
  - catalog
  - resources
  - customers
  - partner_programs
  - workflows
  - attachments
  - cases
existingUserGuideEn: []
plManualStatus: not_started
---

# Insurance desk

## Purpose and audience

**Admin UI hub** for insurance operations over the core **insurance** module: insurers, policies, inquiries (leads), catalog coverages, and resource-linked subjects. For insurance desk staff handling leads, policies, and insurer master data.

App module: `apps/mercato/src/modules/insurance_desk/`. Persisted entities live in `packages/core/src/modules/insurance/`.

## Sidebar navigation

All items use `navFlat: true` under **Insurance** group:

| Menu label (i18n key) | Path | Required feature |
|-----------------------|------|------------------|
| Dashboard | `/backend/insurance-desk` | `insurance_desk.access` |
| Policies | `/backend/insurance-desk/policies` | `insurance.policies.view` |
| Inquiries | `/backend/insurance-desk/leads` | `insurance_desk.access` + `insurance.leads.view` |
| Insurers | `/backend/insurance-desk/insurers` | `insurance.insurers.view` |
| Config | `/backend/config/insurances` | `insurance.config.manage` |

## Key screens

### Dashboard
- **Path:** `/backend/insurance-desk`
- Links to policies, inquiries, insurers, config.

### Policies
- List, create, detail — coverages from **catalog**, subject from **resources**, attachments, insurer contacts.

### Inquiries (leads)
- List, create, detail — manual intake or inject API from external channels (e.g. Strapi).

### Insurers
- List, create, detail — insurer records and contacts panel.

### Config
- Dictionary-driven statuses, protection scope, policy list color rules.

## Main workflows

### 1. Register an inquiry
1. **Daily work → Insurance → Inquiries** → Create.
2. Enter lead data; optional referring partner and attachments.
3. Or receive via inject API (`insurance_desk.leads.inject`).

### 2. Convert inquiry to policy
1. From lead detail, create policy (prefill from lead).
2. Notification `insurance_desk.policies.from_enquiry` when configured.

### 3. Manage policy lifecycle
1. Link catalog coverages and insured resource (e.g. vehicle).
2. Track expiry; expiring-policy notifications (`insurance_desk.policies.expiring.notify`).

### 4. Maintain insurers
1. **Insurers** → create insurer and contacts.

## Roles and permissions

**Insurance desk features:**

| Feature ID | What it allows | Default roles |
|------------|----------------|---------------|
| `insurance_desk.access` | Hub access | admin, employee |
| `insurance_desk.leads.inject` | External lead inject | admin only |
| `insurance_desk.*.notify` | Inject/expiry/enquiry notifications | admin, employee |

**Core insurance CRUD:** `insurance.insurers.*`, `insurance.policies.*`, `insurance.leads.*`, `insurance.config.manage` — admin full; employee view on insurers/policies/leads.

## Relations to other modules

- **insurance** (core) — all persisted entities.
- **catalog** — coverage products/options.
- **resources** — insured subject (vehicle, etc.).
- **customers** — policy holder / contacts.
- **partner_programs** — referring partner on leads.
- **cases** — optional `insurancePolicyId` on cases.
- **attachments** — lead/policy documents.
- **workflows** — required module dependency.

## Common pitfalls and FAQ

- **Q:** Cannot create policy? **A:** Need `insurance.policies.manage`, not only view.
- **Q:** Lead from website? **A:** Uses inject API + `lead_intake` / Strapi integration — document per deployment.

## Authoring todos

- [ ] Document Strapi/lead_intake setup for this sandbox.
- [ ] Confirm Polish labels for inquiry vs lead in UI copy.
- [ ] Screenshot policy detail with resource link.
