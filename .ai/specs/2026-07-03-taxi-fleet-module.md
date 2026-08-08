# Taxi Fleet Module — fleet calendar, trips, settlements

## TLDR

**Key Points:**
- App module `taxi_fleet` for RS Moto: daily driver↔film-car assignments, trip logging, weekly settlements.
- **Driver profile** = extension of `staff.StaffTeamMember` (`team_member_id` FK); only profiled staff participate in fleet ops.
- Reuses `staff`, `resources`, `planner` (availability); driver JWT API for mobile app.
- Phase 2: public booking + checkout pay links.

## Domain rules

### Driver profile ↔ Staff

- `taxi_fleet_driver_profiles.team_member_id` → `staff_team_members.id` (1:1 per tenant/org).
- Profile **extends** a staff employee — not a standalone person record.
- Backend UI: pick employee from `/backend/staff/team-members` when creating a profile; link back to staff detail.
- **Assignments, trips, settlements** always reference `team_member_id` that must have an active driver profile.

### Calendar (assignments UI)

Widok **Planowanie kursów** (`/backend/taxi-fleet/assignments`) — tygodniowy (domyślnie), miesięczny, dzienny i agenda. Zawsze renderowany, także bez danych.

Na siatce: **przydziały** kierowca–pojazd (zielone bloki) oraz **przejazdy** (niebieskie bloki).

- **Empty slot click** → create trip dialog (prefilled start/end from slot).
- **Assignment block click** → create trip dialog (prefilled driver, vehicle, times, `assignment_id`).
- **Trip block click** → trip detail.
- **New trip** in **PageHeader** actions (`Plus` + i18n label, CRUD pattern).
- **Driver filter** via **FilterBar** combobox (CRUD-style), not free-text search.
- Timezone picker hidden on fleet calendar (`showTimezone={false}`).
- Suggested drivers shown in create dialog; all trip/assignment/settlement labels i18n.

Only profiled staff can be assigned as drivers (server-side).

### Trip statuses

Słownik statusów w ustawieniach modułu (`settingsJson.tripStatuses`) — dowolne wpisy z polami `code`, `label`, `icon`, `color`, `onEnterActions`. Domyślnie: `new`, `approved`, `paid`, `scheduled`, `completed`, `cancelled`.

Per status: konfigurowalne `label`, `icon`, `color` (hex) oraz `onEnterActions` — wykonywane przez `applyTripStatusChange`.

### Driver vs operator (backend CRM)

- **Kierowca** (`taxi_fleet.driver` bez `manage_trips`): widzi tylko kursy z `team_member_id` powiązanym z kontem CRM; może tworzyć/edytować własne kursy w kalendarzu.
- **Operator** (`manage_trips` / `manage_assignments`): pełny widok; planuje kursy za dowolnego kierowcę.

### Settlements

- Generated and displayed **per driver profile** (`team_member_id` + profile settings e.g. `payout_percent`).
- UI shows staff display name, not raw UUID.

### Trip driver suggestions

When operator creates/receives a trip with `started_at` / `ended_at`:

- API `GET /api/taxi_fleet/trips/suggest-drivers?startedAt=&endedAt=` returns ranked candidates.
- Ranking considers: daily assignment on date, no overlapping trip, planner availability (member rules when configured).
- UI shows suggested driver(s) on trip detail / create flow.

## Data Models (Phase 1)

- `taxi_fleet_driver_profiles` — `team_member_id`, `payout_percent`, `default_resource_id`, `external_app_enabled`
- `taxi_fleet_daily_assignments` — date, `team_member_id`, `resource_id`, shift, status
- `taxi_fleet_trips`, `taxi_fleet_trip_cost_lines`, `taxi_fleet_financial_entries` (paragony/faktury + koszty), `taxi_fleet_weekly_settlements`
- Każdy przejazd wymaga powiązania z klientem CRM (`customer_person_id` lub `customer_company_id`); w API można przekazać `customerEntityId`.

## API (Phase 1)

| Method | Path | Notes |
|--------|------|-------|
| CRUD | `/api/taxi_fleet/driver-profiles` | Profile CRUD; `team_member_id` must exist in staff |
| CRUD | `/api/taxi_fleet/assignments` | Rejects non-profiled `team_member_id` |
| CRUD | `/api/taxi_fleet/trips` | Wymagany klient (`customerEntityId` lub `customerPersonId` / `customerCompanyId`); odrzuca kierowcę bez profilu; `?unscheduled=true` zwraca kursy bez `team_member_id` |
| POST | `/api/taxi_fleet/trips/inject` | Strapi/kalkulator → niezaplanowany kurs (`new`); idempotencja po `externalId` |
| GET | `/api/taxi_fleet/session` | Kontekst backendu: rola operator/kierowca, `lockedTeamMemberId` dla kierowcy |
| GET | `/api/taxi_fleet/trips/suggest-drivers` | Availability-based driver ranking |
| GET | `/api/taxi_fleet/route/places-autocomplete` | Address autocomplete (OpenRouteService proxy) |
| POST | `/api/taxi_fleet/route/distance` | Driving distance + duration for route stops |
| POST | `/api/taxi_fleet/quote` | Trip price quote from fleet pricing settings (tariffs, surcharges) |
| GET | `/api/taxi_fleet/route/reverse-geocode` | Reverse geocode coordinates to address |
| POST | `/api/taxi_fleet/trips/{id}/approve` | Operator approval |
| CRUD | `/api/taxi_fleet/financial-entries` | Paragony/faktury (wpływy) i koszty kierowcy |
| CRUD | `/api/taxi_fleet/settlements` | Per driver profile week |
| Driver JWT | `/api/taxi_fleet/driver/*` | Mobile app |

## UI (Phase 1)

| Path | Description |
|------|-------------|
| `/backend/taxi-fleet` | Hub — kursy oczekujące, harmonogram tygodnia, skróty do modułów |
| `/backend/config/taxi-fleet` | Ustawienia modułu — typ zasobu pojazdów, wypłata, PayPal, kalendarz, maile do klienta |
| `/backend/taxi-fleet/drivers` | Profiles linked to staff; DataTable list + create page |
| `/backend/taxi-fleet/drivers/create` | Create driver profile (CrudForm) |
| `/backend/taxi-fleet/assignments` | Planowanie kursów — kalendarz przydziałów i przejazdów |
| `/backend/taxi-fleet/trips`, `/trips/[id]` | List + detail with driver suggestions |
| `/backend/taxi-fleet/settlements` | Per-profile weekly settlements |

## Events

- `taxi_fleet.assignment.created`, `.updated`
- `taxi_fleet.trip.created`, `.assigned`, `.paid`, `.submitted`, `.approved`, `.cancelled`
- `taxi_fleet.financial_entry.created`
- `taxi_fleet.settlement.submitted`, `.approved`

## CRM notifications (configurable per user)

| Notification | Trigger |
|--------------|---------|
| Nowe zlecenie kursu | `taxi_fleet.trip.created` (inject / zlecenie klienta) |
| Kurs przypisany | `taxi_fleet.trip.assigned` → użytkownik CRM powiązany z kierowcą |
| Kurs opłacony | `taxi_fleet.trip.paid` (PayPal, komenda `taxi_fleet.trips.mark_paid`) |
| Kurs potwierdzony | `taxi_fleet.trip.approved` |
| Kurs anulowany | `taxi_fleet.trip.cancelled` (źródło: klient / operator / kierowca) |
| Faktura/paragon | `taxi_fleet.financial_entry.created` (`kind=income`) |
| Koszt | `taxi_fleet.financial_entry.created` (`kind=expense`) |
| Rozliczenie gotowe | `taxi_fleet.settlement.approved` → kierowca (powiązany user CRM) |

Preferencje użytkownika: `/backend/profile/notifications` (`NotificationPreferencesEditor`).

## Changelog

### 2026-07-17
- Wycena: dopłaty procentowe `NIGHT` + `HOLIDAY` w trybie **stack** (łącznie +40% od `basePrice`); minimalne wyprzedzenie zamówienia **24 h** (UI create); max pasażerów **8**.

### 2026-07-16
- Wycena kursu: silnik kalkulatora RS Moto (`lib/pricing`), konfiguracja taryf w `settingsJson.pricing`, `POST /api/taxi_fleet/quote`; formularz kursu automatycznie wylicza cenę (bez ręcznego pola „Przychód”).
- Formularz trasy: autouzupełnianie adresów (OpenRouteService, jak kalkulator RS Moto), geolokalizacja, przystanki z podpowiedziami, automatyczne wyliczanie dystansu i czasu (`GET /api/taxi_fleet/route/places-autocomplete`, `POST /api/taxi_fleet/route/distance`, `GET /api/taxi_fleet/route/reverse-geocode`; env `OPENROUTESERVICE_API_KEY`).
- Formularz przejazdu: pełna definicja zgodna z kalkulatorem RS Moto (trasa, pasażerowie, bagaż, lotnisko, kontakt, płatność); zakładki w dialogu tworzenia; dane w `metadata.tripRequest`.

### 2026-07-15
- Naprawa seeda fieldsetów pojazdu: sync typu „Pojazd (Taxi)” nie nadpisuje już konfiguracji pustą listą fieldsetów; przy pustej konfiguracji przywraca domyślne / rodzicielskie fieldsety (GET `/api/taxi_fleet/settings`).

### 2026-07-14 (h)
- Typ zasobu „Pojazd (Taxi)” korzysta z tych samych pól niestandardowych pojazdu co „Pojazd (wewnętrzny)” (`resources_resource_vehicle`); seed modułu tworzy typ i dopina go do fieldsetu pojazdu.

### 2026-07-14 (g)
- Słownik statusów kursów: w pełni konfigurowalny (dodawanie/usuwanie wpisów, własny kod, etykieta, ikona, kolor); lista i formularze kursów korzystają ze słownika organizacji.

### 2026-07-14 (f)
- Ustawienia statusów kursów: standardowy słownik (`label`, `icon`, `color`); akcje/powiadomienia dodawane i usuwane z listy; szczegóły rozwijane na żądanie.

### 2026-07-14 (e)
- Słownik statusów kursów w ustawieniach modułu (`new`, `approved`, `paid`, `scheduled`, `completed`, `cancelled`) z konfigurowalnymi akcjami po wejściu w status (powiadomienia CRM, maile do klienta).
- Widok kierowcy: `GET /api/taxi_fleet/session`; listy i API filtrują po `team_member_id` powiązanym z użytkownikiem CRM; kierowca edytuje tylko własne kursy; operator planuje za innych w kalendarzu.

### 2026-07-14 (d)
- Powiadomienia CRM floty taksówkowej: 8 konfigurowalnych typów + preferencje użytkownika; eventy lifecycle; komendy `taxi_fleet.trips.cancel`, `taxi_fleet.trips.mark_paid`.

## Integration Tests

- TC-TAXI-001: assignment conflict on duplicate date
- TC-TAXI-002: reject assignment for staff without driver profile
- TC-TAXI-003: trip driver suggestions return profiled drivers
- TC-TAXI-004: driver trip submit + operator approve
- TC-TAXI-005: weekly settlement per driver profile

## Changelog

| GET/PUT | `/api/taxi_fleet/settings` | Ustawienia organizacji (flota, integracje, szablony maili) |

### 2026-07-14 (c)
- Ustawienia modułu (`/backend/config/taxi-fleet`): typ zasobu pojazdów, domyślny % wypłaty, PayPal, Google Calendar, szablony maili do klienta (nowe zlecenie, zatwierdzenie, opłacenie, anulowanie).

### 2026-07-14 (b)
- Wstrzykiwanie kursów ze Strapi/kalkulatora: `POST /api/taxi_fleet/trips/inject` (feature `taxi_fleet.trips.inject`), mapowanie payloadu `taxi-requests`, idempotencja po `externalId`; kursy bez kierowcy/pojazdu (`team_member_id` / `resource_id` nullable).
- Hub floty: widżety „kursy oczekujące” i „harmonogram tygodnia”; hub na pierwszym miejscu w sekcji Flota w sidebarze.
- Planowanie kursów: `FormHeader` z powrotem do hubu + breadcrumb; lista przejazdów filtr `?unscheduled=1`.

### 2026-07-14
- Profile kierowców: standardowy CRUD — tworzenie na pełnej stronie `/drivers/create` (`CrudForm` + `groups`); lista linkuje do create zamiast dialogu.

### 2026-07-13 (b)
- Sekcja rozliczeń kierowcy: rejestracja paragonów/faktur (wpływy) i kosztów (wydatki) w `taxi_fleet_financial_entries` z CRUD API; tygodniowe rozliczenia liczone z tych wpisów.

### 2026-07-13
- Tworzenie profilu kierowcy w dialogu na liście (`DriverProfileCreateDialog`); strona `/drivers/create` usunięta; szczegóły profilu bez zmian.

### 2026-07-03 (h)
- Przejazdy, profile kierowców i rozliczenia: pełny CRUD (DataTable + CrudForm create/detail) zgodny z konwencjami platformy.

### 2026-07-03 (g)
- Przejazdy wymagają klienta CRM (osoba lub firma); picker w formularzu tworzenia z opcją utworzenia klienta w nowej karcie.

### 2026-07-03 (f)
- UI copy: „Planowanie kursów” zamiast „Kalendarz przydziałów”; realistyczne opisy bez odniesień do Google Calendar.

### 2026-07-03 (e)
- Calendar: hide timezone; CRUD FilterBar for driver; PageHeader “New trip” action; full i18n for trip/assignment/settlement labels.

### 2026-07-03 (d)
- Calendar always visible without assignments; trips on grid; create trip from slot, assignment, or toolbar.

### 2026-07-03 (c)
- Kalendarz planowania oparty o `ScheduleView` (react-big-calendar).

### 2026-07-03 (b)
- Driver profile = staff extension; calendar week/month/day views; profile-only assignments; trip driver suggestions; spec aligned with UI.

### 2026-07-03
- Initial spec and Phase 1 implementation.
