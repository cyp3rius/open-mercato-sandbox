# Tone and style — Polish operator manuals

## Voice

- **Direct and helpful** — second person plural or imperative („Otwórz listę”, „Wybierz klienta”).
- **Concrete** — name buttons and menu items as they appear in the UI.
- **Short sentences** — one idea per sentence.

## Avoid

| Do not write | Write instead |
|--------------|---------------|
| `cases.view` feature | „uprawnienie do przeglądania spraw” |
| `/backend/cases/create` | „Codzienna praca → Serwis → Sprawy → Utwórz” |
| CrudForm, DataTable | „formularz”, „tabela”, „lista” |
| entityId, UUID | „identyfikator rekordu” only if users must see it; usually omit |
| invoke_procedure | „uruchom powiązaną procedurę” (if playbooks are user-visible) |

## Structure

1. **Context first** — who and why before how.
2. **Navigation path** — always state menu location once per major section.
3. **Numbered steps** — for procedures; bullets for reference lists.
4. **FAQ** — real operator questions, not edge-case API errors.

## Screenshots

- Filename: `apps/docs/static/screenshots/pl/<module>-<screen>.png`
- Alt text in Polish describing what the image shows.
- Call out highlighted UI elements in caption if needed.

## Consistency with English docs

- EN user guides in `apps/docs/docs/user-guide/` are a **content source**, not a literal translation.
- PL manuals may be shorter; match local business terminology (e.g. „sprawa” vs „case”).

## PDF export notes

- Use standard Polish typography (quotes „”, en-dash for ranges).
- Headings map to PDF outline for table of contents.
- Module title on cover = `title` from MDX frontmatter.
