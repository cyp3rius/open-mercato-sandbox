# Coverage matrix — Daily work sidebar modules

Excludes `taxi_fleet` (Fleet section) and `accounting` (Accounting section) from PL operator manuals. Updated after phase 2 (PL manuals).

| Module guide | Module ID | Sidebar path(s) | EN user-guide (apps/docs) | Module guide (`.ai/module-guides/`) | PL manual (`user-guide/pl/`) | PDF |
|--------------|-----------|-----------------|---------------------------|-------------------------------------|------------------------------|-----|
| dashboard.md | — | `/backend` | partial (`overview.mdx`) | draft | published (`dashboard.mdx`) | yes |
| messages.md | messages | `/backend/messages` | none | draft | published (`messages.mdx`) | yes |
| workflows-tasks.md | workflows | `/backend/tasks` | partial (`workflows/user-tasks.mdx`) | draft | published (`workflows-tasks.mdx`) | yes |
| customers.md | customers | `/backend/customers/*` | yes (`customers/`) | draft | published (`customers.mdx`) | yes |
| partner-programs.md | partner_programs | `/backend/partner_programs/programs` | none | draft | published (`partner-programs.mdx`) | yes |
| sales-simple.md | sales + customers | `/backend/sales/simple-*` | partial (sales docs) | draft | published (`sales-simple.mdx`) | yes |
| catalog-products.md | catalog | `/backend/catalog/products` | partial | draft | published (`catalog-products.mdx`) | yes |
| resources.md | resources | `/backend/resources/*` | yes | draft | published (`resources.mdx`) | yes |
| procurement.md | procurement | `/backend/procurement` | none | draft | published (`procurement.mdx`) | yes |
| cases.md | cases | `/backend/cases` | none | draft | published (`cases.mdx`) | yes |
| playbooks.md | playbooks | `/backend/playbooks` | none | draft | published (`playbooks.mdx`) | yes |
| insurance-desk.md | insurance_desk | `/backend/insurance-desk/*` | none | draft | published (`insurance-desk.mdx`) | yes |
| accounting.md | accounting | `/backend/accounting` | none | draft | excluded (EN guide only) | no |

## Legend

- **published** — PL MDX in `apps/docs/docs/user-guide/pl/`, linked in `sidebars.ts`
- **script ready** — run `export-pdf.sh <slug>` or `export-all-pdf.sh` (requires pandoc + PDF engine)

## PDF export

```bash
# Single module
.ai/skills/user-guide-authoring/scripts/export-pdf.sh procurement

# All modules (except overview)
.ai/skills/user-guide-authoring/scripts/export-all-pdf.sh
```

Output: `apps/docs/static/manuals/pl/<slug>.pdf`
