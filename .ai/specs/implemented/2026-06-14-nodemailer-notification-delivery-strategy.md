# Nodemailer Notification Delivery Strategy

## TLDR

**Key Points:**
- App-level module `mail_delivery` registers a **custom notification delivery strategy** (`nodemailer`) that sends notification emails via [Nodemailer](https://nodemailer.com/) instead of the built-in Resend channel.
- Strategy reuses the core `NotificationEmail` React template and `@react-email/render` for HTML, with a plain-text fallback.
- Configuration is layered: **environment variables** (bootstrap defaults) → **tenant DB settings** (`strategies.custom.nodemailer`) → per-field env fallback for unset DB values.

**Scope:**
- Strategy registration (`registerNotificationDeliveryStrategy`)
- Transport resolution (sendmail, SMTP, service, URL, SES, stream/json/options)
- Admin UI panel for strategy config (via delivery settings registry)
- Unit tests for delivery and config resolution

**Concerns:**
- Resend (`strategies.email`) and Nodemailer (`strategies.custom.nodemailer`) can both be enabled; operators should disable Resend when using Nodemailer to avoid duplicate emails.
- SES transport requires optional `@aws-sdk/client-ses` dependency (not bundled by default).

---

## Overview

Open Mercato's notifications module supports multiple **delivery strategies** executed after an in-app notification is created (`notifications.notification.created` → `deliver-notification` subscriber). The built-in **email** strategy uses Resend. For self-hosted / on-prem deployments (e.g. RS Moto Concierge CRM with local Postfix), a Nodemailer-based strategy is required.

This spec documents the **`mail_delivery`** app module (`apps/mercato/src/modules/mail_delivery/`), which provides strategy id **`nodemailer`** and integrates with tenant notification delivery settings.

> **Market Reference**: Laravel's mail system and Rails Action Mailer both support pluggable transports with env + DB config layering. Nodemailer is the de-facto Node.js equivalent. We adopted the transport registry pattern from Nodemailer's own docs rather than wrapping a third-party SaaS-only provider.

## Problem Statement

1. **Resend dependency**: Built-in `strategies.email` requires `RESEND_API_KEY` and an external SaaS — unsuitable for air-gapped or self-hosted CRM installs.
2. **Sendmail / SMTP reality**: Production CRM deployments often have local MTA (Postfix) or corporate SMTP relay; operators need sendmail and SMTP without code changes.
3. **No UI for custom transports**: Core notifications settings page supported toggling custom strategies but had no transport-specific configuration form.
4. **Config drift**: Env-based bootstrap must coexist with per-tenant admin overrides (same pattern as other module configs).

## Proposed Solution

### Module placement

| Concern | Location | Rationale |
|---------|----------|-----------|
| Nodemailer strategy implementation | `apps/mercato/src/modules/mail_delivery/` | App-specific integration; follows rule that provider logic lives outside `packages/core` |
| Strategy registry API | `packages/core/.../notifications/lib/deliveryStrategies.ts` | Stable extension point (SPEC-003) |
| Settings UI shell | `packages/core/.../notifications/frontend/NotificationSettingsPageClient.tsx` | Tenant admin surface |
| Strategy settings form | `apps/mercato/.../mail_delivery/frontend/NodemailerStrategySettings.tsx` | Provider-owned UI via registry |

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| Strategy id `nodemailer` (not `smtp`) | Describes implementation; transport kind is a sub-field |
| Default transport `sendmail` | Matches typical Linux server with Postfix; zero config on many hosts |
| `defaultEnabled` from `NOTIFICATIONS_NODEMAILER_ENABLED` | Allows env-only enablement before admin visits settings |
| Reuse `NotificationEmail` template | Visual parity with Resend channel; single template to maintain |
| Priority `20` on registration | Runs after built-in email; order among custom strategies by priority |
| Password stored in tenant config JSON | Same as other module configs; operators must restrict `notifications.manage` access |
| Skip delivery when `OM_DISABLE_EMAIL_DELIVERY` or `OM_TEST_MODE` | Aligns with platform email kill switches |

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Replace Resend in core | Breaking change for SaaS deployments; custom strategy is additive |
| Nodemailer in `packages/core` | Violates provider-in-app-module convention |
| Raw HTML without React Email | Duplicated template maintenance |

## User Stories

- **Platform operator** wants to send notification emails through local sendmail so that no external email API is required.
- **Platform operator** wants to configure SMTP host/credentials in admin UI so that changes do not require redeploy.
- **Developer** wants to register a custom strategy with a settings panel so that future providers (e.g. Mailgun SMTP) follow the same pattern.

## Architecture

### Delivery flow

```mermaid
sequenceDiagram
  participant NS as notificationService
  participant EB as eventBus
  participant SUB as deliver-notification
  participant RES as Resend (strategies.email)
  participant NM as nodemailer strategy

  NS->>EB: notifications.notification.created
  EB->>SUB: persistent subscriber
  SUB->>SUB: resolveNotificationDeliveryConfig
  SUB->>SUB: resolve recipient email + panelLink
  alt strategies.email.enabled
    SUB->>RES: sendEmail(NotificationEmail)
  end
  loop each custom strategy where enabled
    SUB->>NM: strategy.deliver(ctx)
    NM->>NM: render(NotificationEmail) + transport.sendMail
  end
```

### Registration bootstrap

```mermaid
flowchart LR
  A[apps/mercato bootstrap] --> B[DI: mail_delivery/di.ts]
  B --> C[registerNodemailerNotificationDeliveryStrategy]
  C --> D[deliveryStrategies registry]
  E[ClientBootstrap] --> F[registerStrategySettings.ts]
  F --> G[deliveryStrategySettingsRegistry]
```

1. **Server**: `mail_delivery/di.ts` calls `registerNodemailerNotificationDeliveryStrategy()` once at container registration.
2. **Client**: `ClientBootstrap` imports `mail_delivery/frontend/registerStrategySettings` (side-effect) to map `nodemailer` → `NodemailerStrategySettings`.

### Config resolution precedence

For each runtime field (transport, host, from, …):

1. Tenant DB: `strategies.custom.nodemailer.config.<field>`
2. Environment variable (see Configuration)
3. Built-in default (e.g. transport → `sendmail` when no `SMTP_HOST`)

**Enabled state** precedence:

1. Tenant DB: `strategies.custom.nodemailer.enabled` (boolean)
2. Strategy descriptor `defaultEnabled` ← `NOTIFICATIONS_NODEMAILER_ENABLED` / `NOTIFICATIONS_SMTP_ENABLED`
3. `false`

## Data Models

No dedicated ORM entity. Strategy config is stored inside existing module config:

| Key | Module | Value shape |
|-----|--------|-------------|
| `delivery_strategies` | `notifications` | `NotificationDeliveryConfig` (see delivery settings spec) |

Nodemailer-specific config lives at:

```json
{
  "strategies": {
    "custom": {
      "nodemailer": {
        "enabled": true,
        "config": {
          "transport": "sendmail",
          "from": "notifications@example.com",
          "replyTo": "support@example.com",
          "subjectPrefix": "[CRM]",
          "sendmailPath": "/usr/sbin/sendmail",
          "sendmailArgs": ["-i", "-t"],
          "host": "smtp.example.com",
          "port": 587,
          "secure": false,
          "user": "smtp-user",
          "pass": "secret",
          "service": "gmail",
          "url": "smtp://user:pass@host:587",
          "sesRegion": "eu-central-1",
          "transportOptions": {}
        }
      }
    }
  }
}
```

## API Contracts

No dedicated REST endpoints. Strategy is configured through:

- `GET /api/notifications/settings` — returns `customStrategies` descriptors including `{ id: "nodemailer", label, defaultEnabled }`
- `POST /api/notifications/settings` — persists `strategies.custom.nodemailer`

### Strategy handler contract

```typescript
type NotificationDeliveryStrategy = {
  id: string                    // "nodemailer"
  label?: string                // "Email (Nodemailer)"
  defaultEnabled?: boolean
  deliver: (ctx: NotificationDeliveryContext) => Promise<void>
}
```

**Delivery preconditions** (all must pass or strategy no-ops / throws):

| Check | Behavior |
|-------|----------|
| `OM_DISABLE_EMAIL_DELIVERY` or `OM_TEST_MODE` | Silent return |
| `recipient.email` missing | Silent return |
| `panelLink` missing | Silent return (`APP_URL` + panel path required for links) |
| `from` not resolved | Throws `EMAIL_FROM_NOT_CONFIGURED` |

**Outbound email:**

| Field | Source |
|-------|--------|
| `from` | config → `NOTIFICATIONS_EMAIL_FROM` / `EMAIL_FROM` / `ADMIN_EMAIL` |
| `to` | recipient user email (decrypted) |
| `subject` | optional prefix + notification title |
| `html` | `@react-email/render(NotificationEmail(...))` |
| `text` | plain-text builder (title, body, action links, panel CTA) |
| `replyTo` | config → env |

## Transport kinds

| `transport` | Nodemailer target | Required config |
|-------------|-------------------|-----------------|
| `sendmail` (default) | `{ sendmail: true }` or `{ sendmail: { path, args } }` | Optional `sendmailPath`, `sendmailArgs` |
| `direct` | Custom MX delivery via `nodemailerDirectSmtp.ts` (port 25, per-recipient domain) | `NODEMAILER_TRANSPORT=direct`; **recommended for RS Moto VPS** instead of loopback Postfix |
| `smtp` | `{ host, port, secure, auth? }` | `host` (or `SMTP_HOST` env) |
| `service` | `{ service, auth? }` | `service` / `SMTP_SERVICE` |
| `url` | connection URL string | `url` / `NODEMAILER_URL` |
| `ses` | AWS SES via `@aws-sdk/client-ses` | `sesRegion`; AWS credentials in env |
| `stream` | `{ streamTransport: true, buffer: true }` | Debug / tests |
| `json` | `{ json: true }` | Debug |
| `options` | raw `transportOptions` JSON | `transportOptions` / `NODEMAILER_TRANSPORT_OPTIONS` |

Implicit transport selection when unset:

1. `config.transport` / `NODEMAILER_TRANSPORT`
2. If `SMTP_HOST` set → `smtp`
3. Else → `sendmail`

Transport instance is cached per resolved config key (`getNodemailerTransport`).

## Internationalization (i18n)

Keys under `notifications.settings.custom.nodemailer.*` in `packages/core/src/modules/notifications/i18n/{en,pl,de,es}.json`:

- `transport`, `transport.sendmail`, `transport.direct`, `transport.smtp`, …
- `transportHint`, `sendmailPath`, `sendmailArgs`, `sendmailArgsHint`
- `smtpHost`, `smtpPort`, `smtpSecure`, `smtpUser`, `smtpPass`
- `service`, `url`, `sesRegion`, `sesHint`
- `transportOptions`, `transportOptionsInvalid`

Strategy label: `notifications.settings.custom.strategy.nodemailer` → "Email (Nodemailer)".

## UI/UX

Rendered inside **Settings → Module Configs → Notification Delivery** when:

1. `customStrategies` from API includes `nodemailer`
2. Strategy toggle is **enabled**

`NodemailerStrategySettings` shows transport selector and conditional fields (SMTP fields only when `transport === 'smtp'`, etc.). Unset fields display hints that env vars apply on save.

Client registration:

```typescript
// apps/mercato/src/modules/mail_delivery/frontend/registerStrategySettings.ts
registerNotificationDeliveryStrategySettings('nodemailer', NodemailerStrategySettings)
```

Imported from `apps/mercato/src/components/ClientBootstrap.tsx`.

## Configuration

### Environment variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `NOTIFICATIONS_NODEMAILER_ENABLED` | Strategy `defaultEnabled` | `false` |
| `NOTIFICATIONS_SMTP_ENABLED` | Alias for above | `false` |
| `NODEMAILER_TRANSPORT` | Transport kind | inferred (`direct` recommended for MX; `sendmail` = local pipe) |
| `SENDMAIL_PATH` | Sendmail binary | OS default |
| `SENDMAIL_ARGS` | Comma-separated args | — |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | SMTP | port `587`, secure `false` |
| `SMTP_SERVICE` | Well-known service name | — |
| `NODEMAILER_URL` | Connection URL | — |
| `NODEMAILER_TRANSPORT_OPTIONS` | JSON object | — |
| `AWS_REGION` / `AWS_DEFAULT_REGION` | SES region | `us-east-1` |
| `NOTIFICATIONS_EMAIL_FROM` / `EMAIL_FROM` / `ADMIN_EMAIL` | From address | required for send |
| `NOTIFICATIONS_EMAIL_REPLY_TO` | Reply-to | optional |
| `NOTIFICATIONS_EMAIL_SUBJECT_PREFIX` | Subject prefix | optional |
| `APP_URL` | Absolute panel links in email | required for links |
| `NOTIFICATIONS_EMAIL_ENABLED` | Built-in Resend channel | `true` — set `false` when using Nodemailer |
| `OM_DISABLE_EMAIL_DELIVERY` | Global kill switch | `false` |
| `OM_TEST_MODE` | Skip all email delivery | `false` |

Documented in `apps/mercato/.env.example` (Sendmail + SMTP examples).

### Module enablement

```typescript
// apps/mercato/src/modules.ts
{ id: 'mail_delivery', from: '@app' }
```

Module declares `requires: ['notifications']`.

## Migration & Backward Compatibility

- **Additive only**: No changes to built-in Resend strategy contract.
- Strategy id `nodemailer` is stable; renaming would break stored `strategies.custom` JSON.
- New env vars are optional; absent config preserves previous behavior (strategy disabled by default).
- SES requires optional dependency install — documented, not a breaking change.

## Implementation Summary

### Phase 1 — Strategy core ✅

| File | Purpose |
|------|---------|
| `lib/constants.ts` | `NODEMAILER_NOTIFICATION_STRATEGY_ID`, transport kinds |
| `lib/nodemailerConfig.ts` | Env + DB config merge |
| `lib/nodemailerTransport.ts` | Transport builders + cache |
| `lib/nodemailerNotificationDelivery.ts` | `deliver` + `registerNodemailerNotificationDeliveryStrategy` |
| `di.ts` | Server-side registration |
| `index.ts` | Module metadata |

### Phase 2 — Admin UI ✅

| File | Purpose |
|------|---------|
| `frontend/NodemailerStrategySettings.tsx` | Transport config form |
| `frontend/registerStrategySettings.ts` | Client registry wiring |
| `apps/mercato/src/components/ClientBootstrap.tsx` | Import registerStrategySettings |

### Phase 3 — Tests & docs ✅

| File | Purpose |
|------|---------|
| `lib/__tests__/nodemailerNotificationDelivery.test.ts` | Delivery + transport unit tests |
| `lib/nodemailerDirectSmtp.ts` | Direct MX transport (production RS Moto) |
| `lib/nodemailerTransactionalEmail.ts` | `sendTransactionalEmail` for messages module |
| `generators.ts` | Worker/CLI bootstrap registration |
| `apps/mercato/.env.example` | Operator documentation |

### Testing Strategy

| Layer | Coverage |
|-------|----------|
| Unit | `nodemailerNotificationDelivery.test.ts` — sendmail default, SMTP config, skip flags, subject prefix, reply-to |
| Manual | Enable strategy in settings, trigger notification, verify email via stream/json transport in dev |
| Integration | Recommended: `TC-NOTIF-*` extension with Nodemailer + `json` transport asserting payload (future) |

## Risks & Impact Review

#### Duplicate email delivery (Resend + Nodemailer)
- **Scenario**: Both `strategies.email.enabled` and `strategies.custom.nodemailer.enabled` are true
- **Severity**: Medium
- **Affected area**: All notification emails
- **Mitigation**: Document in `.env.example` to disable Resend; admin UI shows both toggles explicitly
- **Residual risk**: Misconfiguration possible; acceptable with operator docs

#### Missing APP_URL / panel link
- **Scenario**: `appUrl` unset → `panelLink` null → strategy skips send
- **Severity**: Medium
- **Affected area**: Email delivery silently fails
- **Mitigation**: Debug logging when `NOTIFICATIONS_DEBUG=true`; admin core settings prompt for app URL
- **Residual risk**: Silent skip without debug env

#### SMTP credentials in module config JSON
- **Scenario**: Tenant config leak exposes SMTP password
- **Severity**: High
- **Affected area**: Tenant isolation / secrets
- **Mitigation**: `notifications.manage` ACL; recommend env-only secrets for production
- **Residual risk**: DB-stored secrets — same as other module configs

#### SES optional dependency
- **Scenario**: Operator selects `ses` without installing SDK
- **Severity**: Low
- **Affected area**: Nodemailer strategy only
- **Mitigation**: Clear error `NODEMAILER_SES_UNAVAILABLE`
- **Residual risk**: Operator must read docs

#### Transport cache staleness
- **Scenario**: Config changed but cached transporter retains old connection
- **Severity**: Low
- **Affected area**: Long-running workers after settings change
- **Mitigation**: Cache keyed on serialized config; new settings produce new key on next send
- **Residual risk**: Rare in practice (serverless/request-scoped DI)

## Final Compliance Report — 2026-06-14

### AGENTS.md Files Reviewed

- `AGENTS.md` (root)
- `packages/core/AGENTS.md` → Notifications
- `packages/core/src/modules/notifications/README.md`

### Compliance Matrix

| Rule Source | Rule | Status | Notes |
|-------------|------|--------|-------|
| root AGENTS.md | Provider modules in app/packages, not core | Compliant | `apps/mercato/src/modules/mail_delivery` |
| root AGENTS.md | No cross-module ORM | Compliant | Uses module config service only |
| SPEC-003 | Custom delivery via `registerNotificationDeliveryStrategy` | Compliant | |
| BACKWARD_COMPATIBILITY | Additive contract surface | Compliant | New strategy id only |
| packages/ui/AGENTS.md | `type="button"` for non-submit | Compliant | Settings form uses Button type=button |

### Internal Consistency Check

| Check | Status |
|-------|--------|
| Config schema matches UI fields | Pass |
| Env example matches resolver | Pass |
| Delivery preconditions documented | Pass |

### Verdict

**Fully compliant** — implemented and deployed in RS Moto Concierge app module.

## Related Specs

- [2026-06-14 — Notification Lifecycle & Email i18n](./2026-06-14-notification-lifecycle-and-email-i18n.md) — end-to-end pipeline
- [2026-06-14 — Notification Delivery & Preferences Settings](./2026-06-14-notification-delivery-settings.md)

## Changelog

### 2026-06-14 (b)
- Added **`direct`** transport (MX/port 25) for VPS deployments where local Postfix is loopback-only.
- Documented **worker bootstrap** via `generators.ts` + `runBootstrapRegistrations()`.
- Added **`sendTransactionalEmail`** hook (`nodemailerTransactionalEmail.ts`) for messages/cases emails.
- Delivery subscriber resolves **recipient locale** before translating notification keys (see lifecycle spec).

### 2026-06-14
- Initial specification documenting implemented Nodemailer notification delivery strategy (`mail_delivery` module).
