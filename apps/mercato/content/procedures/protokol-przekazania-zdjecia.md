---
slug: protokol-przekazania-zdjecia
title: Protokół przekazania + zdjęcia według szablonu
audience: internal
contextTags:
  - resources
  - protocol
  - fragment
defaultSlaDuration:
  amount: 1
  unit: days
relatedProcedures: []
authoringTodos:
  - Podpiąć szablon zdjęć (odbiór / przekazanie / wydanie).
---

# Protokół przekazania + zdjęcia według szablonu

Wspólny wzorzec protokołu ze zdjęciami — odbiór, przekazanie albo wydanie
pojazdu według szablonu.

## Procedure

- id: start
  kind: start

- id: protocol
  kind: action
  label: Sporządź protokół
  actionVariant: task
  actionCode: task
  taskTitle: Sporządź protokół (odbiór albo przekazanie / wydanie)

- id: photos
  kind: action
  label: Zrób zdjęcia według szablonu
  actionVariant: task
  actionCode: task
  taskTitle: Wykonaj i dołącz zdjęcia według obowiązującego szablonu

- id: end
  kind: end
