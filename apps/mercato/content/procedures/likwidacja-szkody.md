---
slug: likwidacja-szkody
title: Likwidacja szkody
audience: internal
contextTags:
  - damage
  - insurance
  - customers
  - resources
defaultSlaDuration:
  amount: 14
  unit: days
relatedProcedures:
  - slug: zebranie-danych-klienta
    title: Zebranie potrzebnych danych KL chyba ze Kl jest już w bazie
  - slug: protokol-przekazania-zdjecia
    title: Protokół przekazania + zdjęcia według szablonu
authoringTodos:
  - Doprecyzować, czy zgłoszenie do ubezpieczyciela / leasingu ma szablony maili.
---

# Likwidacja szkody

Od danych klienta i auta przez zgłoszenie szkody, warsztat, protokoły
ze zdjęciami, aż do wydania pojazdu klientowi.

## Procedure

- id: start
  kind: start

- id: run-customer-data
  kind: condition
  label: Zebrać dane klienta?
  conditionMode: manual
  yes:
    - id: invoke-customer-data
      kind: invoke_procedure
      label: Zebranie danych klienta
      playbookSlugs:
        - zebranie-danych-klienta
  no: []

- id: pick-vehicle
  kind: select_entity
  label: Którego auta dotyczy — wybierz lub wprowadź
  entityKind: resource
  required: true
  allowCreate: true

- id: vehicle-policy-ref
  kind: action
  label: Uzupełnij dane pojazdu i polisy
  actionVariant: other
  actionCode: other
  otherInstructions: |
    Potwierdź / uzupełnij: marka i model, silnik, data I rej., VIN, data produkcji, nr rej.,
    nr polisy (skan polisy).

- id: oc-or-ac
  kind: action
  label: Likwidacja z OC czy z AC — opis zdarzenia
  actionVariant: task
  actionCode: task
  taskTitle: Ustal OC vs AC i wyślij opis zdarzenia mailem

- id: verify-description
  kind: action
  label: Weryfikacja opisu
  actionVariant: task
  actionCode: task
  taskTitle: Zweryfikuj opis zdarzenia

- id: report-insurer
  kind: action
  label: Zgłoszenie szkody do ubezpieczyciela
  actionVariant: task
  actionCode: task
  taskTitle: Zgłoś szkodę do ubezpieczyciela (Klient albo my na podstawie upoważnienia)

- id: report-leasing
  kind: action
  label: Zgłoszenie szkody do leasingu
  actionVariant: task
  actionCode: task
  taskTitle: Zgłoś szkodę do leasingu (upoważnienie do odszkodowania), jeśli dotyczy

- id: pick-workshop
  kind: action
  label: Wybór warsztatu
  actionVariant: task
  actionCode: task
  taskTitle: Wybierz warsztat naprawczy

- id: schedule-inspection
  kind: action
  label: Umówienie oględzin w warsztacie
  actionVariant: task
  actionCode: task
  taskTitle: Umów termin oględzin w warsztacie (data)

- id: run-protocol-handover-1
  kind: condition
  label: Zdanie samochodu — protokół i zdjęcia?
  conditionMode: manual
  yes:
    - id: invoke-protocol-1
      kind: invoke_procedure
      label: Protokół przekazania + zdjęcia
      playbookSlugs:
        - protokol-przekazania-zdjecia
  no: []

- id: schedule-repair
  kind: action
  label: Umówienie terminu likwidacji w warsztacie
  actionVariant: task
  actionCode: task
  taskTitle: Umów termin likwidacji szkody w warsztacie (data)

- id: run-protocol-handover-2
  kind: condition
  label: Ponowne zdanie samochodu — protokół i zdjęcia?
  conditionMode: manual
  yes:
    - id: invoke-protocol-2
      kind: invoke_procedure
      label: Protokół przekazania + zdjęcia
      playbookSlugs:
        - protokol-przekazania-zdjecia
  no: []

- id: pickup-after-repair
  kind: action
  label: Odbiór po naprawie (oględziny)
  actionVariant: task
  actionCode: task
  taskTitle: Odbierz auto po naprawie — oględziny (data)

- id: return-to-customer
  kind: action
  label: Wydanie Klientowi
  actionVariant: task
  actionCode: task
  taskTitle: Wydaj pojazd Klientowi (data)

- id: end
  kind: end
