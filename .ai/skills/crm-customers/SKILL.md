---
name: crm-customers
description: >-
  Operate Open Mercato customers CRM via remote HTTP MCP: find/ensure people and
  companies, deals, activities, signals, accounts, and portal. Use when managing
  CRM contacts through MCP (customers_find, customers_ensure_person, etc.).
---

# CRM — Customers

Requires `remote-crm-mcp`.

## Modules

`customers`, `customer_signals`, `customer_accounts`, `portal`

## ACL (API key)

- Read: `customers.people.view`, `customers.companies.view`, plus activities/deals as needed
- Write: `customers.people.manage`, `customers.companies.manage`, …
- Portal: `customer_accounts.*` / portal features as required by the endpoint

## Discover (fallback)

```js
spec.findEndpoints('customers')
spec.findEndpoints('people')
spec.findEndpoints('companies')
spec.findEndpoints('deals')
spec.findEndpoints('activities')
spec.findEndpoints('customer_accounts')
spec.findEndpoints('portal')
```

## Preferred tools

| Task | Tool |
|------|------|
| Search people/companies | `customers_find` |
| Get by id | `customers_get` |
| Ensure person (email match or create) | `customers_ensure_person` |
| Ensure company (name match or create) | `customers_ensure_company` |
| Deals / activities / portal / signals | `search` + `execute` |

## Patterns

1. `context_whoami`
2. Prefer `customers_find` / `customers_ensure_*` before inventing UUIDs
3. Org-scoped lists; tenant/org via API key + MCP context
4. Deals/activities: link to person/company ids from find/ensure
5. Edge cases (custom fields, tags): `describeEndpoint` + `execute`

## Execute sketch (fallback)

```js
await api.request({ method: 'GET', path: '/api/customers/people', query: { page: '1', pageSize: '20', search: 'Ada' } })
await api.request({ method: 'POST', path: '/api/customers/people', body: { /* from describeEndpoint */ } })
```

## References

- `packages/core/src/modules/customers/AGENTS.md`
- `.ai/specs/2026-07-19-domain-mcp-tools-remaining-modules.md`
