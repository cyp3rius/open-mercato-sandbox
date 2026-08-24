# Resources Module — Agent Guidelines

Typed assets with capacity, scheduling, and optional vehicle/fleet fields. **Requires `planner` module.**

## MUST Rules

1. **MUST configure resource types before resources** — `/backend/resources/resource-types`
2. **MUST use planner availability editor** on resource detail — `AvailabilityRulesEditor`
3. **MUST link to CRM via optional `customerEntityId`** — use `ResourceCustomerLinkField`
4. **MUST use tabbed detail layout** — form, service book, notes, activities, version history
5. **MUST scope by `organization_id`**

## Key Reference Files

| When you need | Copy from |
|---------------|-----------|
| Resources list | `backend/resources/resources/page.tsx` |
| Resource detail | `backend/resources/resources/[id]/page.tsx` |
| Resource types | `backend/resources/resource-types/**` |
| Schedule helpers | planner module + `buildResourceScheduleItems` |
| ACL / setup | `acl.ts`, `setup.ts` |

## Data Model

- **ResourcesResourceType** — name, appearance, vehicle financing flag
- **ResourcesResource** — type, capacity, customer link, status

## Relations

- **planner** (required) — availability rules and schedules
- **customers** — optional customer entity link
- **procurement** — line-item resource FKs
- **insurance_desk** — linked policies on resource detail (app module widget)

## Operator documentation

- Module guide: [`.ai/module-guides/resources.md`](../../../../.ai/module-guides/resources.md)
- EN user guide: `apps/docs/docs/user-guide/resources-and-resource-types.mdx`
