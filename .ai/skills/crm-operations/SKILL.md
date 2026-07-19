---
name: crm-operations
description: >-
  Operate Open Mercato operational modules via MCP: resources, planner,
  procurement, accounting, attachments, audit logs, query index, and search.
  Use for fleet/resources scheduling, procurement, accounting, files, or search.
---

# CRM — Operations

Requires `remote-crm-mcp`.

## Modules

`resources`, `planner`, `procurement`, `accounting`, `attachments`, `audit_logs`, `query_index`, `search`

## ACL

- Resources / planner / procurement / accounting: respective `*.view` and manage features
- Attachments: upload/view features
- Audit: view-only typically
- Search: `search.global` (or module search features)

## Discover

```js
spec.findEndpoints('resources')
spec.findEndpoints('planner')
spec.findEndpoints('procurement')
spec.findEndpoints('accounting')
spec.findEndpoints('attachments')
spec.findEndpoints('audit')
spec.findEndpoints('query')
spec.findEndpoints('search')
```

## Patterns

1. `context_whoami`
2. Resources: resolve resource types before creating resources/allocations
3. Planner: date ranges as ISO; respect org timezone if documented in API
4. Procurement / accounting: use list filters; follow document status machines from OpenAPI enums
5. Attachments: upload via documented multipart/JSON endpoints — check describeEndpoint
6. Search: prefer dedicated search API when available for cross-entity lookup

## Execute sketch

```js
await api.request({ method: 'GET', path: '/api/resources', query: { page: '1', pageSize: '20' } })
await api.request({ method: 'GET', path: '/api/search', query: { q: 'term', limit: '20' } })
```

## References

- Module paths under `packages/core/src/modules/{resources,planner,procurement,accounting,attachments,audit_logs}/`
- `packages/search/AGENTS.md`
