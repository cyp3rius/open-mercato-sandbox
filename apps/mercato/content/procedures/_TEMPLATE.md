---
slug: example-procedure
title: Example procedure
audience: internal
contextTags:
  - example
defaultSlaDuration:
  amount: 1
  unit: days
relatedProcedures:
  - slug: example-related-slug
    title: Example related procedure
authoringTodos:
  - Replace this template with a real client procedure.
---

# Example procedure

Short, clear description for the person who runs this process day to day.
Explain what happens and what a good outcome looks like. No technical jargon.

## Procedure

- id: start
  kind: start

# Authoring only (not shown in CRM body): select_entity for CRM records
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
