---
slug: assign-partner-job
title: Skierowanie zlecenia do partnera
audience: internal
contextTags:
  - partners
  - automotive
defaultSlaDuration:
  amount: 1
  unit: days
---

# Skierowanie zlecenia do partnera

Leaf używany gdy opiekun (lub inny proces) przekazuje pracę partnerowi z sieci.
Utrzymanie samej listy partnerów: `partner-network`.

Partner = rekord `customer` (firma) z listy; brak dedykowanego `entityKind` partnera.

## Z notatek

- Mamy listę partnerów (adresy, telefony, osoby, rabaty)
- Wiemy, gdzie kogo przypisać

## Luki (TODO)

- **Dedykowany typ partnera** — na razie `customer`; po pojawieniu się encji partnera zaktualizować `entityKind`.

## Procedure

- id: start
  kind: start

- id: pick-partner
  kind: select_entity
  label: Wybierz partnera (firma)
  entityKind: customer
  required: true
  allowCreate: false

- id: assign-partner
  kind: action
  label: Odnotuj zlecenie u partnera
  actionVariant: other
  actionCode: other
  otherInstructions: |
    Odnotuj zakres zlecenia, rabat dla klienta i uzgodniony termin.
    Brak partnera na liście → najpierw procedura partner-network.

- id: end
  kind: end
