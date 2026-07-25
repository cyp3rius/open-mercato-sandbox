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
---

# Budowa i utrzymanie sieci partnerów

Proces wewnętrzny — lista partnerów, negocjacja rabatów, dane o współpracy.
Skierowanie konkretnego zlecenia do partnera: `assign-partner-job`.

Partner jest zapisywany jako `customer` (firma) — brak dedykowanego `entityKind` partnera w DSL.

## Z notatek

- Tworzymy listę partnerów: adresy, telefony, osoby
- Negocjujemy rabaty dla naszych klientów
- Potem wiemy, gdzie kogo przypisać
- Zbieramy dane o biznesie z partnerami (ilości zamówień itd.)

## Luki (TODO)

- **Encja partnera** — używamy `customer` (firma) do czasu dedykowanego typu / katalogu.
- **Metryki biznesowe** — jakie KPI zbieramy (wolumen, marża, SLA partnera).

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
    TODO: ustalić docelowe pole / raport.

- id: end
  kind: end
