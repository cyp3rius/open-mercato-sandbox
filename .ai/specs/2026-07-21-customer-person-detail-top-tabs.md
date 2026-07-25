# Customer / Person detail — top tabs shell (Details first)

**Status:** Implemented  
**Date:** 2026-07-21  
**Scope:** OSS (`packages/core` customers + sales/cases/insurance create prefills)  
**Related:** SPEC-046 (customer detail v2), SPEC-046b, SPEC-041i, `2026-07-20-simple-sales-surfaces.md`

## TLDR

Górny pasek tabów na detail osoby/firmy (v1 + v2): **Szczegóły** (domyślnie) = dotychczasowy Zone 1; dotychczasowe Zone 2 + **Orders / Quotes / Cases / Policies** (simple / po `customerEntityId`); Add = deep-link create z prefillem klienta i opiekuna. Wspólne komponenty tabów domenowych najpierw; pełna unifikacja page shell później.

## Locked decisions

| Q | Choice |
|---|--------|
| Q1 | **C** — v1 i v2 (`people`, `people-v2`, `companies`, `companies-v2`) |
| Q2 | **A** — Szczegóły = CrudForm/highlights + Tags + saveGuide |
| Q3 | **C** — pełna treść nowych tabów od razu |
| Q4 | **B** — tylko simple: zamówienia, oferty, szanse |
| Q5 | **A** — sprawy/polisy po `customerEntityId` |
| Q6 | **B** — deep-link create + prefill customer + owner (edytowalny) |
| Q7 | **C** — wspólne taby domenowe najpierw; shell unifikacja później |
| Q8 | **A** — UMES injected tabs na górnym pasku |
| Q9 | **C** — kanoniczne id + aliasy `?tab=` |

## Target tab bar

Canonical ids: `details` (default), `notes`, `activities`, `deals`, `quotes`, `orders`, `addresses`, `tasks`, `resources`, `people` (company), `cases`, `policies`, + injected.

Aliases: absent `tab` → `details`; legacy related ids unchanged.

## Shared components

Under `packages/core/src/modules/customers/components/detail/`:

- `customerEntityDetailTabs.ts` — resolve tab + build tab defs
- `customerEntityCreatePrefill.ts` — create URLs
- `CustomerEntityOrdersTab.tsx` / `QuotesTab` / `CasesTab` / `PoliciesTab`

## Implementation notes

- Create deep-links: kind-specific id only — `personId` (person) or `companyId` (company) — plus optional `ownerUserId`. Create pages map those to `customerEntityId` / deal people-company fields. Do not dual-set `customerEntityId` + `personId`.
- Prefill surfaces resolve display labels via API (no raw UUID in comboboxes): `SimpleDocumentEditor`, cases create, simple-deals (DealForm by-id fetch).
- Prefill surfaces: `SimpleDocumentEditor`, `simple-deals/create`, `cases/create`, `insurance-desk/policies/create`.
- Deals Add uses `createHref` → simple-deals (dialog retained for edit).
- **Deal → quote:** „Convert to quote” navigates to simple quote create with prefill (`sourceDealId`, customer, owner, currency, `dealTitle`) — does **not** create the quote immediately. Linking (`payload.simpleQuoteId`) happens on quote save.

## Phasing

1. Spec lock — done  
2. Shell v2 — done  
3. Domain tabs + i18n — done  
4. Prefill create pages — done  
5. Shell v1 — done  

## Out of scope

- Jedna wspólna `CustomerEntityDetailPage`  
- Non-simple sales docs na tych tabach  
- Nowe tabele / model danych  
