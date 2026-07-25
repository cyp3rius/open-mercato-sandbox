---
slug: customer-damage-collision
title: Postępowanie przy szkodzie / kolizji
audience: customer_facing
contextTags:
  - damage
  - collision
  - customers
  - guidelines
defaultSlaDuration:
  amount: 1
  unit: days
---

# Postępowanie przy szkodzie / kolizji

Wytyczne dla klientów — wspomniane w notatkach warsztatowych jako przykład customer-facing procedure.
Powiązanie polisy → wspólny leaf `link-insurance-policy`.

## Z notatek

Dla klientów czasem mamy wytyczne postępowania, np.:

- przy zgłoszeniu szkody
- postępowanie w przypadku kolizji

## Luki (TODO)

Warsztat **nie zawiera** kroków szczegółowych. Poniżej szkielet do uzupełnienia z klientem / opiekunami:

- kolejność działań na miejscu zdarzenia
- dokumenty / zdjęcia wymagane do szkody
- kogo powiadomić (opiekun, ubezpieczyciel, policja)
- SLA odpowiedzi opiekuna

Do czasu uzupełnienia kroki oznaczone TODO nie powinny być traktowane jako ostateczna instrukcja dla klienta.

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
  label: Wybierz pojazd (jeśli dotyczy)
  entityKind: resource
  required: false
  allowCreate: false

- id: notify-guardian
  kind: action
  label: TODO — powiadom opiekuna
  actionVariant: notify
  actionCode: notify
  notifyChannel: message
  notifyTarget: owner
  notifyBody: |
    TODO: uzupełnij treść powiadomienia opiekuna o szkodzie / kolizji klienta.

- id: collect-incident-facts
  kind: action
  label: TODO — zbierz informacje o zdarzeniu
  actionVariant: task
  actionCode: task
  taskTitle: TODO — zbierz od klienta fakty zdarzenia, zdjęcia i dokumenty (do uzupełnienia checklisty)

- id: guide-customer
  kind: action
  label: TODO — przekaż wytyczne klientowi
  actionVariant: other
  actionCode: other
  otherInstructions: |
    TODO: wstaw docelową checklistę dla klienta (szkoda / kolizja).
    Na razie nie wysyłaj finalnej instrukcji customer-facing bez akceptacji treści.

- id: run-link-policy
  kind: invoke_procedure
  label: Powiąż polisę
  playbookSlugs:
    - link-insurance-policy
