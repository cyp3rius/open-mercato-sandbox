# Cases Module — Agent Guidelines

Omnichannel service cases with timeline, message linkage, and playbook-driven procedures. Requires **customers** and **messages** modules.

## MUST Rules

1. **MUST link cases to CRM** via `customerEntityId` when customer context exists
2. **MUST run procedures through playbook engine** — do not bypass `procedureDefinition` execution on case detail
3. **MUST scope queries by `organization_id` and `tenant_id`**
4. **MUST use tabbed detail layout** — Details, Timeline, Messages (see `backend/cases/[id]/page.tsx`)
5. **MUST use `useGuardedMutation`** for non-CrudForm writes on case detail

## Key Reference Files

| When you need | Copy from |
|---------------|-----------|
| List page | `backend/cases/page.tsx` |
| Create page | `backend/cases/create/page.tsx` |
| Detail + procedure | `backend/cases/[id]/page.tsx` |
| Procedure task page | `backend/cases/[id]/procedure-task/[taskId]/page.tsx` |
| Timeline API | `api/[caseId]/timeline/route.ts` |
| ACL | `acl.ts` |
| Setup / recurrence | `setup.ts`, workers `cases-recurrence-check`, `cases-overdue-check` |

## Data Model

- **Case** — title, status, owner, due date, priority; optional FKs: `customerEntityId`, `resourceId`, `procurementProcessId`, `insurancePolicyId`
- **Timeline events** — append-only `cases_timeline_events`

## Relations

- **playbooks** — procedure execution and bindings
- **messages** — `caseId` on messages; Messages tab
- **procurement**, **insurance**, **resources** — optional FK links
- **attachments** — detail section

## Operator documentation

- Module guide: [`.ai/module-guides/cases.md`](../../../../.ai/module-guides/cases.md)
- In-CRM procedures: [`procedure-authoring`](../../../../.ai/skills/procedure-authoring/SKILL.md) skill
- PL user manual (pilot): `apps/docs/docs/user-guide/pl/cases.mdx`
