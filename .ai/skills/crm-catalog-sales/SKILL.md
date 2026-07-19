---
name: crm-catalog-sales
description: >-
  Operate Open Mercato catalog and sales via MCP: products, variants, pricing,
  quotes, orders, invoices, currencies, checkout, payment gateways, shipping.
  Use for catalog, sales documents, offerings, checkout, or payments through MCP.
---

# CRM — Catalog & Sales

Requires `remote-crm-mcp`.

## Modules

`catalog`, `sales`, `currencies`, `checkout`, `payment_gateways`, `shipping_carriers`, `gateway_stripe` (when enabled)

## ACL

- Catalog: `catalog.view` / manage features for products, prices, offers
- Sales: `sales.view` / create / edit for quotes, orders, invoices, returns
- Currencies, checkout, gateways: matching module features

## Discover

```js
spec.findEndpoints('catalog')
spec.findEndpoints('products')
spec.findEndpoints('sales')
spec.findEndpoints('quotes')
spec.findEndpoints('orders')
spec.findEndpoints('invoices')
spec.findEndpoints('currencies')
spec.findEndpoints('checkout')
spec.findEndpoints('payment')
spec.findEndpoints('shipping')
```

## Patterns

1. `context_whoami`
2. Resolve product/variant/channel ids via list before creating lines
3. Document flow: Quote → Order → Invoice — follow existing sales AGENTS patterns
4. Channel-scoped pricing: include channel/org fields from OpenAPI
5. Returns / cancellations: use dedicated sales endpoints; do not invent status transitions

## Execute sketch

```js
await api.request({ method: 'GET', path: '/api/catalog/products', query: { page: '1', pageSize: '20' } })
await api.request({ method: 'GET', path: '/api/sales/orders', query: { page: '1', pageSize: '20' } })
```

## References

- `packages/core/src/modules/catalog/AGENTS.md`
- `packages/core/src/modules/sales/AGENTS.md`
