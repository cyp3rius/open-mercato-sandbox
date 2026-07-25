---
slug: damage-intake-demo
title: Damage intake (demo)
audience: internal
contextTags:
  - damage
  - demo
defaultSlaDuration:
  amount: 3
  unit: days
relatedProcedures: []
authoringTodos:
  - Demo only — use for import/export pipeline checks.
---

# Damage intake (demo)

Przykładowa procedura przyjęcia szkody: kontakt z klientem, decyzja o eskalacji
do specjalisty albo zamknięcie z notatką.

## Procedure

- id: start
  kind: start

- id: call-customer
  kind: action
  label: Call the customer
  actionVariant: notify
  actionCode: notify
  notifyChannel: email
  notifyTarget: customer
  notifyBody: |
    We have opened your damage case and will follow up shortly.

- id: need-specialist
  kind: condition
  label: Specialist required?
  conditionMode: manual
  yes:
    - id: ask-owner
      kind: action
      label: Escalate to specialist
      actionVariant: task
      actionCode: task
      taskTitle: Assign a specialist for this damage case
  no:
    - id: close-note
      kind: action
      label: Record resolution notes
      actionVariant: other
      actionCode: other
      otherInstructions: Document the resolution and close the case.

- id: end
  kind: end
