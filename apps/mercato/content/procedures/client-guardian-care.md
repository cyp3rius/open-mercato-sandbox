---
slug: client-guardian-care
title: Opieka opiekuna klienta
audience: internal
contextTags:
  - customers
  - concierge
  - automotive
defaultSlaDuration:
  amount: 7
  unit: days
relatedProcedures:
  - slug: assign-partner-job
    title: Skierowanie zlecenia do partnera
  - slug: partner-network
    title: Budowa i utrzymanie sieci partnerów
authoringTodos:
  - Ustalić częstotliwość cyklicznego przeglądu opieki (recurrence).
  - Potwierdzić, gdzie lądują faktury i refaktury.
  - Ustalić domyślny kanał kontaktu (telefon vs e-mail).
---

# Opieka opiekuna klienta

Bieżąca opieka po wprowadzeniu klienta do obsługi. Opiekun dba o terminowość:
przebieg, kontakt, potrzeby, odpowiedzi na pytania oraz historię współpracy.

Dodatkowo:

- zapisy w kalendarzu
- zbieranie faktur i rozliczeń (w tym refaktury i rabaty)
- historia: czego klient szukał, co sprawdzał, ustalenia

Klient zwykle kontaktuje się wątkiem mailowym, najczęściej telefonuje.

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

- id: check-mileage
  kind: action
  label: Sprawdź przebieg i terminy
  actionVariant: task
  actionCode: task
  taskTitle: Sprawdź przebieg pojazdu oraz zbliżające się terminy serwisowe / przeglądów / folii / ceramiki

- id: contact-client
  kind: action
  label: Skontaktuj się z klientem
  actionVariant: task
  actionCode: task
  taskTitle: Skontaktuj się z klientem (telefon lub wątek mailowy) — sprawdź potrzeby i odpowiedz na pytania

- id: calendar-followups
  kind: action
  label: Zapisz działania w kalendarzu
  actionVariant: task
  actionCode: task
  taskTitle: Zapisz follow-upy i terminy w kalendarzu opiekuna

- id: collect-invoices
  kind: action
  label: Zbierz FV i rozliczenia
  actionVariant: other
  actionCode: other
  otherInstructions: |
    Zbierz faktury (ile co kosztowało), fakturuj / refakturuj, przypisz rabat jeśli dotyczy.

- id: log-history
  kind: action
  label: Uzupełnij historię klienta
  actionVariant: task
  actionCode: task
  taskTitle: Zapisz zdarzenia — czego klient szukał, co sprawdzał, ustalenia z rozmowy

- id: needs-partner
  kind: condition
  label: Czy potrzebne skierowanie do partnera?
  conditionMode: manual
  yes:
    - id: invoke-assign-partner
      kind: invoke_procedure
      label: Skieruj zlecenie do partnera
      playbookSlugs:
        - assign-partner-job
  no: []

- id: end
  kind: end
