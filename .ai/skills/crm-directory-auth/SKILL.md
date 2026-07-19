---
name: crm-directory-auth
description: >-
  Operate Open Mercato directory, auth, API keys, and staff via MCP: organizations,
  users, roles, RBAC features, API keys, team members. Use when configuring tenants,
  orgs, users, roles, API keys, or staff through a remote agent.
---

# CRM — Directory, Auth, API Keys, Staff

Requires `remote-crm-mcp`.

## Modules

`auth`, `directory`, `api_keys`, `staff`

## ACL

- Prefer a dedicated agent API key with least privilege
- Org/user management typically needs admin / directory / auth manage features
- Creating API keys: `api_keys` manage features

## Discover

```js
spec.findEndpoints('directory')
spec.findEndpoints('organizations')
spec.findEndpoints('auth')
spec.findEndpoints('users')
spec.findEndpoints('roles')
spec.findEndpoints('api_keys')
spec.findEndpoints('api-keys')
spec.findEndpoints('staff')
```

## Patterns

1. `context_whoami` — confirm tenant/org before directory mutations
2. Switch org context only via supported APIs; MCP injects `X-Organization-Id` from API key scope when set
3. Never log or echo full API key secrets in chat after creation — show once
4. Staff: resolve team member / user ids via search endpoints before linking
5. RBAC: feature ids are frozen; do not rename features from the agent

## Execute sketch

```js
await api.request({ method: 'GET', path: '/api/directory/organizations', query: { page: '1' } })
await api.request({ method: 'GET', path: '/api/users', query: { page: '1', pageSize: '50' } })
```

## References

- `packages/core/src/modules/auth/AGENTS.md`
- `packages/core/src/modules/directory/`
- `packages/core/src/modules/api_keys/`
- `packages/core/src/modules/staff/`
