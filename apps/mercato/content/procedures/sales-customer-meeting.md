---
slug: sales-customer-meeting
title: Spotkanie z klientem (ścieżka sprzedaży)
audience: internal
contextTags:
  - sales
  - customers
  - automotive
defaultSlaDuration:
  amount: 7
  unit: days
---

# Spotkanie z klientem (ścieżka sprzedaży)

Pierwszy proces z warsztatu CRM — od spotkania do wydania.

Rekordy CRM przez `select_entity`: klient, deal (bęben), opcjonalnie oferta, zamówienie.

## Oferta (kontekst produktowy)

Źródło: notatki warsztatowe. Nie jest to osobna procedura — katalog produktów, które mogą pojawić się w briefingu / prezentacji:

- Finansowanie (leasingi, kredyty, pożyczki, finansówki itd.)
- Ubezpieczenia
- Zabezpieczenia pojazdów foliami ochronnymi
- Zmiany koloru samochodu
- Detailing
- Projekty graficzne
- Samochody używane według naszego klucza (sprzedaż i poszukiwanie)
- Samochody nowe (sprzedaż, wynajem, leasing)
- Concierge motoryzacyjny (abonament)
- Custom rentals (rozwiązanie dla ciekawych motoryzacji)
- Zabezpieczenia antywłamaniowe / antykradzieżowe

## Przebieg (z notatek)

1. Spotkanie z klientem
2. Briefing, konsultacja
3. Analiza — wprowadzenie na bęben (deal)
4. Prezentacja, przedstawienie możliwości → realizacja (opcjonalnie oferta)
5. Zamówienie | oczekiwanie
6. Wydanie
7. Po wydaniu — wprowadzenie klienta do obsługi (osobna procedura)

## Luki (TODO)

- **Kryteria „wprowadzenia na bęben”** — warsztat nie precyzuje pól / statusów pipeline.
- **Realizacja vs zamówienie** — granica między ofertą a zamówieniem wymaga doprecyzowania z klientem.
- **SLA per etap** — w notatkach brak konkretnych terminów; poniżej domyślne SLA playbooka.

## Procedure

- id: start
  kind: start

- id: pick-customer
  kind: select_entity
  label: Wybierz lub utwórz klienta
  entityKind: customer
  required: true
  allowCreate: true

- id: meeting
  kind: action
  label: Spotkanie z klientem
  actionVariant: task
  actionCode: task
  taskTitle: Przeprowadź spotkanie z klientem i zanotuj kontekst rozmowy

- id: briefing
  kind: action
  label: Briefing i konsultacja
  actionVariant: task
  actionCode: task
  taskTitle: Przeprowadź briefing / konsultację — potrzeby, budżet, preferencje

- id: pipeline-analysis
  kind: action
  label: Analiza przed wprowadzeniem na bęben
  actionVariant: task
  actionCode: task
  taskTitle: Przeprowadź analizę potrzeb przed utworzeniem dealu na bębnie

- id: pick-or-create-deal
  kind: select_entity
  label: Wprowadź na bęben (deal)
  entityKind: sales_deal
  required: true
  allowCreate: true

- id: present-options
  kind: action
  label: Prezentacja możliwości
  actionVariant: task
  actionCode: task
  taskTitle: Przedstaw możliwości oferty (produkty / usługi z katalogu) i uzgodnij kierunek realizacji

- id: need-quote
  kind: condition
  label: Czy przygotować ofertę (quote)?
  conditionMode: manual
  yes:
    - id: pick-or-create-quote
      kind: select_entity
      label: Wybierz lub utwórz ofertę
      entityKind: sales_quote
      required: true
      allowCreate: true
  no: []

- id: ready-for-order
  kind: condition
  label: Czy jest zamówienie (nie tylko oczekiwanie)?
  conditionMode: manual
  yes:
    - id: pick-or-create-order
      kind: select_entity
      label: Wybierz lub utwórz zamówienie
      entityKind: sales_order
      required: true
      allowCreate: true
  no:
    - id: order-waiting
      kind: action
      label: Oczekiwanie na decyzję / zamówienie
      actionVariant: task
      actionCode: task
      taskTitle: Odnotuj status oczekiwania i monitoruj postęp do momentu zamówienia

- id: handover
  kind: action
  label: Wydanie
  actionVariant: task
  actionCode: task
  taskTitle: Wydaj produkt / usługę klientowi i potwierdź odbiór

- id: start-service-intake
  kind: invoke_procedure
  label: Wprowadzenie klienta do obsługi
  playbookSlugs:
    - client-service-intake
