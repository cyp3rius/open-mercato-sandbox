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

## Workflow

1. Capture workshop notes; do not invent steps. Mark gaps as `TODO`.
2. **Dedupe before drafting** — scan all procedures in the same workshop/batch (and existing files in `content/procedures/`) for repeated step clusters. Extract shared domain subflows into leaf `*.md` playbooks; wire parents with `invoke_procedure`. See **Reuse / extract** below.
3. Draft `*.md` from `_TEMPLATE.md` (frontmatter + prose + `## Procedure`).
4. Review MD with the client outside the CRM UI.
5. Validate: `yarn mercato playbooks import --tenant … --org … --file … --dry-run` (alias: `apply`).
6. Import via CLI, API/MCP, or backend list **Import** (`.md` or multi-item export `.json`). Same slug → new version when content changes.
7. Export via CLI, API/MCP, or backend list: select playbooks → **Export** (one `.md`, or JSON bundle for many).
8. Files starting with `_` are skipped in `--dir` import/seed.

## Reuse / extract (must)

Before finishing a batch of procedures, always ask: *what repeats across 2+ flows and is a real sub-process?*

**Extract when** the repeated cluster is a domain subflow (policy link, peer QC, partner assignment, intake handoff, etc.) — typically 2+ steps or a named concept from the workshop.

**Keep inline when** it is only a single `select_entity` / one-liner needed for standalone entry (e.g. `pick-customer` at the start of several leaves). Duplicating that is OK; do not invent a micro-playbook for every widget.

**How to wire** (`invoke_procedure` + call stack):

- `invoke_procedure` must be **last in its list** (root or `yes`/`no` branch). Validation: `terminalNotLastInList`.
- On nested `end`, runtime **resumes the parent** at the next step after the invoke (`nextGlobal`). Mid-flow reuse: put `invoke_procedure` as the last step of a `condition` branch, then continue siblings after the condition.
- Prefer leaf playbooks first; parents/`invoke` second.
- Cross-link extracted slugs in the prose (`##` body) so reviewers see the graph.

## Round-trip

- Export writes local kebab `id` only (no database `blockId` UUIDs).
- Import derives block UUID = v5(`slug/id`). Keep local step `id`s stable.
- Legacy files may still include `blockId`; import honours it, export never emits it.

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
- `select_entity`: **required** whenever the operator must pick or create a CRM record. Do not use `action`/`task` for “utwórz klienta / deal / zamówienie / pojazd / polisę”. Set `entityKind` to one of `customer`, `resource`, `sales_order`, `sales_quote`, `sales_deal`, `insurance_policy`. Optional `required` / `allowCreate` (default true). Runtime: EntitySearchCombobox (pick + create in new tab).
- After drafting, re-check for duplicated clusters and extract (Reuse / extract).
- After drafting, re-check every “wprowadź/utwórz/wybierz rekord” step — it must be `select_entity` when an `entityKind` exists.

## Do not

- Compile free-form prose without `## Procedure`.
- Hand-edit `procedureDefinition` JSON in the DB when an MD source exists.
- Build a visual MD editor in CRM UI.
- Copy-paste the same multi-step cluster into multiple procedures when a leaf + `invoke_procedure` would do.
