---
slug: partner-network
title: Budowa i utrzymanie sieci partnerów
audience: internal
contextTags:
  - partners
  - automotive
defaultSlaDuration:
  amount: 5
  unit: days
relatedProcedures:
  - slug: assign-partner-job
    title: Skierowanie zlecenia do partnera
authoringTodos:
  - Docelowo dedykowany typ / katalog partnera zamiast firmy-klienta.
  - Ustalić KPI współpracy (wolumen, marża, SLA partnera).
---

# Budowa i utrzymanie sieci partnerów

Budujemy i utrzymujemy listę partnerów: kontakty, warunki i rabaty dla klientów
oraz dane o współpracy. Skierowanie konkretnego zlecenia odbywa się osobną
procedurą.

## Procedure

- id: start
  kind: start

- id: pick-or-create-partner
  kind: select_entity
  label: Wybierz lub utwórz partnera (firma)
  entityKind: customer
  required: true
  allowCreate: true

- id: collect-partner-contact
  kind: action
  label: Uzupełnij dane kontaktowe partnera
  actionVariant: task
  actionCode: task
  taskTitle: Uzupełnij adres, telefony i osoby kontaktowe na rekordzie partnera

- id: negotiate-discounts
  kind: action
  label: Negocjuj rabaty dla klientów
  actionVariant: task
  actionCode: task
  taskTitle: Uzgodnij i zapisz rabaty / warunki handlowe dla naszych klientów

- id: record-business-stats
  kind: action
  label: Zbierz dane o współpracy
  actionVariant: other
  actionCode: other
  otherInstructions: |
    Odnotuj wolumen współpracy z partnerem (ilości zamówień itd.).

- id: end
  kind: end
