---
slug: client-onboarding
title: Onboarding nowego klienta
audience: internal
contextTags:
  - onboarding
  - customers
  - concierge
defaultSlaDuration:
  amount: 2
  unit: days
---

# Onboarding nowego klienta

Procedura przyjęcia nowego klienta do systemu.

1. Kontakt z klientem — zbieramy nazwę oraz informację, czy to firma.
2. Dla firm — dodatkowo pobieramy NIP.
3. Wprowadzamy rekord klienta do systemu.
4. Jeżeli klient jest zainteresowany usługą konsjerż — uruchamiamy proces konsjerż.

## Luki (TODO)

- **Proces konsjerż** — nie jest jeszcze zdefiniowany jako osobna procedura. W gałęzi „tak” poniżej zostawiona jest pusta luka do uzupełnienia (bez `invoke_procedure` / bez slugów playbooka).

## Procedure

- id: start
  kind: start

- id: contact-client
  kind: action
  label: Skontaktuj się z klientem i zbierz dane
  actionVariant: task
  actionCode: task
  taskTitle: Skontaktuj się z klientem — zbierz nazwę oraz informację, czy to firma

- id: is-company
  kind: condition
  label: Klient jest firmą?
  conditionMode: manual
  yes:
    - id: collect-nip
      kind: action
      label: Pobierz NIP
      actionVariant: task
      actionCode: task
      taskTitle: Pobierz NIP firmy i zapisz w notatce sprawy
  no: []

- id: create-customer-record
  kind: action
  label: Wprowadź rekord klienta do systemu
  actionVariant: task
  actionCode: task
  taskTitle: Utwórz rekord klienta w CRM (osoba lub firma) na podstawie zebranych danych

- id: interested-in-concierge
  kind: condition
  label: Klient zainteresowany usługą konsjerż?
  conditionMode: manual
  yes:
    - id: concierge-process-gap
      kind: action
      label: TODO — proces konsjerż (niezdefiniowany)
      actionVariant: other
      actionCode: other
      otherInstructions: |
        TODO: Uzupełnij tę lukę, gdy procedura konsjerż będzie gotowa.
        Preferowane: zamień ten krok na invoke_procedure z playbookSlugs wskazującymi
        na procedurę konsjerż. Na razie nie uruchamiaj żadnego podprocesu.
  no: []

- id: end
  kind: end
