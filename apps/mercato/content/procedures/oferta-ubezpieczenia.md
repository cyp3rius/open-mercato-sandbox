---
slug: oferta-ubezpieczenia
title: Oferta ubezpieczenia
audience: internal
contextTags:
  - insurance
  - sales
  - customers
  - resources
defaultSlaDuration:
  amount: 5
  unit: days
relatedProcedures:
  - slug: zebranie-danych-klienta
    title: Zebranie potrzebnych danych KL chyba ze Kl jest już w bazie
authoringTodos:
  - Podpiąć formularz QR / link dla klienta.
  - Przy 2. wywołaniu z zakupu (po rejestracji) domyślna sugestia decyzji = TAK (wystawić polisę).
  - Podpiąć rejestrację zakupu produktu „Polisa”.
---

# Oferta ubezpieczenia

Jedyna ścieżka ubezpieczeniowa. Zbieramy dane formularzem, przeliczamy składkę,
wystawiamy ofertę na produkt i przekazujemy ją klientowi. Potem pytamy:
czy wystawić polisę? Jeśli nie — kończymy na tę chwilę. Jeśli tak — wystawiamy
polisę, wiążemy ją z pojazdem i rejestrujemy zakup produktu Polisa.

Wejście samodzielne albo z zakupów (po finansowaniu oraz ponownie po rejestracji).

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
  label: Wybierz pojazd, którego dotyczy oferta / polisa
  entityKind: resource
  required: true
  allowCreate: true

- id: collect-form
  kind: action
  label: Zebranie informacji formularzem
  actionVariant: task
  actionCode: task
  taskTitle: |
    Przekaż klientowi formularz (QR / link / dokument) albo wypełnijcie wspólnie — zbierz dane do oferty

- id: calculate-premium
  kind: action
  label: Przeliczenie składki
  actionVariant: task
  actionCode: task
  taskTitle: Przelicz składkę / przygotuj wyliczenie

- id: issue-product-offer
  kind: action
  label: Wystawienie oferty na produkt ubezpieczeniowy
  actionVariant: task
  actionCode: task
  taskTitle: Wystaw ofertę sprzedażową na dany produkt (składka / warunki)

- id: send-offer
  kind: action
  label: Przekazanie oferty klientowi
  actionVariant: task
  actionCode: task
  taskTitle: Przekaż ofertę klientowi

- id: issue-policy-decision
  kind: condition
  label: Czy wystawić polisę?
  conditionMode: manual
  yes:
    - id: issue-policy
      kind: action
      label: Wystawienie polisy
      actionVariant: task
      actionCode: task
      taskTitle: Wystaw polisę ubezpieczeniową
    - id: pick-policy
      kind: select_entity
      label: Wybierz lub utwórz polisę
      entityKind: insurance_policy
      required: true
      allowCreate: true
    - id: link-policy-vehicle
      kind: action
      label: Powiązanie polisy z pojazdem
      actionVariant: task
      actionCode: task
      taskTitle: Powiąż polisę z pojazdem z tej sprawy
    - id: register-policy-product
      kind: action
      label: Rejestracja zakupu produktu Polisa
      actionVariant: task
      actionCode: task
      taskTitle: Zarejestruj zakup produktu „Polisa”
  no: []

- id: end
  kind: end
