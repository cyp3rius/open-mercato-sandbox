# Procurement Module — Agent Guidelines

Internal purchasing processes, supplier comparison, specification line items, tasks, and resource handover.

## MUST Rules

1. **MUST follow DataTable list hub pattern** — reference `backend/procurement/processes/page.tsx` (see `backend-module-list-datatable.mdc`)
2. **MUST enforce status pipeline** from settings (`ProcurementStatusPipelineSettings`) on transitions
3. **MUST link suppliers to CRM vendor entities** or free-text labels — see supplier comparison tab
4. **MUST sync process tasks with workflows** user tasks where configured
5. **MUST use dictionary-backed status/type** — seed via `setup.seedDefaults`

## Key Reference Files

| When you need | Copy from |
|---------------|-----------|
| Processes list | `backend/procurement/processes/page.tsx` |
| Process detail (tabs) | `backend/procurement/processes/[id]/page.tsx` |
| Hub redirect | `backend/procurement/page.tsx` |
| Settings (pipeline) | `backend/config/procurement/page.tsx` |
| ACL / setup | `acl.ts`, `setup.ts` |

## Data Model

- **ProcurementProcess** — customer, handler, status, type, optional sales quote/invoice and resource FKs
- **Suppliers / line items** — comparison and winning supplier selection
- **Process tasks** — assignees, workflow sync

## Relations

- **customers** — customer and vendor entities
- **resources** — optional process resource link
- **sales** — optional quote/invoice references
- **workflows** — task sync
- **cases** — reverse link via `procurementProcessId`

## Operator documentation

- Module guide: [`.ai/module-guides/procurement.md`](../../../../.ai/module-guides/procurement.md)
