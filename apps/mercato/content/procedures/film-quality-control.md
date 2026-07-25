---
slug: film-quality-control
title: Kontrola jakości aplikacji folii
audience: internal
contextTags:
  - quality
  - automotive
  - film
defaultSlaDuration:
  amount: 1
  unit: days
relatedProcedures:
  - slug: service-peer-quality-check
    title: Kontrola jakości (weryfikacja drugiej osoby)
authoringTodos:
  - Dopisać checklistę jakości folii (bąble, krawędzie, gwarancja…).
  - Analogiczne procedury dla ceramiki, detailingu, zmiany koloru + ta sama kontrola jakości.
---

# Kontrola jakości aplikacji folii

Nadzór nad foliowaniem: przekazujemy wytyczne wykonawcy, aplikujemy folię,
a druga osoba sprawdza i potwierdza jakość.

## Procedure

- id: start
  kind: start

- id: pick-customer
  kind: select_entity
  label: Wybierz klienta
  entityKind: customer
  required: true
  allowCreate: false

- id: pick-vehicle
  kind: select_entity
  label: Wybierz pojazd
  entityKind: resource
  required: true
  allowCreate: false

- id: share-scope
  kind: action
  label: Przekaż zakres i wytyczne wykonawcy
  actionVariant: task
  actionCode: task
  taskTitle: Przekaż partnerowi / pracownikowi / podwykonawcy pisemny zakres i wytyczne aplikacji folii

- id: apply-film
  kind: action
  label: Aplikacja folii
  actionVariant: task
  actionCode: task
  taskTitle: Wykonaj aplikację folii zgodnie z wytycznymi

- id: run-peer-qc
  kind: invoke_procedure
  label: Kontrola jakości (druga osoba)
  playbookSlugs:
    - service-peer-quality-check
