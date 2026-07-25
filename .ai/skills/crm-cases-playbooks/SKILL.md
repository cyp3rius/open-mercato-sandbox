---
name: crm-cases-playbooks
description: >-
  Operate Open Mercato cases and playbooks via MCP: case workflow tools, stages,
  and procedure Markdown import/export. Use for cases, playbooks, procedures,
  cases_find, cases_create_with_playbook, playbooks_import_markdown, or playbooks_export_markdown.
---

# CRM — Cases & Playbooks

Requires `remote-crm-mcp`. For MD DSL details use `procedure-authoring`.

## Modules

`cases`, `playbooks`

## ACL

- Cases: `cases.view`, `cases.create`, `cases.edit`, …
- Playbooks: `playbooks.view`, `playbooks.create`, `playbooks.edit` (import needs create+edit)

## Discover (fallback)

```js
spec.findEndpoints('cases')
spec.findEndpoints('playbooks')
spec.findEndpoints('from-markdown')
spec.findEndpoints('to-markdown')
```

## Preferred tools

| Task | Tool |
|------|------|
| Find cases | `cases_find` |
| Get case | `cases_get` |
| Create case + playbook link | `cases_create_with_playbook` |
| Change status | `cases_transition_stage` |
| Assign owner | `cases_assign_owner` |
| List/get playbooks | `playbooks_list` / `playbooks_get` |
| Validate procedure MD | `playbooks_compile_markdown` |
| Import MD → DB | `playbooks_import_markdown` (alias `playbooks_apply_markdown`) |
| Export DB → MD | `playbooks_export_markdown` |
| Other case fields / edge cases | `search` + `execute` |

## Patterns

1. `context_whoami`
2. Cases: `cases_find` → `cases_get` → transition/assign tools; resolve customers via `customers_find` / `customers_ensure_*`
3. Procedures: generate MD → review outside UI → **local** dry-run → **local** import → wait for user OK → only then remote (see `remote-crm-mcp` promotion gate)
4. Export before editing elsewhere; re-import keeps stable local `id`s → UUID v5
5. Batch: import `{ documents: [...] }`; export `{ ids }` / `{ slugs }`

## Local → remote (MUST)

Never run a state-changing action on remote MCP without: local dry-run/validate (when available) → local execute → user confirmation. If local is unavailable, stop and report. Applies to playbooks, cases, customers, and any other MCP write — see `remote-crm-mcp` promotion gate.

## Execute sketch (fallback)

```js
await api.request({ method: 'GET', path: '/api/cases', query: { page: '1', pageSize: '20' } })
await api.request({ method: 'POST', path: '/api/playbooks/from-markdown', body: { markdown, dryRun: true } })
```

## References

- `.ai/skills/procedure-authoring/SKILL.md`
- `.ai/specs/2026-07-18-procedure-markdown-authoring.md`
- `.ai/specs/2026-07-19-domain-mcp-tools-remaining-modules.md`
