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
relatedProcedures:
  - slug: client-service-intake
    title: Wprowadzenie klienta do obsługi
  - slug: customer-damage-collision
    title: Postępowanie przy szkodzie / kolizji
authoringTodos: []
---

# Powiązanie polisy ubezpieczeniowej

Jeśli klient ma polisę, powiąż ją ze sprawą. Używane przy wprowadzeniu do obsługi
oraz przy szkodzie lub kolizji.

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
