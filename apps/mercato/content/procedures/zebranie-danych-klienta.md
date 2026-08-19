---
slug: zebranie-danych-klienta
title: Zebranie potrzebnych danych KL chyba ze Kl jest już w bazie
audience: internal
contextTags:
  - customers
  - fragment
defaultSlaDuration:
  amount: 1
  unit: days
relatedProcedures: []
authoringTodos:
  - Potwierdzić, które pola są obowiązkowe zawsze, a które tylko „gdy dotyczy”.
---

# Zebranie potrzebnych danych KL chyba ze Kl jest już w bazie

Wspólny start większości procesów. Wybieramy klienta z bazy albo zakładamy
nowego i uzupełniamy podstawowe dane kontaktowe.

## Procedure

- id: start
  kind: start

- id: pick-customer
  kind: select_entity
  label: Wybierz lub utwórz klienta
  entityKind: customer
  required: true
  allowCreate: true

- id: confirm-customer-data
  kind: action
  label: Uzupełnij lub potwierdź dane klienta
  actionVariant: other
  actionCode: other
  otherInstructions: |
    Sprawdź / uzupełnij:
    - imię i nazwisko
    - firma
    - NIP
    - mail
    - telefon
    - od kiedy do kiedy obsługa (gdy dotyczy)
    - adres do korespondencji (gdy dotyczy)

- id: end
  kind: end
