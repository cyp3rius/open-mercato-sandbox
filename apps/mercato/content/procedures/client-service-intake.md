---
slug: client-service-intake
title: Wprowadzenie klienta do obsługi
audience: internal
contextTags:
  - customers
  - concierge
  - automotive
  - resources
defaultSlaDuration:
  amount: 2
  unit: days
relatedProcedures:
  - slug: link-insurance-policy
    title: Powiązanie polisy ubezpieczeniowej
  - slug: client-guardian-care
    title: Opieka opiekuna klienta
authoringTodos:
  - Ustalić, które dane pojazdu są polami rekordu, a które notatką w sprawie.
  - Doprecyzować automatyczne przypomnienia o serwisach i myciu (częstotliwość / SLA).
  - Przygotować treść powitalnego kontaktu (mail / telefon).
---

# Wprowadzenie klienta do obsługi

Po wydaniu lub rozpoczęciu współpracy zapisujemy zasady obsługi, dane samochodu
i uruchamiamy opiekę.

## Co zapisać

- Wytyczne obsługi klienta
- Dane samochodu: specyfikacja, opony, polisa
- Forma finansowania i czas obsługi
- Koniec finansowania / parametry leasingu (czas, okres, cena samochodu, cena leasingu)
- Zdjęcia samochodu
- Dodatkowe akcesoria (np. folia), jeśli były
- Terminy serwisowe: samochód, folie, ceramika, przeglądy
- Przypomnienia o serwisie akcesoriów oraz o myciu według ustalonych cykli
- Przedstawienie opiekuna, formy zleceń, postępowania i numerów telefonów

## Procedure

- id: start
  kind: start

- id: pick-customer
  kind: select_entity
  label: Wybierz lub utwórz klienta
  entityKind: customer
  required: true
  allowCreate: true

- id: pick-vehicle
  kind: select_entity
  label: Wybierz lub utwórz pojazd
  entityKind: resource
  required: true
  allowCreate: true

- id: capture-guidelines
  kind: action
  label: Zapisz wytyczne obsługi
  actionVariant: task
  actionCode: task
  taskTitle: Zapisz wytyczne obsługi klienta w sprawie / notatkach

- id: capture-vehicle-data
  kind: action
  label: Uzupełnij dane wybranego pojazdu
  actionVariant: other
  actionCode: other
  otherInstructions: |
    Uzupełnij dane pojazdu:
    - specyfikacja
    - opony
    - odniesienie do polisy (powiązanie w kolejnym kroku, jeśli dotyczy)
    - forma finansowania i czas obsługi
    - koniec finansowania / parametry leasingu (czas, okres, cena samochodu, cena leasingu)
    - zdjęcia samochodu
    - dodatkowe akcesoria (np. folia), jeśli były

- id: setup-service-monitoring
  kind: action
  label: Ustaw monitoring terminów serwisowych
  actionVariant: task
  actionCode: task
  taskTitle: Zaplanuj monitoring terminów serwisowych (samochód, folie, ceramika, przeglądy) oraz cykli mycia

- id: introduce-guardian
  kind: action
  label: Przedstaw opiekuna i zasady współpracy
  actionVariant: task
  actionCode: task
  taskTitle: Przedstaw opiekuna, formy zleceń serwisowych, postępowanie oraz numery telefonów

- id: run-link-policy
  kind: condition
  label: Powiązać polisę przed startem opieki?
  conditionMode: manual
  yes:
    - id: invoke-link-policy
      kind: invoke_procedure
      label: Powiąż polisę
      playbookSlugs:
        - link-insurance-policy
  no: []

- id: start-guardian-care
  kind: invoke_procedure
  label: Uruchom opiekę opiekuna
  playbookSlugs:
    - client-guardian-care
