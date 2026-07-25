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
relatedProcedures:
  - slug: sales-customer-meeting
    title: Spotkanie z klientem (ścieżka sprzedaży)
  - slug: client-service-intake
    title: Wprowadzenie klienta do obsługi
  - slug: client-guardian-care
    title: Opieka opiekuna klienta
authoringTodos:
  - Rozróżnić ścieżkę abonamentu konsjerż vs jednorazowa sprzedaż, jeśli klient tego wymaga.
---

# Onboarding nowego klienta

Przyjęcie nowego klienta: zbieramy dane, zakładamy kartotekę i — jeśli jest
zainteresowanie konsjerżem — przechodzimy do wprowadzenia do obsługi.

1. Kontakt — nazwa oraz informacja, czy to firma
2. Dla firm — dodatkowo NIP
3. Wybór lub utworzenie klienta w systemie
4. Przy zainteresowaniu konsjerżem — start wprowadzenia do obsługi

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
