# Insurance Desk Module — Agent Guidelines

App module (`@app`) — admin UI hub for insurance operations over core **`insurance`** module entities.

## MUST Rules

1. **MUST persist data in core `insurance` module** — this module adds pages, components, inject API, notifications only
2. **MUST gate hub with `insurance_desk.access`** — individual screens use `insurance.*` features
3. **MUST use `navFlat: true`** on sidebar items under Insurance group
4. **MUST support lead inject API** — `POST /api/insurance/leads/inject` for external channels
5. **MUST link policies to catalog coverages and resources** — insured subject

## Key Reference Files

| When you need | Copy from |
|---------------|-----------|
| Dashboard hub | `backend/insurance-desk/page.tsx` |
| Policies / leads / insurers | `backend/insurance-desk/policies/**`, `leads/**`, `insurers/**` |
| Inject API | `api/` (lead inject routes) |
| Core entities | `packages/core/src/modules/insurance/data/entities.ts` |
| ACL / setup | `acl.ts`, `setup.ts` |

## Relations

- **insurance** (core) — leads, policies, insurers
- **catalog** — coverage products
- **resources** — insured subject (e.g. vehicle)
- **customers** — policy holder, contacts
- **partner_programs** — referring partner on leads
- **workflows**, **attachments**, **cases** — integrations per deployment

## Operator documentation

- Module guide: [`.ai/module-guides/insurance-desk.md`](../../../../.ai/module-guides/insurance-desk.md)
- Core insurance ACL: `packages/core/src/modules/insurance/acl.ts`
