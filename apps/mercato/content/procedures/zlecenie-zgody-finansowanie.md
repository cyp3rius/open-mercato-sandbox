---
slug: zlecenie-zgody-finansowanie
title: Zlecenie uzyskania zgody na Finansowanie
audience: internal
contextTags:
  - sales
  - financing
  - fragment
defaultSlaDuration:
  amount: 5
  unit: days
relatedProcedures: []
authoringTodos:
  - Podpiąć szablon maila zlecenia.
  - Ustalić statusy umowy finansowania w CRM.
---

# Zlecenie uzyskania zgody na Finansowanie

Wspólny blok w zakupach (nowy i używany). Zlecamy zgodę na finansowanie,
przypisujemy opiekuna i śledzimy status umowy.

## Procedure

- id: start
  kind: start

- id: request-financing-approval
  kind: action
  label: Zlecenie uzyskania zgody na finansowanie
  actionVariant: task
  actionCode: task
  taskTitle: Zleć zgodę na finansowanie, przypisz opiekuna i wyślij mail ze szablonu

- id: financing-contract-status
  kind: action
  label: Status umowy finansowania
  actionVariant: task
  actionCode: task
  taskTitle: Potwierdź status umowy finansowania (podpisana / uruchomiona)

- id: end
  kind: end
