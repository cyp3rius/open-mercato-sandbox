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
---

# Opieka opiekuna klienta

Bieżąca odpowiedzialność opiekuna po wprowadzeniu klienta do obsługi.

Skierowanie do partnera → `assign-partner-job` (lista partnerów: `partner-network`).

## Obowiązki (z notatek)

Opiekun musi zadbać o terminowość:

- monitorować przebieg
- kontaktować się z klientem
- sprawdzać potrzeby
- reagować na pytania i potrzeby
- zapisywać zdarzenia

Dodatkowo:

- zapisywać w kalendarzu
- zbierać FV — ile co kosztowało
- fakturować / refakturować
- przypisywać rabat
- zapisywać historię z klientem (czego szukał, co sprawdzał)

Kontakt klienta: zwykle utworzony wątek mailowy, najczęściej telefon.

## Luki (TODO)

- **Recurrence / cykliczne uruchamianie** — opieka jest ciągła; warsztat nie definiuje częstotliwości przeglądu (np. co tydzień).
- **Integracja fakturowania** — brak wskazania, czy FV idą do sales/accounting, czy tylko jako załączniki.
- **Kanał kontaktu domyślny** — telefon vs e-mail; poniżej krok zadaniowy bez automatycznego notify.

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
    TODO: potwierdzić docelowy moduł rozliczeń (brak entityKind dla FV w select_entity).

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
