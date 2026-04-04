# Phase 2 — Client, opportunity, and client portfolio

**Status:** Implemented in-repo (API + web + Alembic `phase2_003`). Depends on Phase 1 (JWT, org scope).

## Data model

- `**Product`** — Org-scoped catalog (`name`, `category`, `risk_level`, `active`, …). Seeded rows for the `default` org in the migration (MVP placeholders).
- `**LineOfBusiness**` — Org-scoped LOB catalog (`code`, `name`). Initial seed: `MOTOR`, `LIFE`, `HEALTH` for `default`. Migration **`mvp_catalog_007`** narrows MVP to **Auto (Motor)** (`MOTOR`), **Ramos elementares** (`GENERAL`), **Vida (Life)** (`LIFE`), removes unused `HEALTH` when safe, and seeds three matching **Product** rows (`target_tags = mvp_catalog_v1`).
- `**Client**` — `organization_id`, optional `external_id` / `email` (partial unique indexes per org), `full_name`, contact fields, notes.
- `**ClientLineOfBusiness**` — Client ↔ LOB with `**ingestion_source**` (e.g. `internal_crm`).
- `**ClientHeldProduct**` — Optional FK to `**Product**`, insurer, policy dates/status, `**ingestion_source**`.
- `**Opportunity**` — `client_id`, `owner_id` (user), optional `product_id`, value, probability, `**OpportunityStage**` / `**OpportunityStatus**`, source, `next_action`, timestamps.

Enums match `docs/OPPORTUNITY.md` stages (`LEAD` … `CLOSED_LOST`) and open/won/lost status. `POST /v1/opportunities/{id}/stage` aligns **status** with terminal stages (e.g. `CLOSED_WON` → `WON`).

## API (`/v1`, Bearer JWT)


| Area          | Endpoints                                                                    |
| ------------- | ---------------------------------------------------------------------------- |
| Clients       | `GET/POST /clients`, `GET/PATCH/DELETE /clients/{id}`                        |
| Client detail | `GET /clients/{id}` includes `lines_of_business` + `held_products`           |
| Portfolio     | `GET/POST /clients/{id}/lines-of-business`, `DELETE …/{link_id}`             |
|               | `GET/POST /clients/{id}/held-products`, `PATCH/DELETE …/{held_id}`           |
| LOB catalog   | `GET/POST/PATCH/DELETE /lines-of-business`                                   |
| Products      | `GET/POST/PATCH/DELETE /products` (delete = soft `active=false`)             |
| Opportunities | `GET/POST /clients`…, `GET/PATCH/DELETE /opportunities/{id}`, `POST …/stage` |


All queries are scoped to `**current_user.organization_id`**.

## Web

- **App shell** — Nav: Início, Clientes, Oportunidades; logout.
- **Clientes** — List, create, detail with LOB + held-product sections (`internal_crm` on create).
- **Oportunidades** — List, create (owner = current user), detail with stage buttons calling `POST …/stage`.

Copy uses `**common`** namespace (`pt`).

## Tests

- `tests/test_crm.py` (requires `DATABASE_URL`): register → client → LOB link → held product → opportunity → stage to `CLOSED_WON` / `WON`.

## References

- `[IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md)` Phase 2
- `[IMPLEMENTATION-SPEC.md](./IMPLEMENTATION-SPEC.md)` §3.2 portfolio
- `[STRATEGIC-PRODUCT-ALIGNMENT.md](./STRATEGIC-PRODUCT-ALIGNMENT.md)` — broader product brief vs repo gaps
- `[OPPORTUNITY.md](./OPPORTUNITY.md)`
- `[DEVELOPMENT.md](./DEVELOPMENT.md)`

