# Taxi Fleet — OCR paragonu kierowcy

**Date**: 2026-08-20  
**Status**: Draft / in progress  
**Module**: `taxi_fleet` (`apps/mercato/src/modules/taxi_fleet/`) — app module (nie core)  
**Related**: `.ai/specs/2026-07-03-taxi-fleet-module.md`, `.ai/specs/SPEC-040-2026-02-22-document-parser-module.md`, `packages/core/src/modules/attachments` (OCR), `packages/core/src/modules/customers` (MF VAT whitelist)

## TLDR

**Key Points:**
- Kierowca **zawsze** dołącza zdjęcie/PDF paragonu (dla kursów wymagających income receipt). Numer dokumentu i kwota są **opcjonalne** w PWA.
- Serwer robi structured OCR → zapis w osobnej encji `taxi_fleet_receipt_extractions` → uzupełnia / weryfikuje `financial_entry`.
- Puste pola → OCR wpisuje wynik. Jeśli kierowca podał wartość i OCR zwróci inną → status `needs_review` (operator).
- NIP nabywcy: lookup MF (`wl-api.mf.gov.pl`) jak w CRM; przy trafieniu → ensure company w CRM i podpięcie do kursu/wpisu; przy błędzie/braku → ostrzeżenie operatora.
- Brak finalnego `documentNumber` **blokuje** akceptację tygodniowego rozliczenia.
- Na każdym kursie: podgląd załącznika + wynik OCR + możliwość overwrite przez operatora.

**Scope:**
- Partition `taxi_fleet_driver_receipts` + extract worker w `taxi_fleet`
- Encja extractów, komendy apply/overwrite/retry
- Driver UX + settlement gate + panel na detalach kursu
- Poza scope: pełny `document_parser` (SPEC-040)

**Concerns:**
- Jakość zdjęć; brak `OPENAI_API_KEY`; limity MF API; async OCR vs offline outbox

## Decisions (resolved)

| Q | Decision |
|---|----------|
| Q1 | Zdjęcie zawsze wymagane (gdy kurs wymaga paragonu). Numer/kwota opcjonalne. OCR wypełnia puste; rozjazd z ręcznym inputem → review. |
| Q2 | **B** — osobna encja `taxi_fleet_receipt_extractions` |
| Q3 | **A** — kwota OCR vs `revenueAmount` kursu → tylko ostrzeżenie (nie nadpisuje przychodu kursu) |
| Q4 | NIP: MF whitelist → ensure CRM company + link; wątpliwość/brak → warning |
| Q5 | Brak `documentNumber` na income entry dla wymagających kursów **blokuje** `approved` |

---

## Overview

Funkcja zamyka lukę między uploadem zdjęcia paragonu w driver PWA a wymaganym w rozliczeniach numerem dokumentu. Wykorzystuje vision LLM (jak OCR attachments) do structured JSON oraz istniejącą logikę MF VAT registry do weryfikacji NIP i tworzenia firm CRM.

> **Market Reference**: SPEC-040 document parser (schema-driven extraction) — odrzucony jako pełny moduł na start (zbyt szeroki). Reuse wąskiej ścieżki receipt-only w app module. MF whitelist API — już używane w `customers`.

## Problem Statement

- Ręczne wpisywanie numeru paragonu przez kierowcę jest uciążliwe i błędogenne.
- Samo zdjęcie nie wypełnia `financial_entries.document_number`.
- Operator nie ma jednego miejsca na kursie do podglądu OCR i korekty.
- Akceptacja rozliczenia bez kompletnych numerów dokumentów jest ryzykowna fiskalnie.

## Proposed Solution

1. **Driver**: wymagane zdjęcie; opcjonalny numer/kwota (awaryjnie).
2. **Upload** → partition OCR + utworzenie `receipt_extraction` (`pending`).
3. **Worker**: vision extract → Zod → update extraction (`extracted` / `needs_review` / `failed`).
4. **Apply rules**: merge driver input + OCR → `financial_entry.documentNumber` / amount flags / NIP→CRM.
5. **Settlement**: approve zablokowane gdy brakuje numeru na wymaganych income entries.
6. **Trip detail**: panel dokumentu + OCR + overwrite / retry.

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| Osobna encja extractów | Audit trail, retry, oddzielenie od financial_entry, wiele prób OCR |
| Async extract (nie blokuje submit) | Offline / słaba sieć; kierowca kończy kurs od razu |
| Kwota kursu nienaruszalna przez OCR | Przychód kursu pochodzi z taryfy/PWA; OCR tylko porównuje |
| MF lookup przed CRM write | Unika śmieciowych firm z błędnie odczytanego NIP |

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Pełny `document_parser` | Za duży scope; brak gotowej implementacji |
| Tylko `attachment.content` | Brak statusów, apply rules, NIP/CRM |
| Blokada trip submit na OCR | Fatalne UX offline / timeout |

## User Stories

- **Kierowca** chce zrobić tylko zdjęcie paragonu, żeby zakończyć kurs bez przepisywania numeru.
- **Operator** chce na kursie zobaczyć zdjęcie + wynik OCR i nadpisać pola przy błędzie.
- **Operator** chce, by akceptacja rozliczenia nie przeszła, gdy brakuje numerów dokumentów.
- **System** chce przy poprawnym NIP automatycznie uzupełnić firmę CRM.

## Architecture

```
Driver PWA (photo required)
  → POST /api/taxi_fleet/driver/attachments
      partitionOverride=taxi_fleet_driver_receipts
      create receipt_extraction (pending)
      schedule processReceiptExtraction (setImmediate / worker)
  → POST /api/taxi_fleet/driver/trips (+ optional number/amount)
      create financial_entry (may have null documentNumber)
      link extraction.financial_entry_id / trip_id
      if extraction already extracted → applyReceiptExtraction

processReceiptExtraction
  → LLM vision structured JSON
  → validate Zod + NIP checksum
  → MF registry lookup (buyerNip)
  → status extracted | needs_review | failed
  → applyReceiptExtraction (when financial_entry linked)
  → emit taxi_fleet.receipt_extraction.completed

Weekly settlement approve
  → assertAllRequiredIncomeDocumentNumbersPresent(week)
  → 409 if missing
```

### Commands & Events

- **Command**: `taxi_fleet.receipt_extractions.apply`
- **Command**: `taxi_fleet.receipt_extractions.overwrite` (operator)
- **Command**: `taxi_fleet.receipt_extractions.retry`
- **Event**: `taxi_fleet.receipt_extraction.completed` (persistent)
- **Event**: `taxi_fleet.receipt_extraction.needs_review` (persistent)

Naming: singular entity `receipt_extraction` / command ids use plural table style only in DB table name `taxi_fleet_receipt_extractions`.

## Data Models

### ReceiptExtraction (singular)

Table: `taxi_fleet_receipt_extractions` — **use** `taxi_fleet_receipt_extractions` (plural tables).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid | required |
| `organization_id` | uuid | required |
| `attachment_id` | uuid | FK id only → attachments |
| `trip_id` | uuid null | |
| `financial_entry_id` | uuid null | |
| `status` | text | `pending` \| `processing` \| `extracted` \| `needs_review` \| `failed` \| `applied` |
| `driver_document_number` | text null | optional input from driver |
| `driver_amount` | numeric null | optional input from driver |
| `ocr_document_number` | text null | |
| `ocr_gross_amount` | numeric null | |
| `ocr_buyer_nip` | text null | normalized digits |
| `ocr_seller_nip` | text null | |
| `ocr_occurred_at` | timestamptz null | |
| `confidence` | numeric(4,3) null | 0–1 |
| `raw_text_excerpt` | text null | |
| `model` | text null | |
| `warnings_json` | jsonb null | amount_mismatch, nip_invalid, nip_not_found, field_conflict, … |
| `resolved_company_id` | uuid null | customer company created/found |
| `applied_document_number` | text null | final after apply/overwrite |
| `error_message` | text null | |
| `processed_at` | timestamptz null | |
| `created_at` / `updated_at` / `deleted_at` | | standard |

Indexes: `(tenant_id, organization_id)`, `(attachment_id)`, `(trip_id)`, `(financial_entry_id)`, `(status)`.

### Apply merge rules

For each of `documentNumber` and (optionally stored) driver amount:

| Driver | OCR | Result |
|--------|-----|--------|
| empty | value | write OCR; OK |
| value | empty | keep driver; warning `ocr_missing_field` |
| value | same (normalized) | keep; OK |
| value | different | **do not overwrite**; `needs_review` + warning `field_conflict` |
| empty | empty | leave empty; blocks settlement approve |

Amount vs **trip revenue**: if both finite and `|ocr - revenue| > tolerance` (np. 0.05 PLN) → warning `amount_mismatch_trip` (nie zmienia `trip.revenueAmount` ani domyślnie `financial_entry.amount` — kwota income entry pochodzi z przychodu kursu).

NIP:

1. Normalize + checksum (`isValidNip`).
2. Invalid → warning `nip_invalid`, no CRM write.
3. Valid → `fetchCompanyFromMfVatRegistry`.
4. Not found / API error → warning `nip_not_found` / `nip_lookup_failed`, `needs_review` if no other hard conflicts.
5. Found → find company by NIP in tenant/org or create via customers command; set `customer_company_id` on trip + financial_entry when previously empty or person-only (policy: if trip already has company with different NIP → warning `customer_nip_conflict`, needs_review).

## API Contracts

### POST `/api/taxi_fleet/driver/attachments`

Unchanged shape; internally:
- `partitionOverride: 'taxi_fleet_driver_receipts'`
- creates `receipt_extraction` pending + schedules processing
- Response may include `extractionId`

### POST `/api/taxi_fleet/driver/trips`

- Requires `receiptAttachmentId` when platform requires income receipt (own fleet).
- `receiptDocumentNumber` / optional amount remain optional.
- Links extraction; applies if ready.

### GET `/api/taxi_fleet/trips/:id/receipt-extraction`

- Auth: `taxi_fleet.manage_trips` or view
- Returns extraction + attachment preview URL + warnings

### POST `/api/taxi_fleet/receipt-extractions/:id/retry`

- Feature: `taxi_fleet.manage_trips`
- Re-queue OCR

### POST `/api/taxi_fleet/receipt-extractions/:id/overwrite`

- Body: `{ documentNumber?, buyerNip?, applyToFinancialEntry?: true }`
- Operator force-apply; clears conflict warnings for overwritten fields; status → `applied`

### Settlement update → `approved`

- Server-side guard: all week trips that require income receipt must have income entry with non-empty `document_number` (and ideally extraction not in `pending`/`processing` — configurable; **MUST**: document number present).

All routes: `openApi` + zod + tenant/org scope.

## Internationalization (i18n)

Keys under `taxi_fleet.receiptOcr.*` and `taxi_fleet.driverApp.receipt.*` (PL+EN):
- photo required / OCR pending / needs review / failed
- warnings: field conflict, amount mismatch, nip invalid/not found
- settlement blocked: missing document numbers
- operator overwrite / retry labels

## UI/UX

### Driver PWA
- Photo primary CTA; required validation before submit.
- Document number field: optional, collapsed or labeled „opcjonalnie (awaryjnie)”.
- Hint: „Numer odczytamy ze zdjęcia”.

### Trip detail (operator)
- Section „Paragon / OCR”: thumbnail/link, status badge, extracted fields, warnings list.
- Actions: Open file, Retry OCR, Overwrite (dialog) — `Cmd+Enter` / Escape.

### Settlement
- Approve button disabled or 409 with list of trips missing document numbers.
- Documents tab already flags missing receipts — extend with OCR status / missing number.

## Configuration

| Env / setting | Purpose |
|---------------|---------|
| `OPENAI_API_KEY` | Vision extract (shared with attachments OCR) |
| `OCR_MODEL` / partition `ocr_model` | Model override |
| `TAXI_FLEET_RECEIPT_OCR_ENABLED` | Kill-switch (default true when key present) |
| Partition `taxi_fleet_driver_receipts` | `requires_ocr=true` |

Seed partition in `setup.ts` / ensure helper.

## Migration & Compatibility

- Additive table only — BC OK.
- Driver API: making photo required is behavior change for clients that submitted number-only — acceptable (product decision); document in changelog.
- No rename of existing fields.

## Implementation Plan

### Phase 1 — Data + apply rules
1. Entity `TaxiFleetReceiptExtraction` + migration
2. Zod validators + pure `applyReceiptFieldMerge` / warning builders + unit tests
3. Events registration

### Phase 2 — Extract pipeline
1. Ensure partition helper
2. `receiptExtractionService` (LLM structured JSON)
3. Queue after driver attachment upload
4. Link + apply on trip/financial_entry create

### Phase 3 — Driver UX + settlement gate
1. Required photo validation (PWA + API)
2. Optional number copy
3. Block settlement approve without document numbers

### Phase 4 — Operator UI
1. Trip detail receipt/OCR panel
2. Overwrite + retry endpoints/commands
3. Settlement documents surfacing warnings

### Phase 5 — Hardening
1. Unit + integration tests
2. i18n PL/EN
3. Spec changelog / compliance

### File Manifest (expected)

| File | Action |
|------|--------|
| `data/entities.ts` | Add entity |
| `migrations/Migration20260820120000.ts` | Create |
| `lib/receiptExtraction*.ts` | Create |
| `commands/receiptExtractions.ts` | Create |
| `api/driver/attachments/route.ts` | Modify |
| `api/driver/trips/route.ts` | Modify |
| `commands/settlements.ts` | Modify (approve gate) |
| `components/driverApp/DriverReceiptFields.tsx` | Modify |
| `components/TripReceiptOcrPanel.tsx` | Create |
| `backend/.../trips/[id]/page.tsx` | Modify |
| `events.ts` / `setup.ts` | Modify |
| `i18n/pl.json`, `en.json` | Modify |

### Testing Strategy

- Unit: merge rules, NIP normalize, amount mismatch tolerance, settlement gate predicate
- Integration: upload → extraction row; overwrite; approve blocked without document number
- Manual: real receipt photo with `OPENAI_API_KEY`

## Risks & Impact Review

#### OCR unavailable / timeout
- **Scenario**: Brak klucza API lub model timeout
- **Severity**: High
- **Affected area**: documentNumber pozostaje puste; settlement approve zablokowane
- **Mitigation**: status `failed`; operator overwrite z podglądu zdjęcia; retry
- **Residual risk**: Ręczna praca operatora przy outage LLM

#### Wrong OCR number applied
- **Scenario**: Model odczyta zły numer gdy pole było puste
- **Severity**: High
- **Affected area**: financial_entry, rozliczenia
- **Mitigation**: confidence + needs_review threshold; operator overwrite; audit na extraction
- **Residual risk**: Błąd przy wysokim confidence bez review

#### MF API rate limit
- **Scenario**: Wiele paragonów / dzień przekracza limit wl-api
- **Severity**: Medium
- **Affected area**: auto CRM company
- **Mitigation**: warning `nip_lookup_failed`; nie blokuje document number apply; retry later
- **Residual risk**: Opóźnione linkowanie firmy

#### Race: trip create before OCR finishes
- **Scenario**: financial_entry bez numeru, OCR kończy się później
- **Severity**: Medium
- **Affected area**: apply timing
- **Mitigation**: apply on OCR complete if `financial_entry_id` set; apply on link if already extracted
- **Residual risk**: Krótke okno bez numeru (OK — approve i tak blokuje)

#### Tenant isolation
- **Scenario**: Extraction/attachment cross-tenant
- **Severity**: Critical if buggy
- **Affected area**: attachments, CRM
- **Mitigation**: always filter tenant_id + organization_id; MF create in same scope
- **Residual risk**: Low if conventions followed

### Cascading / side effects
- CRM company create via customers commands/API — no direct ORM across modules.
- Events persistent for notifications (optional later).

### Migration
- Additive, no downtime, no backfill required (new uploads only; optional later backfill).

## Final Compliance Report — 2026-08-20

### AGENTS.md Files Reviewed
- `AGENTS.md` (root)
- `.ai/specs/AGENTS.md`
- `.ai/skills/spec-writing/SKILL.md`
- `packages/core/AGENTS.md` (attachments/customers patterns via reuse)
- Module lives in `apps/mercato` — no core contract change

### Compliance Matrix

| Rule Source | Rule | Status | Notes |
|-------------|------|--------|-------|
| root AGENTS.md | No direct ORM relationships between modules | Compliant | FK IDs only to attachments/customers |
| root AGENTS.md | Filter by organization_id | Compliant | All queries scoped |
| root AGENTS.md | Singular event IDs | Compliant | `taxi_fleet.receipt_extraction.*` |
| root AGENTS.md | Zod validation | Compliant | Planned on all APIs |
| BACKWARD_COMPATIBILITY | Additive schema | Compliant | New table only |
| SPEC-040 | Full document_parser | N/A deferred | Explicitly out of scope |

### Internal Consistency Check

| Check | Status | Notes |
|-------|--------|-------|
| Data models match API contracts | Pass | |
| API contracts match UI/UX | Pass | |
| Risks cover write operations | Pass | |
| Commands for mutations | Pass | apply/overwrite/retry |
| Settlement gate vs Q5 | Pass | |

### Non-Compliant Items
None for draft approval.

### Verdict
**Fully compliant** for implementation in `apps/mercato` taxi_fleet module.

## Changelog

### 2026-08-20 (implementation)
- Encja + migracja `taxi_fleet_receipt_extractions`.
- OCR pipeline (vision) + partition `taxi_fleet_driver_receipts`.
- Tworzenie firmy CRM z MF (worker EM + commandBus fallback).
- Driver: zdjęcie wymagane; numer opcjonalny.
- Settlement approve gate bez `documentNumber`.
- Panel OCR na detalach kursu (podgląd / retry / overwrite).
- `yarn generate` — route `trips/[id]/receipt-extraction`.

### 2026-08-20 (implementation started)
- Domknięte decyzje Q1–Q5; pełna spec.
- Phase 1–4 w toku: encja `taxi_fleet_receipt_extractions`, merge rules + testy, partition, OCR pipeline, driver photo required, settlement approve gate, panel OCR na detalach kursu.

### 2026-08-20
- Skeleton + Open Questions.
- Resolved Q1–Q5; full architecture, entity, apply rules, APIs, phases, risks, compliance.
- Placement: app module `taxi_fleet` (not core / not full document_parser).
