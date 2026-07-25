---
slug: example-procedure
title: Example procedure
audience: internal
contextTags:
  - example
defaultSlaDuration:
  amount: 1
  unit: days
---

# Example procedure

Replace this file with a real client procedure. Keep workshop narrative above the
`## Procedure` section; only that section is compiled into executable steps.

Stable step identity is the local kebab `id` within the playbook `slug`
(UUID v5 is derived on import). Do not put database block UUIDs in the file.

## Procedure

- id: start
  kind: start

# When the operator must pick or create a CRM record, use select_entity (not a task).
# entityKind: customer | resource | sales_order | sales_quote | sales_deal | insurance_policy
- id: pick-customer
  kind: select_entity
  label: Select customer
  entityKind: customer
  required: true
  allowCreate: true

- id: confirm-intake
  kind: action
  label: Confirm intake details
  actionVariant: task
  actionCode: task
  taskTitle: Confirm intake details with the customer

- id: end
  kind: end
