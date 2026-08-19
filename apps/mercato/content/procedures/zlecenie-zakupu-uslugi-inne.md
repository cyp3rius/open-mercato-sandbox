---
slug: zlecenie-zakupu-uslugi-inne
title: Zlecenie zakupu/usługi * inne, wykraczające poza liste
audience: internal
contextTags:
  - sales
  - customers
  - resources
defaultSlaDuration:
  amount: 7
  unit: days
relatedProcedures:
  - slug: zebranie-danych-klienta
    title: Zebranie potrzebnych danych KL chyba ze Kl jest już w bazie
authoringTodos: []
---

# Zlecenie zakupu/usługi * inne, wykraczające poza liste

Ad-hoc zakup lub usługa poza standardową listą produktów: wytyczne, przegląd
rynku, rekomendacja i decyzja kupna albo rezygnacja.

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
  required: false
  allowCreate: true

- id: collect-guidelines
  kind: action
  label: Zebrać wytyczne
  actionVariant: task
  actionCode: task
  taskTitle: Zbierz wytyczne zlecenia

- id: market-review
  kind: action
  label: Przegląd rynku, oferta, rekomendacja
  actionVariant: task
  actionCode: task
  taskTitle: Przejrzyj rynek, przygotuj ofertę i rekomendację — telefon, potem mail z podsumowaniem

- id: guidelines-mail
  kind: action
  label: Wytyczne — mail
  actionVariant: task
  actionCode: task
  taskTitle: Wyślij wytyczne / podsumowanie mailem

- id: close-or-quit
  kind: action
  label: Kupione zamknięte | brak decyzji / rezygnacja
  actionVariant: task
  actionCode: task
  taskTitle: Domknij sprawę — kupione albo brak decyzji / rezygnacja

- id: end
  kind: end
