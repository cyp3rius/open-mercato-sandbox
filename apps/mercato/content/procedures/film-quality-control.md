---
slug: film-quality-control
title: Kontrola jakości aplikacji folii
audience: internal
contextTags:
  - quality
  - automotive
  - film
defaultSlaDuration:
  amount: 1
  unit: days
---

# Kontrola jakości aplikacji folii

Przykład wewnętrznej procedury nadzoru nad serwisem z notatek warsztatowych.
Weryfikacja drugiej osoby → wspólny leaf `service-peer-quality-check`.

## Z notatek

- Sprawujemy nadzór nad serwisem — jak sami nie zadbamy, ciężko oczekiwać tego od innych
- Partnerom / pracownikom / podwykonawcom trzeba napisać zakresy i wytyczne
- Przy foliowaniu samochodów: sprawdzamy po sobie — jeden aplikuje, drugi sprawdza i potwierdza
- Monitoring procesów jest potrzebny — kontrola jakości

## Luki (TODO)

- **Checklista jakości folii** — konkretne punkty (bąble, krawędzie, gwarancja) nie były w notatkach.
- **Inne usługi** (ceramika, detailing, zmiana koloru) — osobne procedury prac + ten sam `service-peer-quality-check`.

## Procedure

- id: start
  kind: start

- id: pick-customer
  kind: select_entity
  label: Wybierz klienta
  entityKind: customer
  required: true
  allowCreate: false

- id: pick-vehicle
  kind: select_entity
  label: Wybierz pojazd
  entityKind: resource
  required: true
  allowCreate: false

- id: share-scope
  kind: action
  label: Przekaż zakres i wytyczne wykonawcy
  actionVariant: task
  actionCode: task
  taskTitle: Przekaż partnerowi / pracownikowi / podwykonawcy pisemny zakres i wytyczne aplikacji folii

- id: apply-film
  kind: action
  label: Aplikacja folii
  actionVariant: task
  actionCode: task
  taskTitle: Wykonaj aplikację folii zgodnie z wytycznymi

- id: run-peer-qc
  kind: invoke_procedure
  label: Kontrola jakości (druga osoba)
  playbookSlugs:
    - service-peer-quality-check
