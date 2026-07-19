---
name: crm-insurance-partners
description: >-
  Operate Open Mercato insurance, insurance desk, partner programs, and lead
  intake via MCP. Use for policies, insurers, partner programs, leads, or
  insurance desk workflows through a remote agent.
---

# CRM — Insurance & Partners

Requires `remote-crm-mcp`.

## Modules

`insurance`, `insurance_desk` (`@app`), `partner_programs`, `lead_intake` (`@app`)

## ACL

- Insurance / desk: module view + manage / config features
- Partner programs: `partner_programs.*`
- Lead intake: lead_intake features as declared in app module ACL

## Discover

```js
spec.findEndpoints('insurance')
spec.findEndpoints('partner')
spec.findEndpoints('lead')
spec.findEndpoints('insurer')
spec.findEndpoints('policy')
```

Also search app-specific prefixes if desk/intake routes differ — use `spec.findEndpoints` broadly.

## Patterns

1. `context_whoami`
2. Resolve customer / company ids (skill `crm-customers`) before linking policies or leads
3. Insurance desk UI workflows map to API — discover before inventing payloads
4. Partner programs: list programs → enrollments; do not invent program codes
5. Lead intake: create then convert/link per OpenAPI; keep PII handling minimal in logs

## Execute sketch

```js
await api.request({ method: 'GET', path: '/api/insurance', query: { page: '1' } })
// Prefer describeEndpoint for desk/intake paths discovered via search
```

## References

- `packages/core/src/modules/insurance/`
- `packages/core/src/modules/partner_programs/`
- `apps/mercato/src/modules/insurance_desk/`
- `apps/mercato/src/modules/lead_intake/`
