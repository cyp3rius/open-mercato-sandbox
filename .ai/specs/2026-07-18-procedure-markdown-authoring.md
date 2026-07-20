# Procedure Markdown authoring (MD → playbooks API)

## TLDR

Procedures are authored as Git-tracked Markdown (intermediate artifact; no CRM MD editor). Compiler maps local step ids to UUID v5, validates with `procedureBlocksArraySchema`, and CLI/API/MCP **import** upserts by `slug`. **Export** serializes DB → MD with local kebab `id` only (no database block UUIDs).

## Overview

Workshop notes become a client-reviewable MD document outside the CRM UI. The structural section is the only contract for `procedureDefinition`; prose outside it becomes playbook `body`. Import is idempotent per organization + slug and creates a new version when content changes. Export restores MD for git/agent use.

## Problem Statement

Playbook procedures are JSON block trees with no built-in MD authoring path. Manual UI/API JSON edits are hard to review with clients and not reproducible across environments.

## Proposed Solution

1. MD file format (frontmatter + `## Procedure` YAML steps; local kebab `id` per step).
2. Compiler + exporter in `playbooks/lib/procedureMarkdown.ts` / `procedureMarkdownExport.ts`.
3. CLI `mercato playbooks import` (alias `apply`) and `mercato playbooks export`.
4. HTTP `POST /api/playbooks/from-markdown` (import; single `markdown` or batch `documents`) and `GET|POST /api/playbooks/to-markdown` (export).
5. MCP tools: compile / import / apply(alias) / export / list / get (batch via `documents` / `ids`/`slugs`).
6. Backend list UI: row selection → Export; Import `.md`/export `.json` (same slug → new version when content changes).
7. `seedExamples` imports demo MD from `apps/mercato/content/procedures/` (skips `_*.md`).
8. Cursor skills for authoring + remote CRM.

## Architecture

```
MD file → parseProcedureMarkdown → compileProcedureSteps (UUID v5 from slug/local id)
        → procedureBlocksArraySchema
        → import CLI / API / MCP → commandBus create/update

Playbook DB → exportProcedureDocument → MD (local kebab id only)
```

Stable ids: UUID v5 namespace `6ba7b810-9dad-11d1-80b4-00c04fd430c8` (DNS), name `{slug}/{stepId}`.
Legacy MD may still include `blockId`; import honours it, export never emits it. Blocks may store `sourceStepId` (local kebab id) in the DB for nicer re-export labels.

## Data Models

No DB schema changes. Payload maps to existing `Playbook` fields: `slug`, `title`, `body`, `audience`, `contextTags`, `defaultSlaDuration`, `recommendedOwnerUserIds`, `procedureDefinition`.

### Frontmatter

| Field | Required | Notes |
|-------|----------|--------|
| `slug` | yes | lowercased |
| `title` | yes | |
| `audience` | no | `internal` \| `customer_facing` \| `both` (default `internal`) |
| `contextTags` | no | string[] |
| `defaultSlaDuration` | no | `{ amount, unit }` |
| `recommendedOwnerUserIds` | no | uuid[] |

### Procedure DSL step kinds

`start`, `end`, `action`, `condition` (`yes`/`no` nested steps), `goto` (`target` = local step id), `invoke_procedure` (`playbookSlugs`, optional `slaDuration`).

Per step: required local kebab `id`. Do **not** put database block UUIDs in MD/API markdown. Optional legacy `blockId` is still accepted on import only.

## API / CLI Contracts

- Compile/validate: `compileProcedureDocument`.
- Export: `exportProcedureDocument` / CLI `playbooks export --tenant --org (--slug|--id|--all) (--out|--dir)`.
- Import (local): `yarn mercato playbooks import --tenant --org (--file|--dir) [--dry-run]` (alias: `apply`).
- Import (HTTP): `POST /api/playbooks/from-markdown` body `{ markdown, dryRun? }` or `{ documents: string[], dryRun? }` (max 50) — `playbooks.create` + `playbooks.edit`. Batch returns `{ results, summary }`; single keeps the previous shape.
- Export (HTTP): `GET /api/playbooks/to-markdown?slug=|id=` or `POST` with `{ ids?, slugs? }` — `playbooks.view`.
- UI: `/backend/playbooks` — select rows → Export (one `.md` or multi-item JSON); Import icon accepts `.md` / export JSON; upsert by slug (new version on content change).
- MCP: `playbooks_import_markdown`, `playbooks_apply_markdown` (alias), `playbooks_export_markdown` (`ids`/`slugs` batch), `playbooks_compile_markdown`, list/get.
- Seed: `seedExamples` imports non-`_*` MD from `apps/mercato/content/procedures/` (fail-soft).
- Commands: `playbooks.playbooks.create` / `playbooks.playbooks.update`.
- Dry-run: CLI `--dry-run` or API/MCP `dryRun: true`.

## Risks & Impact Review

| Scenario | Severity | Mitigation |
|----------|----------|------------|
| Free-form MD mis-parsed as steps | Medium | Only `## Procedure` YAML is compiled |
| Unstable UUIDs break gotos on re-apply | High | UUID v5 from slug+step id |
| UI-created playbook first MD round-trip | Medium | Export synthesizes local ids; re-import may rewrite UUIDs once (new version); keep local `id`s stable afterwards |
| Invoke dependency order | Medium | Document leaf-first or two-pass import |
| Invalid flow | High | Fail closed via existing schema |
| Seed missing content dir | Low | Fail-soft log and skip |

## Migration & Backward Compatibility

Additive tooling + optional `sourceStepId`. Export no longer emits `blockId` (legacy field still accepted on import). No removal of `/api/playbooks` or runtime block kinds. CLI `apply` remains as alias of `import`.

## Final Compliance Report

- Additive CLI + lib + API; no contract removals.
- Reuses existing playbook validators and versioning.

## Changelog

| Date | Description |
|------|-------------|
| 2026-07-18 | Initial MD authoring contract, compiler, CLI apply, skill + template. |
| 2026-07-18 | HTTP from-markdown + MCP tools + remote stdio bridge for local agent → remote CRM. |
| 2026-07-18 | Prefer remote HTTP MCP (full CRM Code Mode); stdio playbooks bridge as fallback. |
| 2026-07-19 | Export/import round-trip (`blockId`), CLI import/export, to-markdown API, seedExamples, skills. |
| 2026-07-19 | Backend list Export/Import UI; from-markdown batch `documents`; MCP/API batch export/import. |
| 2026-07-19 | Drop `blockId` from export MD/API; identity is local `id` + slug → UUID v5; legacy `blockId` still accepted on import. |
| 2026-07-19 | Add `select_entity` procedure block (`entityKind`: customer, resource, sales_order, sales_quote, sales_deal, insurance_policy). |
