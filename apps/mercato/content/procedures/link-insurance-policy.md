---
slug: link-insurance-policy
title: Powiązanie polisy ubezpieczeniowej
audience: internal
contextTags:
  - insurance
  - customers
defaultSlaDuration:
  amount: 1
  unit: days
---

# Powiązanie polisy ubezpieczeniowej

Wspólny leaf używany przy intake obsługi oraz przy szkodzie / kolizji.

## Procedure

- id: start
  kind: start

- id: has-policy
  kind: condition
  label: Czy jest polisa do powiązania?
  conditionMode: manual
  yes:
    - id: pick-policy
      kind: select_entity
      label: Wybierz lub utwórz polisę
      entityKind: insurance_policy
      required: false
      allowCreate: true
  no: []

- id: end
  kind: end
