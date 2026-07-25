---
name: procedure-authoring
description: >-
  Author Open Mercato playbook procedures from workshop notes into Git-tracked
  Markdown, then import/export via CLI or remote HTTP MCP. Use when the user
  mentions procedures, playbooks, MD procedure definitions, workshop notes,
  playbooks import, playbooks export, from-markdown, to-markdown, or procedureMarkdown.
---

# Procedure authoring (MD ↔ playbook)

MD is an **intermediate artifact** (agent generates, human reviews outside CRM UI). There is no in-app MD editor.

## Source of truth

- Files: `apps/mercato/content/procedures/`
- Template: `apps/mercato/content/procedures/_TEMPLATE.md`
- Spec: `.ai/specs/2026-07-18-procedure-markdown-authoring.md`
- Compiler/export: `packages/core/src/modules/playbooks/lib/procedureMarkdown.ts` + `procedureMarkdownExport.ts`

## Document shape

```
---
slug / title / audience / contextTags / defaultSlaDuration   # imported meta
relatedProcedures: [{ slug, title }]                       # authoring only (stripped on compile)
authoringTodos: [...]                                        # authoring only (stripped on compile)
---

# Title

Operator-facing body (imported as playbook body). Non-technical. Clear. No DSL.

## Procedure

Executable YAML steps (imported as procedureDefinition).
```

**Body (above `## Procedure`)** — for a non-technical operator in CRM: plain language, workshop narrative, what to do and why. No slugs, no file paths, no DSL (`select_entity`, `entityKind`, `invoke_procedure`, `leaf`), no authoring TODOs, no “powiązane procedury” with technical ids.

**Frontmatter authoring keys** (kept in git for skills; compiler ignores unknown keys):

- `relatedProcedures` — `{ slug, title }[]` for dependency graph / dedupe
- `authoringTodos` — gaps for agents and implementers

**Executable deps** — only `playbookSlugs` under `## Procedure`.

## Workflow

1. Capture workshop notes; do not invent steps. Put gaps in `authoringTodos`, not in the CRM body.
2. **Dedupe before drafting** — scan batch + existing files; extract shared subflows; wire with `invoke_procedure`. See **Reuse / extract**.
3. Draft `*.md` from `_TEMPLATE.md`.
4. Review the **operator body** with the client (non-technical clarity).
5. Validate + promote (see **Local → remote** below): local dry-run → local import → wait for user OK → only then remote.
6. Import via CLI, API/MCP, or backend list **Import**.
7. Export via CLI, API/MCP, or backend list **Export**.
8. Files starting with `_` are skipped in `--dir` import/seed.
9. After CRM export, re-merge `relatedProcedures` / `authoringTodos` from git if the export omitted them.

## Local → remote promotion (MUST)

Before **any** state-changing action on remote MCP (`open-mercato-rsmoto` / etc.):

1. Dry-run / validate on **local** (when the tool supports it).
2. Execute the **same action on local**.
3. If local MCP is down or the local step fails → **stop**, report; never touch remote.
4. After local success → **wait for explicit user confirmation** before remote.

Applies to playbooks import **and** cases/customers/`execute` mutations. Full gate: `.ai/skills/remote-crm-mcp/SKILL.md`.

## Reuse / extract (must)

Before finishing a batch, ask: *what repeats across 2+ flows and is a real sub-process?*

**Extract when** the cluster is a domain subflow (typically 2+ steps or a named workshop concept).

**Keep inline when** it is only a single `select_entity` needed for standalone entry.

**How to wire** (`invoke_procedure` + call stack):

- `invoke_procedure` must be **last in its list** (root or branch). Validation: `terminalNotLastInList`.
- On nested `end`, runtime **resumes the parent** after the invoke.
- Prefer leaf playbooks first; parents second.
- List related playbooks in frontmatter `relatedProcedures` (slug + title) for skills; do not dump that into the operator body.

## Round-trip

- Export writes local kebab `id` only (no database `blockId` UUIDs).
- Import derives block UUID = v5(`slug/id`). Keep local step `id`s stable.
- Legacy files may still include `blockId`; import honours it, export never emits it.
- Authoring-only frontmatter is not stored in CRM — preserve it in git across exports.

## Remote HTTP MCP / API

Preferred tools: `playbooks_import_markdown` / `playbooks_apply_markdown` (alias), `playbooks_export_markdown`, `playbooks_compile_markdown`.
- Import body: `{ markdown }` or `{ documents: string[] }` (max 50).
- Export: single `slug`/`id`, or batch `ids`/`slugs`.
- HTTP: `POST /api/playbooks/from-markdown`, `GET|POST /api/playbooks/to-markdown`.
- UI: `/backend/playbooks` (selection + Export, Import icon).

## DSL rules (must)

- Local step `id`: kebab-case (canonical identity with playbook `slug`).
- First step `kind: start`; terminate with `end` / `invoke_procedure` per flow rules.
- `goto.target` = local step `id`.
- Prefer leaf `invoke_procedure` playbooks before parents.
- Do not put database block UUIDs in MD.
- `select_entity`: **required** whenever the operator must pick or create a CRM record. Set `entityKind` to one of `customer`, `resource`, `sales_order`, `sales_quote`, `sales_deal`, `insurance_policy`. Optional `required` / `allowCreate` (default true).
- Step **labels** / task titles shown to operators must stay plain language (e.g. “pojazd”, not “resource”).
- After drafting, re-check for duplicated clusters and extract.
- After drafting, re-check every create/pick-record step → `select_entity`.

## Do not

- Compile free-form prose without `## Procedure`.
- Hand-edit `procedureDefinition` JSON in the DB when an MD source exists.
- Build a visual MD editor in CRM UI.
- Copy-paste the same multi-step cluster into multiple procedures when a leaf + `invoke_procedure` would do.
- Put technical or authoring content into the CRM body (slugs, paths, DSL, implementer TODOs, dependency catalogs).
- Import to remote MCP without local dry-run + local apply + explicit user OK.
- Run any other state-changing remote MCP action without the same local-first gate.
