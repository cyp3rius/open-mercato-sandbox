---
slug: service-peer-quality-check
title: Kontrola jakości (weryfikacja drugiej osoby)
audience: internal
contextTags:
  - quality
  - automotive
defaultSlaDuration:
  amount: 1
  unit: days
relatedProcedures:
  - slug: film-quality-control
    title: Kontrola jakości aplikacji folii
authoringTodos:
  - Dopisać checklistę jakości per typ usługi (folie, ceramika, detailing…).
---

# Kontrola jakości (weryfikacja drugiej osoby)

Po wykonaniu pracy druga osoba sprawdza efekt i potwierdza jakość.
Przy uwagach — poprawki i ponowna kontrola.
Stosowane po pracach takich jak folie, ceramika czy detailing.

## Procedure

- id: start
  kind: start

- id: peer-check
  kind: condition
  label: Druga osoba potwierdza jakość?
  conditionMode: verification
  yes:
    - id: qc-pass
      kind: action
      label: Potwierdź kontrolę jakości
      actionVariant: other
      actionCode: other
      otherInstructions: Odnotuj pozytywny wynik kontroli jakości (kto sprawdził, kiedy).
  no:
    - id: qc-rework
      kind: action
      label: Poprawki po kontroli
      actionVariant: task
      actionCode: task
      taskTitle: Wykonaj poprawki po negatywnej kontroli jakości
    - id: back-to-check
      kind: goto
      target: peer-check

- id: end
  kind: end
