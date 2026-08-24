---
name: user-guide-authoring
description: >-
  Author operator-facing user guides and Polish PDF manuals for Open Mercato
  admin modules. Use when the user mentions user guide, operator manual,
  instrukcja obsługi, module description, non-technical documentation, PDF
  export, daily work sidebar modules, or .ai/module-guides/.
---

# User guide authoring

Operator documentation for admin UI screens in the **Daily work** sidebar. Distinct from:

| Artifact | Skill | Audience | Location |
|----------|-------|----------|----------|
| Technical specs | `spec-writing` | Developers | `.ai/specs/` |
| Coding-agent rules | `create-agents-md` | AI agents | `AGENTS.md` |
| In-CRM procedures | `procedure-authoring` | Operators (in-app) | `apps/mercato/content/procedures/` |
| **Admin user guides** | **this skill** | Non-technical operators | `.ai/module-guides/` → `apps/docs/docs/user-guide/pl/` → PDF |

## Source of truth (read in order)

1. `.ai/module-guides/<module>.md` — module operational description (EN, agent-facing)
2. `.ai/module-guides/INDEX.md` — coverage matrix and sidebar paths
3. Existing `apps/docs/docs/user-guide/**` (EN Docusaurus pages)
4. Module code: `page.meta.ts`, backend pages, `acl.ts`, `setup.ts`
5. Specs in `.ai/specs/` when the module has a dedicated spec

## Scope

**In scope:** modules in Mercato **Daily work** sidebar + shortcuts (`mercatoSidebarNav.ts`).

**Out of scope (unless user explicitly asks):** `taxi_fleet` (Fleet section), settings-only modules, developer framework docs.

## Workflow

### Phase 1 — Module guide (EN, agent knowledge base)

1. Check `.ai/module-guides/INDEX.md` for coverage status.
2. Read module code (routes, ACL, key screens).
3. Create or update `.ai/module-guides/<module>.md` using [module-guide-template.md](references/module-guide-template.md).
4. Mark unknown business rules in `## Authoring todos` — do not invent workflows.
5. Update `INDEX.md` status column.

### Phase 2 — Polish user manual (operator-facing)

1. Translate operational content to Polish using [tone-and-style.md](references/tone-and-style.md).
2. Create `apps/docs/docs/user-guide/pl/<module>.mdx` from [user-manual-pl-template.md](references/user-manual-pl-template.md).
3. Register in `apps/docs/sidebars.ts` under **User Guide (PL)**.
4. Add screenshots to `apps/docs/static/screenshots/pl/` when available (optional in first draft).

### Phase 3 — PDF export

```bash
.ai/skills/user-guide-authoring/scripts/export-pdf.sh <module-slug>
.ai/skills/user-guide-authoring/scripts/export-all-pdf.sh
.ai/skills/user-guide-authoring/scripts/export-combined-pdf.sh
```

Requires `pandoc` and a LaTeX engine (`tectonic`, `xelatex`, or `pdflatex`). Combined PDF includes **Spis treści** with page numbers. Output: `apps/docs/static/manuals/pl/<module-slug>.pdf` and `codzienna-praca-pelna.pdf`.

## Playbook vs user guide

| Use playbook (`procedure-authoring`) | Use user guide (this skill) |
|--------------------------------------|----------------------------|
| Repeatable multi-step business process | How to use a screen or module |
| Executed inside CRM on a case | Standalone reference / training PDF |
| YAML procedure steps under `## Procedure` | Numbered UI steps with menu paths |
| Workshop narrative → import to playbooks | Sidebar module → MDX → PDF |

A module user guide may **reference** playbooks but does not replace them.

## Integration with `implement-spec`

When implementing a spec that adds or changes **Daily work** UI:

1. Update `.ai/module-guides/<module>.md`
2. If PL manual exists, update `apps/docs/docs/user-guide/pl/<module>.mdx`
3. Note in spec changelog: "User guide impact: …"

## Related skills

- `procedure-authoring` — in-CRM playbook procedures
- `create-agents-md` — developer AGENTS.md (link to module-guide from Operator documentation section)
- `integration-tests` — QA scenarios can inform workflow steps (strip test IDs and selectors)

## References

- [module-guide-template.md](references/module-guide-template.md)
- [user-manual-pl-template.md](references/user-manual-pl-template.md)
- [tone-and-style.md](references/tone-and-style.md)
- [coverage-matrix.md](references/coverage-matrix.md)
