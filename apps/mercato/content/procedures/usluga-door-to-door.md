---
slug: usluga-door-to-door
title: Usługa door to door
audience: internal
contextTags:
  - service
  - resources
  - customers
defaultSlaDuration:
  amount: 3
  unit: days
relatedProcedures:
  - slug: zebranie-danych-klienta
    title: Zebranie potrzebnych danych KL chyba ze Kl jest już w bazie
  - slug: protokol-przekazania-zdjecia
    title: Protokół przekazania + zdjęcia według szablonu
authoringTodos:
  - Doprecyzować, czy zdjęcia przy przekazaniu do warsztatu / odbiorze mają osobny szablon (dziś lokalnie w krokach).
---

# Usługa door to door

Odbiór auta od klienta, przekazanie do warsztatu lub myjni, odbiór po usłudze
i zwrot z protokołami oraz zdjęciami według szablonu.

## Procedure

- id: start
  kind: start

- id: run-customer-data
  kind: condition
  label: Zebrać dane klienta?
  conditionMode: manual
  yes:
    - id: invoke-customer-data
      kind: invoke_procedure
      label: Zebranie danych klienta
      playbookSlugs:
        - zebranie-danych-klienta
  no: []

- id: pick-vehicle
  kind: select_entity
  label: Którego auta dotyczy — wybierz lub wprowadź
  entityKind: resource
  required: true
  allowCreate: true

- id: purpose-parties
  kind: action
  label: Cel usługi | kto wydaje | kto odbiera
  actionVariant: task
  actionCode: task
  taskTitle: Ustal cel usługi oraz kto wydaje i kto odbiera pojazd

- id: run-protocol-pickup
  kind: condition
  label: Protokół odbioru + zdjęcia?
  conditionMode: manual
  yes:
    - id: invoke-protocol-pickup
      kind: invoke_procedure
      label: Protokół przekazania + zdjęcia
      playbookSlugs:
        - protokol-przekazania-zdjecia
  no: []

- id: to-workshop
  kind: action
  label: Przekazanie do warsztatu / myjni
  actionVariant: task
  actionCode: task
  taskTitle: Przekaż auto do warsztatu, myjni itd. — zdjęcia według szablonu

- id: pickup-from-workshop
  kind: action
  label: Odbiór po usłudze
  actionVariant: task
  actionCode: task
  taskTitle: Odbierz auto — zdjęcia według szablonu

- id: run-protocol-return
  kind: condition
  label: Protokół przekazania Klientowi / wydanie + zdjęcia?
  conditionMode: manual
  yes:
    - id: invoke-protocol-return
      kind: invoke_procedure
      label: Protokół przekazania + zdjęcia
      playbookSlugs:
        - protokol-przekazania-zdjecia
  no: []

- id: end
  kind: end
