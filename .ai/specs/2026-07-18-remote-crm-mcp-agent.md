# Remote CRM MCP agent (HTTP)

## TLDR

Local Cursor / Claude agents operate a remote Open Mercato CRM by connecting to HTTP MCP (`mcp:dev` / `mcp:serve`) on the CRM host. Full API coverage is Code Mode (`search` + `execute`) over OpenAPI; domain Cursor Skills guide workflows. No per-endpoint MCP tools.

## Overview

Agents authenticate with `x-api-key`. The MCP process runs next to the CRM app and executes `api.request()` against `APP_URL` / `NEXT_PUBLIC_APP_URL`. Skills under `.ai/skills/remote-crm-mcp` and `crm-*` document connection and domain operations.

## Problem Statement

Operators want to configure and run the entire CRM from a local agent without deploying agent tooling inside the CRM UI, while still using the real tenant API surface and ACLs.

## Proposed Solution

1. Harden MCP for remote listen (`MCP_HOST`, API key from env, APP_URL warning).
2. Document HTTP MCP client config for Cursor / Claude.
3. Ship Cursor Skills covering all enabled module groups.
4. Keep specialized `playbooks_*` tools and optional stdio `playbooks mcp:remote` as playbooks-only fallback.
5. Domain workflow overlays for remaining CRM modules: see `.ai/specs/2026-07-19-domain-mcp-tools-remaining-modules.md` (hybrid: first-class workflow tools + Code Mode fallback; skills prefer named tools).

## Architecture

```
Local agent → HTTP POST /mcp (x-api-key)
           → MCP tools: context_whoami, search, execute, playbooks_*
           → execute → fetch(APP_URL + /api/...)
```

## MCP tool contract

| Tool | Purpose |
|------|---------|
| `context_whoami` | Auth scope |
| `search` | Sandboxed JS over OpenAPI + entity graph |
| `execute` | Sandboxed JS with `api.request` |
| `playbooks_compile_markdown` | Dry-run procedure MD |
| `playbooks_apply_markdown` | Upsert procedure MD |
| `playbooks_list` / `playbooks_get` | Read playbooks |

## Remote runtime requirements

| Setting | Requirement |
|---------|-------------|
| `OPEN_MERCATO_MCP_HOST` (alias `MCP_HOST`) | Default `0.0.0.0` for remote agents |
| `OPEN_MERCATO_MCP_PORT` (alias `MCP_DEV_PORT`) / `--port` | Published port |
| `OPEN_MERCATO_MCP_API_KEY` or `.mcp.json` | CRM API key for `mcp:dev` / clients |
| `APP_URL` / `NEXT_PUBLIC_APP_URL` | CRM origin reachable from MCP process |
| TLS | Prefer reverse-proxy HTTPS for public exposure |

## Skills map

| Skill | Modules |
|-------|---------|
| `remote-crm-mcp` | Connection + tool overview |
| `crm-customers` | customers, customer_signals, customer_accounts, portal |
| `crm-cases-playbooks` | cases, playbooks |
| `crm-catalog-sales` | catalog, sales, currencies, checkout, payment_gateways, shipping_carriers |
| `crm-directory-auth` | auth, directory, api_keys, staff |
| `crm-config-platform` | configs, dictionaries, feature_toggles, entities, perspectives, business_rules, translations, dashboards |
| `crm-operations` | resources, planner, procurement, accounting, attachments, audit_logs, query_index, search |
| `crm-insurance-partners` | insurance, insurance_desk, partner_programs, lead_intake |
| `crm-inbox-integrations` | inbox_ops, messages, notifications, webhooks, integrations, data_sync, workflows, events, scheduler, mail_delivery, progress |

## Migration & Backward Compatibility

Additive only. Existing local HTTP MCP and stdio playbooks bridge unchanged. Default bind changes to `0.0.0.0` (was implicit any/default); override with `MCP_HOST=127.0.0.1` to restrict localhost-only.

## Risks & Impact Review

| Scenario | Severity | Mitigation |
|----------|----------|------------|
| MCP exposed without TLS | High | Document HTTPS + firewall |
| APP_URL still localhost on remote | High | Startup warning |
| Over-privileged API key | High | Skills list least-privilege features per domain |
| Agent invents endpoints | Medium | Code Mode search first |

## Changelog

| Date | Description |
|------|-------------|
| 2026-07-18 | Remote HTTP MCP hardening, agent docs, CRM domain skills. |
| 2026-07-19 | Canonical `OPEN_MERCATO_MCP_*` env names; `yarn dev` starts MCP when API key is set. |
| 2026-07-19 | Cross-link domain MCP overlays spec (`2026-07-19-domain-mcp-tools-remaining-modules.md`). |
