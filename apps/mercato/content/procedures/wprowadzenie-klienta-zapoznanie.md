---
slug: wprowadzenie-klienta-zapoznanie
title: Wprowadzenie Klienta | Zapoznanie
audience: internal
contextTags:
  - customers
  - sales
  - onboarding
defaultSlaDuration:
  amount: 3
  unit: days
relatedProcedures:
  - slug: zebranie-danych-klienta
    title: Zebranie potrzebnych danych KL chyba ze Kl jest już w bazie
authoringTodos:
  - Podpiąć formularz BRIEF (załącznik klienta) jako pola szansy / sprawy.
  - Ustalić mapowanie produktów z listy na katalog CRM.
  - Potwierdzić, że szansa (deal) powstaje tylko przy TAK na zainteresowanie Pojazdem.
---

# Wprowadzenie Klienta | Zapoznanie

Wstępny wywiad i wybór produktów. Pytamy: czy klient jest zainteresowany
Pojazdem? Jeśli tak — wypełniamy BRIEF i od razu tworzymy szansę sprzedaży.
Jeśli nie — zapisujemy notatkę z wywiadu.

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

- id: initial-interview
  kind: action
  label: Wstępny wywiad
  actionVariant: other
  actionCode: other
  otherInstructions: |
    Zanotuj kontekst kontaktu (co sprowadza klienta).
    Uzupełnij względem danych klienta: firma vs prywatnie, reprezentant, flota (gdy dotyczy).

- id: pick-current-vehicle
  kind: select_entity
  label: Jakim samochodem Klient jeździ — wybierz lub wprowadź
  entityKind: resource
  required: false
  allowCreate: true

- id: choose-products
  kind: action
  label: Wybór produktu(ów)
  actionVariant: task
  actionCode: task
  taskTitle: |
    Wybierz produkty z listy (folie, powłoki, Concierge, ubezpieczenia, felgi, opony, GPS,
    auta nowe/używane, finansowanie, kamper/bus, szkolenia, OpenTrack, taxi…)

- id: interested-in-vehicle
  kind: condition
  label: Czy klient jest zainteresowany Pojazdem?
  conditionMode: manual
  yes:
    - id: fill-brief
      kind: action
      label: BRIEF — wytyczne obowiązkowe
      actionVariant: other
      actionCode: other
      otherInstructions: |
        Wypełnij BRIEF (formularz):
        finansowanie, budżet, preferencje auta, użytkowanie, must-have / nice-to-have,
        uwagi dodatkowe. Zapisz wytyczne przy sprawie / szansie.
    - id: create-deal
      kind: select_entity
      label: Utwórz szansę sprzedaży
      entityKind: sales_deal
      required: true
      allowCreate: true
  no:
    - id: interview-note
      kind: action
      label: Notatka z wywiadu
      actionVariant: task
      actionCode: task
      taskTitle: Zapisz notatkę z wywiadu / krótkie wytyczne dla wybranego produktu

- id: end
  kind: end
