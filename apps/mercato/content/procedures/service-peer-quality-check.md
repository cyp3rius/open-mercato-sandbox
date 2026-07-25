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
---

# Kontrola jakości (weryfikacja drugiej osoby)

Wspólny leaf z notatek warsztatowych: jeden wykonuje, drugi sprawdza i potwierdza.
Do wywołania po zakończeniu prac (folie, ceramika, detailing itd.).

## Luki (TODO)

- **Checklista per usługa** — punkty kontroli zależą od typu prac; ten leaf jest uniwersalną pętlą weryfikacji.

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
