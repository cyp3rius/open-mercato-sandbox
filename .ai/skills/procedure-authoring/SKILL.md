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
2. Draft `*.md` from `_TEMPLATE.md` (frontmatter + prose + `## Procedure`).
3. Review MD with the client outside the CRM UI.
4. Validate: `yarn mercato playbooks import --tenant … --org … --file … --dry-run` (alias: `apply`).
5. Import via CLI, API/MCP, or backend list **Import** (`.md` or multi-item export `.json`). Same slug → new version when content changes.
6. Export via CLI, API/MCP, or backend list: select playbooks → **Export** (one `.md`, or JSON bundle for many).
7. Files starting with `_` are skipped in `--dir` import/seed.

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
- `select_entity`: set `entityKind` to one of `customer`, `resource`, `sales_order`, `sales_quote`, `sales_deal`, `insurance_policy`. Optional `required` / `allowCreate` (default true). Runtime uses EntitySearchCombobox (pick + create in new tab).

## Do not

- Compile free-form prose without `## Procedure`.
- Hand-edit `procedureDefinition` JSON in the DB when an MD source exists.
- Build a visual MD editor in CRM UI.
