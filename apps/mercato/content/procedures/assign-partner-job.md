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
relatedProcedures:
  - slug: partner-network
    title: Budowa i utrzymanie sieci partnerów
authoringTodos:
  - Po pojawieniu się typu partnera w CRM zaktualizować wybór rekordu.
---

# Skierowanie zlecenia do partnera

Gdy praca ma trafić do partnera z sieci: wybieramy partnera i odnotowujemy
zlecenie. Listę partnerów utrzymujemy w osobnej procedurze.

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
    Brak partnera na liście — najpierw uzupełnij sieć partnerów.

- id: end
  kind: end
