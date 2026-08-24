# Module guides — operator knowledge base

English operational descriptions for Open Mercato **Daily work** sidebar modules. These files feed:

1. AI agents authoring Polish user manuals (`user-guide-authoring` skill)
2. Developer `AGENTS.md` → **Operator documentation** links
3. Gap analysis vs existing `apps/docs/docs/user-guide/` (EN)

## Conventions

- One file per logical module area (see [INDEX.md](./INDEX.md))
- YAML frontmatter: `moduleId`, `sidebarSection`, `sidebarPaths`, `plManualStatus`
- Unknown business rules → `## Authoring todos` (do not guess)
- **Excluded:** `taxi_fleet` unless explicitly requested

## Authoring workflow

1. Read module code (`page.meta.ts`, `acl.ts`, backend pages)
2. Copy template from [`.ai/skills/user-guide-authoring/references/module-guide-template.md`](../skills/user-guide-authoring/references/module-guide-template.md)
3. Update [INDEX.md](./INDEX.md) and [coverage matrix](../skills/user-guide-authoring/references/coverage-matrix.md)
4. For PL manuals: `apps/docs/docs/user-guide/pl/<slug>.mdx` + `export-pdf.sh`

## Related

- Skill: [`.ai/skills/user-guide-authoring/SKILL.md`](../skills/user-guide-authoring/SKILL.md)
- Playbooks (in-CRM procedures): [`.ai/skills/procedure-authoring/SKILL.md`](../skills/procedure-authoring/SKILL.md)
- EN user guides: [`apps/docs/docs/user-guide/`](../../apps/docs/docs/user-guide/)
