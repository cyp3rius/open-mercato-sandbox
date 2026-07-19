---
name: crm-inbox-integrations
description: >-
  Operate Open Mercato inbox, messaging, notifications, webhooks, integrations,
  data sync, workflows, events, scheduler, mail delivery, and progress via MCP.
  Use for inbox ops, webhooks, sync, workflows, or notification setup through MCP.
---

# CRM — Inbox & Integrations

Requires `remote-crm-mcp`.

## Modules

`inbox_ops`, `messages`, `notifications`, `webhooks`, `integrations`, `data_sync`, `workflows`, `events`, `scheduler`, `mail_delivery` (`@app`), `progress`, `ai_assistant` (settings only if needed)

## ACL

- Inbox / messages / notifications: respective view + manage
- Webhooks / integrations / data_sync: manage features (secrets careful)
- Workflows: view + execute / manage as needed
- Scheduler: job manage features

## Discover

```js
spec.findEndpoints('inbox')
spec.findEndpoints('messages')
spec.findEndpoints('notifications')
spec.findEndpoints('webhooks')
spec.findEndpoints('integrations')
spec.findEndpoints('data_sync')
spec.findEndpoints('sync')
spec.findEndpoints('workflows')
spec.findEndpoints('events')
spec.findEndpoints('scheduler')
spec.findEndpoints('mail')
spec.findEndpoints('progress')
```

## Patterns

1. `context_whoami`
2. Inbox: list proposals/items → actions via nested action endpoints from OpenAPI
3. Webhooks: never print signing secrets after create; rotate via documented APIs
4. Data sync: start runs, poll progress endpoints; do not busy-loop without backoff
5. Workflows: start instance with known definition id; wait for user tasks via list APIs
6. Notifications: prefer typed notification APIs; do not invent type ids

## Execute sketch

```js
await api.request({ method: 'GET', path: '/api/webhooks', query: { page: '1' } })
await api.request({ method: 'GET', path: '/api/workflows', query: { page: '1' } })
```

## References

- `packages/webhooks/AGENTS.md`
- `packages/core/src/modules/integrations/AGENTS.md`
- `packages/core/src/modules/data_sync/AGENTS.md`
- `packages/core/src/modules/workflows/AGENTS.md`
- `packages/events/AGENTS.md`
- `packages/core/src/modules/inbox_ops/`
