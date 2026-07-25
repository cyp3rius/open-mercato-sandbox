---
slug: client-onboarding
title: Onboarding nowego klienta
audience: internal
contextTags:
  - onboarding
  - customers
  - concierge
defaultSlaDuration:
  amount: 2
  unit: days
---

# Onboarding nowego klienta

Procedura przyjęcia nowego klienta do systemu.

1. Kontakt z klientem — zbieramy nazwę oraz informację, czy to firma.
2. Dla firm — dodatkowo pobieramy NIP.
3. Wybieramy lub tworzymy rekord klienta (`select_entity`).
4. Jeżeli klient jest zainteresowany usługą konsjerż — uruchamiamy proces konsjerż.

## Powiązane procedury

- `sales-customer-meeting` — pełna ścieżka od spotkania do wydania
- `client-service-intake` — wprowadzenie do obsługi (pojazd, terminy, opiekun)
- `client-guardian-care` — bieżąca opieka opiekuna

## Luki (TODO)

- **Abonament konsjerż vs jednorazowa sprzedaż** — warsztat nie rozróżnia ścieżek cenowych; obecnie „zainteresowany konsjerżem” uruchamia intake obsługi.

## Procedure

- id: start
  kind: start

- id: contact-client
  kind: action
  label: Skontaktuj się z klientem i zbierz dane
  actionVariant: task
  actionCode: task
  taskTitle: Skontaktuj się z klientem — zbierz nazwę oraz informację, czy to firma

- id: is-company
  kind: condition
  label: Klient jest firmą?
  conditionMode: manual
  yes:
    - id: collect-nip
      kind: action
      label: Pobierz NIP
      actionVariant: task
      actionCode: task
      taskTitle: Pobierz NIP firmy (do uzupełnienia przy tworzeniu rekordu)
  no: []

- id: pick-or-create-customer
  kind: select_entity
  label: Wybierz lub utwórz klienta
  entityKind: customer
  required: true
  allowCreate: true

- id: interested-in-concierge
  kind: condition
  label: Klient zainteresowany usługą konsjerż?
  conditionMode: manual
  yes:
    - id: start-service-intake
      kind: invoke_procedure
      label: Wprowadzenie do obsługi konsjerż
      playbookSlugs:
        - client-service-intake
  no: []

- id: end
  kind: end
