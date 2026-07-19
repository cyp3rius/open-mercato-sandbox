---
name: crm-config-platform
description: >-
  Configure Open Mercato platform settings via MCP: module configs, dictionaries,
  feature toggles, custom entities, perspectives, business rules, translations,
  dashboards. Use when changing CRM configuration, dictionaries, CE fields, or toggles.
---

# CRM — Config & Platform

Requires `remote-crm-mcp`.

## Modules

`configs`, `dictionaries`, `feature_toggles`, `entities`, `perspectives`, `business_rules`, `translations`, `dashboards`

## ACL

- `configs` manage / view
- Dictionaries and CE: matching `dictionaries.*` / `entities.*`
- Feature toggles: manage features (careful in production)
- Dashboards / perspectives: view + manage as needed

## Discover

```js
spec.findEndpoints('configs')
spec.findEndpoints('dictionaries')
spec.findEndpoints('feature')
spec.findEndpoints('entities')
spec.findEndpoints('perspectives')
spec.findEndpoints('business_rules')
spec.findEndpoints('translations')
spec.findEndpoints('dashboards')
```

## Patterns

1. `context_whoami`
2. Read current config before write; prefer patch/upsert shapes from OpenAPI
3. Dictionaries: ensure organization context; status/action dicts may be auto-ensured by module routes
4. Custom entities / fields: follow CE DSL — do not invent field ids
5. Feature toggles: change only when explicitly requested; note tenant blast radius

## Execute sketch

```js
await api.request({ method: 'GET', path: '/api/dictionaries', query: { page: '1' } })
await api.request({ method: 'GET', path: '/api/feature_toggles', query: { page: '1' } })
```

## References

- `packages/core/AGENTS.md` → Custom Fields, Module Setup
- Module AGENTS under `configs`, `entities`, `dictionaries`, `feature_toggles`
