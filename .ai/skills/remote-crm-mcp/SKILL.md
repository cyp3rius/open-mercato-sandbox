---
name: remote-crm-mcp
description: >-
  Connect a local Cursor or Claude agent to a remote Open Mercato CRM via HTTP
  MCP. Use when configuring MCP, remote CRM, Code Mode search/execute,
  context_whoami, API keys for agents, mcp:dev, or operating the full CRM API
  from an external agent.
---

# Remote CRM MCP (HTTP)

## Local → remote promotion gate (MUST)

Applies to **every action** intended for a remote MCP server (e.g. Cursor `user-open-mercato-rsmoto` / `open-mercato-rsmoto`) — not only playbooks import. Includes: playbooks compile/import/export writes, cases create/transition/assign, customers ensure/create/update, `execute` mutations, and any other CRM write via MCP tools.

**Always** run the same intent on **local** MCP first, in this form:

1. **Dry-run / validate on local** when the tool supports it (e.g. `playbooks_import_markdown` with `dryRun: true`). If no dry-run exists, still run the equivalent check on local first (compile, list, get, or a reversible local write).
2. **Execute the real action on local MCP** (same payload/intent, not dry-run).
3. If local MCP is **unavailable** or the local step **fails**: **stop**. Report the problem. Do **not** call remote MCP.
4. After a **successful local** action: **stop and wait**. Do **not** run the same action on remote until the user explicitly confirms local is OK and asks for remote.
5. Only then: dry-run (if supported) + execute on remote, with `context_whoami` on the remote first.

Never skip the local step to “save time” when remote is the destination. Read-only discovery on remote (`context_whoami`, list/get that do not mutate) may proceed without local promotion when the user asked only to inspect remote — but **any write or state-changing call** must follow this gate.

## When to use

**Opt-in only.** Call Open Mercato MCP from chat **only** when the user explicitly asks to manage Open Mercato (CRM/data/operations) from the conversation. Do not use MCP for ordinary coding, specs, or repo work — even if the server is connected.

- Local Cursor / Claude Code / Claude Desktop must operate a **remote** CRM **and** the user requested that.
- Discover or call any CRM API without hardcoded per-endpoint tools (after explicit request).
- Verify auth scope before writes (after explicit request).

## Architecture

```
Local agent  --HTTP /mcp + x-api-key-->  Remote yarn mcp:dev|mcp:serve
                                              |-- search (OpenAPI)
                                              |-- execute (api.request → APP_URL)
                                              |-- context_whoami
                                              |-- playbooks_*, cases_*, customers_*
```

Do **not** invent hundreds of MCP tools. Full API surface is the OpenAPI spec loaded into Code Mode. Domain workflow overlays: see domain MCP spec.

## Remote host checklist

1. Next app running; set `APP_URL` / `NEXT_PUBLIC_APP_URL` to the CRM origin **reachable from the MCP process**.
2. API key with features matching agent tasks (see domain skills). Set on the host as **`OPEN_MERCATO_MCP_API_KEY=omk_...`** (same key agents send as `x-api-key`).
3. Start MCP (also started automatically by local `yarn dev` when the key is set):

```bash
OPEN_MERCATO_MCP_API_KEY=omk_... OPEN_MERCATO_MCP_HOST=0.0.0.0 OPEN_MERCATO_MCP_PORT=3001 yarn mcp:dev
```

4. Prefer HTTPS via reverse proxy for non-trusted networks. Open firewall for the MCP port.
5. Health: `curl https://<host>:3001/health`

### Env (canonical)

| Variable | Purpose |
|----------|---------|
| `OPEN_MERCATO_MCP_API_KEY` | CRM API key (`omk_…`) for MCP |
| `OPEN_MERCATO_MCP_HOST` | Listen address (default `0.0.0.0`) |
| `OPEN_MERCATO_MCP_PORT` | Listen port (default `3001`) |
| `OPEN_MERCATO_MCP_URL` | Base URL for in-app OpenCode → MCP |
| `OPEN_MERCATO_MCP_DEBUG` | `true` for verbose logs |

Deprecated aliases still work: `OPEN_MERCATO_API_KEY`, `MCP_API_KEY`, `MCP_SERVER_API_KEY`, `MCP_HOST`, `MCP_DEV_PORT`, `MCP_URL`.

## Local agent config

```json
{
  "mcpServers": {
    "open-mercato": {
      "type": "http",
      "url": "https://<remote-host>:3001/mcp",
      "headers": { "x-api-key": "omk_..." }
    }
  }
}
```

Example file in repo: `.mcp.json.example`.

Optional fallback (playbooks only, no Code Mode): stdio `yarn run mercato playbooks mcp:remote`.

## Tools (always)

| Tool | Role |
|------|------|
| `context_whoami` | tenant / org / features |
| `search` | JS over OpenAPI + entity graph (`spec.findEndpoints`, `spec.describeEndpoint`) |
| `execute` | JS with `api.request({ method, path, query?, body? })` |
| `playbooks_*` | Procedure MD compile / import / export / list |
| `cases_find` / `cases_get` / `cases_create_with_playbook` / `cases_transition_stage` / `cases_assign_owner` | Case workflow |
| `customers_find` / `customers_get` / `customers_ensure_person` / `customers_ensure_company` | CRM people/companies |

Prefer named domain tools when listed in a `crm-*` skill; use `search`/`execute` for everything else.

## Universal workflow

1. `context_whoami` — confirm scope.
2. Prefer first-class tools from the domain skill (`cases_*`, `customers_*`, `playbooks_*`).
3. Otherwise `search` → `spec.describeEndpoint` → `execute` (`api.request`). Never hardcode UUIDs.
4. Procedures MD → playbooks tools or `procedure-authoring` / `crm-cases-playbooks`.

## Domain skills

| Skill | Area |
|-------|------|
| `crm-customers` | customers, signals, accounts, portal |
| `crm-cases-playbooks` | cases, playbooks |
| `crm-catalog-sales` | catalog, sales, checkout, payments |
| `crm-directory-auth` | auth, directory, api_keys, staff |
| `crm-config-platform` | configs, dictionaries, entities, toggles |
| `crm-operations` | resources, planner, procurement, accounting |
| `crm-insurance-partners` | insurance, desk, partners, lead intake |
| `crm-inbox-integrations` | inbox, messages, webhooks, sync, workflows |

## Spec

- Connection / Code Mode: `.ai/specs/2026-07-18-remote-crm-mcp-agent.md`
- Domain workflow overlays (cases, customers, …): `.ai/specs/2026-07-19-domain-mcp-tools-remaining-modules.md`
