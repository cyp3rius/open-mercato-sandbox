# Polish user manual template (MDX)

Use for `apps/docs/docs/user-guide/pl/<module>.mdx`. Write for **non-technical operators** in Polish.

## Frontmatter

```yaml
---
title: <Tytuł modułu — np. Obsługa spraw>
description: <Krótki opis dla wyszukiwarki i spisu treści>
---
```

## Required sections

```markdown
## Dla kogo jest ten moduł

1–2 zdania: rola (np. konsultant, koordynator) i cel biznesowy.

## Gdzie znaleźć w systemie

Ścieżka w menu: **Codzienna praca → <Sekcja> → <Pozycja>**.

<!-- Opcjonalnie: ![Zrzut ekranu](/screenshots/pl/<module>-list.png) -->

## Co można zrobić

Krótka lista możliwości (bullet points, bez żargonu technicznego).

## Instrukcje krok po kroku

### <Zadanie 1 — np. Utworzenie nowej sprawy>

1. Otwórz …
2. Kliknij …
3. Wypełnij pole …
4. Zapisz.

### <Zadanie 2>

1. …

## Uprawnienia

Kto może przeglądać, tworzyć, edytować (język biznesowy, nie identyfikatory feature).

## Powiązania z innymi modułami

Krótko: z czym ten moduł współpracuje i kiedy przejść gdzie indziej.

## Częste pytania

**Pytanie:** …  
**Odpowiedź:** …

## Powiązane materiały

- Linki do innych instrukcji PL w docs (jeśli istnieją).
```

## Rules (PL operator copy)

- Forma grzecznościowa: „Otwórz”, „Kliknij”, „Wybierz”.
- **Nie** podawaj ścieżek plików, identyfikatorów API, slugów playbooków ani DSL.
- **Nie** używaj angielskich nazw klas/komponentów.
- Nazwy pól UI — jak w interfejsie (z i18n PL jeśli dostępne).
- Kroki numerowane; jeden krok = jedna akcja użytkownika.
- Długość: 1–3 strony A4 po eksporcie PDF na moduł (rozszerzaj tylko gdy moduł tego wymaga).
