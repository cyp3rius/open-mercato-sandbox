---
slug: zakup-leasing-wynajem-samochodu-nowego
title: Zakup Leasing, wynajem samochodu nowego
audience: internal
contextTags:
  - sales
  - automotive
  - financing
defaultSlaDuration:
  amount: 30
  unit: days
relatedProcedures:
  - slug: zebranie-danych-klienta
    title: Zebranie potrzebnych danych KL chyba ze Kl jest już w bazie
  - slug: zlecenie-zgody-finansowanie
    title: Zlecenie uzyskania zgody na Finansowanie
  - slug: obsluga-concierge-uruchomienie
    title: Obsługa Concierge - uruchomienie
  - slug: oferta-ubezpieczenia
    title: Oferta ubezpieczenia
authoringTodos:
  - Przy 2. wywołaniu Oferty ubezpieczenia (po rejestracji) sugestia decyzji = wystawić polisę.
  - Opcjonalnie: czytać BRIEF / szansę z zapoznania zamiast zbierać wytyczne od zera.
---

# Zakup Leasing, wynajem samochodu nowego

Ścieżka nowego auta: umowa i zamówienie, finansowanie, potem Concierge,
pierwsza ścieżka ubezpieczenia, propozycja usług, rejestracja, ponowna
ścieżka ubezpieczenia (sugerowane wystawienie polisy) i wydanie.

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

- id: sign-contract
  kind: action
  label: Podpisanie umowy
  actionVariant: task
  actionCode: task
  taskTitle: Podpisz umowę — skan do katalogu Klient

- id: deposit
  kind: action
  label: Zaliczka
  actionVariant: task
  actionCode: task
  taskTitle: Ustal zaliczkę TAK/NIE i potwierdź wpłatę

- id: order-dealer
  kind: action
  label: Zamówienie u dealera / dostawcy
  actionVariant: task
  actionCode: task
  taskTitle: Złóż zamówienie u dealera / dostawcy

- id: delivery-date
  kind: action
  label: Termin dostawy
  actionVariant: task
  actionCode: task
  taskTitle: Wprowadź termin dostawy (alert miesiąc przed)

- id: status-ordered
  kind: action
  label: Potwierdzenie realizacji — status zamówiony
  actionVariant: task
  actionCode: task
  taskTitle: Potwierdź status realizacji — zamówiony

- id: status-production
  kind: action
  label: Status produkcji
  actionVariant: task
  actionCode: task
  taskTitle: Zaktualizuj status produkcji

- id: run-financing
  kind: condition
  label: Uruchomić finansowanie?
  conditionMode: manual
  yes:
    - id: invoke-financing
      kind: invoke_procedure
      label: Zlecenie zgody na finansowanie
      playbookSlugs:
        - zlecenie-zgody-finansowanie
  no: []

- id: run-concierge
  kind: condition
  label: Uruchomienie procesu Concierge
  conditionMode: manual
  yes:
    - id: invoke-concierge
      kind: invoke_procedure
      label: Obsługa Concierge - uruchomienie
      playbookSlugs:
        - obsluga-concierge-uruchomienie
  no: []

- id: run-insurance-quote
  kind: condition
  label: Ubezpieczenie przeliczenie — uruchomić Ofertę ubezpieczenia?
  conditionMode: manual
  yes:
    - id: invoke-insurance-1
      kind: invoke_procedure
      label: Oferta ubezpieczenia
      playbookSlugs:
        - oferta-ubezpieczenia
  no: []

- id: propose-services
  kind: action
  label: Propozycja usług
  actionVariant: task
  actionCode: task
  taskTitle: |
    Zaproponuj usługi (telefon): folie, powłoki, opony, felgi, gannet — mail ze szablonu

- id: client-service-choice
  kind: action
  label: Co wybrał Klient z usług
  actionVariant: task
  actionCode: task
  taskTitle: Zanotuj, które usługi wybrał Klient

- id: prep-registration-docs
  kind: action
  label: Zlecenie przygotowania dokumentów do rejestracji
  actionVariant: task
  actionCode: task
  taskTitle: Zleć przygotowanie dokumentów do rejestracji

- id: registration
  kind: action
  label: Rejestracja
  actionVariant: task
  actionCode: task
  taskTitle: Przeprowadź rejestrację pojazdu

- id: run-insurance-policy
  kind: condition
  label: Wystawienie polisy — uruchomić Ofertę ubezpieczenia (sugestia TAK)?
  conditionMode: manual
  yes:
    - id: invoke-insurance-2
      kind: invoke_procedure
      label: Oferta ubezpieczenia
      playbookSlugs:
        - oferta-ubezpieczenia
  no: []

- id: schedule-handover
  kind: action
  label: Umówienie wydania
  actionVariant: task
  actionCode: task
  taskTitle: Umów wydanie (data)

- id: handover
  kind: action
  label: Wydanie
  actionVariant: task
  actionCode: task
  taskTitle: Wydaj pojazd (data)

- id: end
  kind: end
