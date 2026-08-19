---
slug: obsluga-concierge-uruchomienie
title: Obsługa Concierge - uruchomienie
audience: internal
contextTags:
  - concierge
  - customers
  - resources
defaultSlaDuration:
  amount: 2
  unit: days
relatedProcedures:
  - slug: zebranie-danych-klienta
    title: Zebranie potrzebnych danych KL chyba ze Kl jest już w bazie
authoringTodos:
  - Podpiąć rejestrację zakupu produktu Concierge z szablonem spraw cyklicznych (Concierge opieka — nie osobna procedura).
  - Podpiąć szablon maila witającego.
  - Ustalić, które pola pojazdu są na rekordzie, a które w sprawie.
---

# Obsługa Concierge - uruchomienie

Start opieki Concierge: dane klienta, bogate dane pojazdu, mail witający
oraz rejestracja zakupu produktu Concierge (szablon spraw cyklicznych —
kontakt miesięczny, monitoring dat, myjnia, prezentacja oferty).

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
  label: Wybierz lub utwórz pojazd
  entityKind: resource
  required: true
  allowCreate: true

- id: capture-vehicle-data
  kind: action
  label: Uzupełnij dane pojazdu Concierge
  actionVariant: other
  actionCode: other
  otherInstructions: |
    Uzupełnij dane pojazdu:
    - marka i model, silnik (pojemność i moc), rok produkcji, nr rej., data I rejestracji, VIN
    - specyfikacja (PDF), stan licznika, deklarowany przebieg roczny
    - zdjęcia (cztery po przekątnej, środek przód/tył, bagażnik)
    - opony zima/lato (marka, model, rozmiar); używany: głębokość bieżnika
    - felgi: jeden komplet czy dwa
    - data badania technicznego → kalendarz
    - rocznica polisy → kalendarz + alert miesiąc przed; numer polisy + skan
    - interwały olejowe vs wytyczne serwisu → data przeglądu + alert 2 tyg. przed
    - parametry leasingu / najmu + daty końca → kalendarz
    - folia / powłoka: TAK/NIE, kiedy aplikowana, następny serwis

- id: welcome-mail
  kind: action
  label: Mail witający
  actionVariant: notify
  actionCode: notify
  notifyChannel: email
  notifyTarget: customer
  notifyBody: |
    Wyślij mail witający według szablonu Concierge.

- id: register-concierge-product
  kind: action
  label: Zarejestruj zakup produktu Concierge
  actionVariant: task
  actionCode: task
  taskTitle: Zarejestruj zakup produktu Concierge z szablonem spraw cyklicznych (opieka)

- id: end
  kind: end
