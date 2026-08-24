# Playbooks Module — Agent Guidelines

Versioned procedural playbooks for CRM and cases. **Requires `cases` module.**

## MUST Rules

1. **MUST keep procedure YAML in `procedureDefinition`** — compile/import via `lib/procedureMarkdown.ts`
2. **MUST version and publish** — use publish flow; emit `playbooks.playbook.version_published`
3. **MUST NOT execute procedures from playbook list** — execution happens on **case detail**
4. **MUST support markdown import/export** for Git-tracked procedures (see `procedure-authoring` skill)
5. **MUST declare bindings** via `PlaybookBinding` (`caseId`, `resourceTypeSlug`)

## Key Reference Files

| When you need | Copy from |
|---------------|-----------|
| List (import/export) | `backend/playbooks/page.tsx` |
| Create / detail | `backend/playbooks/create/page.tsx`, `backend/playbooks/[id]/page.tsx` |
| Markdown compiler | `lib/procedureMarkdown.ts`, `lib/procedureMarkdownExport.ts` |
| Settings (dictionaries) | `backend/config/playbooks/page.tsx` |
| ACL / setup | `acl.ts`, `setup.ts` |

## Relations

- **cases** (required) — procedure execution, context tags, bindings
- **dictionaries** — procedure status/action (seeded in setup)
- **MCP** — `ai-tools.ts` for import/export

## Operator documentation

- Module guide: [`.ai/module-guides/playbooks.md`](../../../../.ai/module-guides/playbooks.md)
- Procedure authoring (MD ↔ playbook): [`.ai/skills/procedure-authoring/SKILL.md`](../../../../.ai/skills/procedure-authoring/SKILL.md)
- Git procedures: `apps/mercato/content/procedures/`
