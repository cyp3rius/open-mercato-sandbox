# Polish user guides (instrukcje obsługi)

Operator-facing manuals in Polish for **Daily work** sidebar modules. English developer and user docs remain under `user-guide/` (without `pl/`).

## Status (phase 2)

All 12 module manuals are published under `apps/docs/docs/user-guide/pl/` and registered in `apps/docs/sidebars.ts` under **User Guide (PL)**.

Excluded: `taxi_fleet` (Fleet section), `accounting` (Accounting section).

## Authoring

1. Update the English module guide: `.ai/module-guides/<module>.md`
2. Follow the skill: `.ai/skills/user-guide-authoring/SKILL.md`
3. Create or edit: `apps/docs/docs/user-guide/pl/<module>.mdx`
4. Register the page in `apps/docs/sidebars.ts` under **User Guide (PL)**

Template: `.ai/skills/user-guide-authoring/references/user-manual-pl-template.md`

## PDF export

From repository root (requires [pandoc](https://pandoc.org/) and a PDF engine such as `tectonic` or `xelatex`):

```bash
# Single module
.ai/skills/user-guide-authoring/scripts/export-pdf.sh cases

# All modules (except overview)
.ai/skills/user-guide-authoring/scripts/export-all-pdf.sh

# Merge into one PDF (with table of contents)
.ai/skills/user-guide-authoring/scripts/export-combined-pdf.sh
```

Output: `apps/docs/static/manuals/pl/<module>.pdf` and combined `codzienna-praca-pelna.pdf` (includes **Spis treści**).

## Coverage

See `.ai/skills/user-guide-authoring/references/coverage-matrix.md` and `.ai/module-guides/INDEX.md`.

## Module index (PL)

| Slug | Title |
|------|-------|
| `dashboard` | Pulpit |
| `messages` | Wiadomości |
| `workflows-tasks` | Zadania |
| `customers` | Klienci |
| `partner-programs` | Programy partnerskie |
| `sales-simple` | Sprzedaż |
| `catalog-products` | Produkty |
| `resources` | Zasoby |
| `procurement` | Zakupy |
| `cases` | Sprawy |
| `playbooks` | Procedury |
| `insurance-desk` | Ubezpieczenia |
