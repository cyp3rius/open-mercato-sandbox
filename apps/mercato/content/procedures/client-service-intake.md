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
---

# Wprowadzenie klienta do obsługi

Proces po wydaniu / rozpoczęciu współpracy — zapis wytycznych, danych pojazdu i uruchomienie opieki.

Współdzielone kroki:

- polisa → `link-insurance-policy`
- opieka → `client-guardian-care`

## Co zapisać (z notatek)

- Wytyczne obsługi klienta
- Dane samochodu: specyfikacja, opony, polisa
- Forma finansowania i czas obsługi
- Koniec finansowania / parametry leasingu: czas, okres, cena samochodu, cena leasingu
- Zdjęcia samochodu
- Dodatkowe akcesoria (np. folia), jeśli były
- Monitoring terminów serwisowych: samochód, folie, ceramika, przeglądy
- Folie, ceramiki i inne akcesoria wymagają serwisu — trzeba o tym pamiętać
- Mycie samochodu według odpowiednich cykli — przypominać, sugerować, umawiać myjnie
- Przedstawienie opiekuna, formy zleceń serwisowych, postępowania, numery telefonów

## Luki (TODO)

- **Model danych pojazdu / resource** — które pola idą do resource, a które do notatek sprawy.
- **Automatyczne przypomnienia** (serwisy, mycie) — w notatkach jest potrzeba, brak reguł SLA/recurrence.
- **Szablon maila / wątku kontaktowego** — klient kontaktuje się zwykle wątkiem mailowym lub telefonem; brak gotowej treści powitalnej.

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
  label: Wybierz lub utwórz pojazd (resource)
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
    Na rekordzie pojazdu (resource) uzupełnij:
    - specyfikacja
    - opony
    - odniesienie do polisy (powiązanie encji — kolejny krok)
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
