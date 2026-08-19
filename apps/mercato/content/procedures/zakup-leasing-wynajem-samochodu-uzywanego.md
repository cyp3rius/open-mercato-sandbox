---
slug: zakup-leasing-wynajem-samochodu-uzywanego
title: Zakup leasing, wynajem samochodu używanego
audience: internal
contextTags:
  - sales
  - automotive
  - financing
defaultSlaDuration:
  amount: 21
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
  - slug: wprowadzenie-klienta-zapoznanie
    title: Wprowadzenie Klienta | Zapoznanie
authoringTodos:
  - Czytać BRIEF / szansę z zapoznania jako wytyczne Klienta.
  - Przy 2. wywołaniu Oferty ubezpieczenia sugestia = wystawić polisę.
---

# Zakup leasing, wynajem samochodu używanego

Ścieżka używanego: oferty według wytycznych (BRIEF), decyzja i umowa,
finansowanie (opcjonalnie), Concierge, ubezpieczenie, usługi (szerszy katalog),
rejestracja, ponowne ubezpieczenie ze sugestią polisy, wydanie.

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

- id: collect-offers
  kind: action
  label: Zebranie dostępnych ofert
  actionVariant: other
  actionCode: other
  otherInstructions: |
    Zbierz oferty pasujące do wytycznych.
    Wytyczne RS: pewność źródła, ASO na bieżąco, przegląd ≤ rok, bezwypadkowość
    (brak uszkodzeń konstrukcyjnych i zawieszenia) — *nie dotyczy floty RS.
    Wytyczne Klienta: BRIEF (z zapoznania / szansy, jeśli jest).

- id: mail-offer
  kind: action
  label: Mail z danymi auta
  actionVariant: task
  actionCode: task
  taskTitle: |
    Wyślij mail: marka, model, silnik, skrzynia, rocznik, przebieg, wyposażenie, kolor
    (opcjonalnie zdjęcia poglądowe)

- id: client-decision
  kind: action
  label: Decyzja Klienta | raport oględziny
  actionVariant: other
  actionCode: other
  otherInstructions: |
    Decyzja Klienta. Raport oględzin: źródła zewnętrzne — dojazd płatny przez Klienta;
    stok RS — bez kosztu dojazdu.

- id: preliminary-contract
  kind: action
  label: Umowa sprzedaży (przedwstępna)
  actionVariant: task
  actionCode: task
  taskTitle: Przygotuj i podpisz umowę sprzedaży (przedwstępną)

- id: run-financing
  kind: condition
  label: Uruchomić finansowanie (opcjonalnie)?
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
    Zaproponuj usługi (telefon): folie, powłoki, opony, felgi, gannet, korekta lakieru,
    pranie tapicerki, ozonowanie — mail ze szablonu

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
