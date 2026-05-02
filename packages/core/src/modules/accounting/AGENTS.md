# Accounting Module — Agent Guidelines

Używaj modułu `accounting` jako prostego rejestru faktur księgowych:
- faktury wystawiane w systemie (`issued`),
- faktury kosztowe importowane z zewnątrz (`imported_cost`),
- faktury sprzedażowe wygenerowane poza systemem (`imported_sales`).

## MUST Rules

1. **MUST rozdzielać rodzaj dokumentu przez `documentKind`** i nie mieszać importów z wystawianiem.
2. **MUST ustawiać typ importu w kodzie trasy** (`import-cost` => `imported_cost`, `import-sales` => `imported_sales`) — bez przełącznika typu w UI.
3. **MUST najpierw utworzyć rekord faktury, potem upload pliku** (`entityId` + `recordId`).
4. **MUST używać pola wyszukiwania `EntitySearchCombobox`** dla wyboru/otwarcia faktury.
5. **MUST trzymać się zakresu modułu**: to rejestr i dokumenty, a nie pełna księga ani zastępstwo workflow z modułu `sales`.

## Kluczowe ścieżki

| Obszar | Plik / katalog |
|---|---|
| Encja i walidacja | `data/entities.ts`, `data/validators.ts` |
| API CRUD | `api/invoices/route.ts`, `api/openapi.ts` |
| Komendy | `commands/invoices.ts` |
| Wyszukiwanie | `search.ts`, `lib/accountingEntitySearch.ts` |
| Ekrany backendu | `backend/accounting/**` (hub, faktury) |
| Ustawienia (hub sprzedające) | `backend/config/accounting/**` — **URL:** `/backend/config/accounting` |
| Formularz importu | `components/AccountingInvoiceImportForm.tsx` |

## Interakcja UI

- **Hub** (`backend/accounting/page.tsx`) — wzorzec jak **lista modułowa DataTable** (`.cursor/rules/backend-module-list-datatable.mdc`, referencja: procurement processes):
  - `Page` + `PageBody` (bez `PageHeader`); **zakładki** (Sales / Cost / Drafts) **nad** jedną tabelą,
  - `DataTable`: `title` + `description` (lead), **`refreshButton`**, **`actions`**: tylko **ikona** ustawień (`IconButton` → `/backend/config/accounting`), **import** jako **przycisk z samą ikoną** (`Upload`) otwierający **Popover** z linkami do importu kosztu i sprzedaży, główny CTA **Wystaw fakturę** z ikoną **`Plus`**,
  - wyszukiwanie, paginacja, `listScope` w API.
- **Lista** (`/backend/accounting/invoices`):
  - przekierowanie na hub (zachowanie zapytania w URL).
- **Wystawienie** (`/create`):
  - tworzy rekord z `documentKind = issued`.
- **Import kosztu/sprzedaży**:
  - używa wspólnego formularza,
  - przesyła pojedynczy plik faktury,
  - ustawia `documentKind` przez kod strony.
- **Detal** (`/[id]`):
  - edycja danych nagłówkowych,
  - sekcja załączników dla dokumentu.

## Upload pojedynczej faktury

Import używa jednego pola pliku (`invoiceFile`) i wykonuje:
1. `POST /api/accounting/invoices` (tworzenie rekordu),
2. `POST /api/attachments` z:
   - `entityId = accounting:accounting_invoice`,
   - `recordId = <id utworzonej faktury>`,
   - `file = <plik faktury>`.

## Uprawnienia

- Podgląd: `accounting.invoices.view`
- Zarządzanie (create/update/delete/import): `accounting.invoices.manage`

## Dobre praktyki zmian

- Używaj kluczy i18n `accounting.*` we wszystkich nowych etykietach.
- Przy nowych polach aktualizuj jednocześnie:
  - encję,
  - walidatory,
  - API i komendy,
  - formularze create/import/detail,
  - indeks wyszukiwania (`search.ts`).
