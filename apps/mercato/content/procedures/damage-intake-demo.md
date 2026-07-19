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
---

# Damage intake (demo)

Demo procedure for the MD → playbooks apply pipeline. Review this document with
the client, then apply with:

```bash
yarn mercato playbooks apply --tenant <tenantId> --org <organizationId> --file apps/mercato/content/procedures/damage-intake-demo.md
```

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
