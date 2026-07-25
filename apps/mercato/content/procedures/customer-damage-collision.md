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
relatedProcedures:
  - slug: link-insurance-policy
    title: Powiązanie polisy ubezpieczeniowej
authoringTodos:
  - Uzupełnić checklistę na miejscu zdarzenia.
  - Ustalić wymagane dokumenty i zdjęcia.
  - Ustalić, kogo powiadamiać (opiekun, ubezpieczyciel, policja) i SLA odpowiedzi.
---

# Postępowanie przy szkodzie / kolizji

Wytyczne dla klienta przy zgłoszeniu szkody lub kolizji: powiadomienie opiekuna,
zebranie informacji o zdarzeniu, przekazanie instrukcji i powiązanie polisy,
jeśli jest.

Treść instrukcji dla klienta wymaga jeszcze uzupełnienia — do czasu akceptacji
nie wysyłaj finalnej checklisty.

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
  label: Powiadom opiekuna
  actionVariant: notify
  actionCode: notify
  notifyChannel: message
  notifyTarget: owner
  notifyBody: |
    TODO: uzupełnij treść powiadomienia opiekuna o szkodzie / kolizji klienta.

- id: collect-incident-facts
  kind: action
  label: Zbierz informacje o zdarzeniu
  actionVariant: task
  actionCode: task
  taskTitle: Zbierz od klienta fakty zdarzenia, zdjęcia i dokumenty

- id: guide-customer
  kind: action
  label: Przekaż wytyczne klientowi
  actionVariant: other
  actionCode: other
  otherInstructions: |
    Przekaż klientowi ustalone wytyczne postępowania.
    Do czasu akceptacji finalnej checklisty nie wysyłaj jej jako obowiązującej instrukcji.

- id: run-link-policy
  kind: invoke_procedure
  label: Powiąż polisę
  playbookSlugs:
    - link-insurance-policy
