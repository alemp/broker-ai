# Phase 2 — Client, opportunity, and client portfolio

**Status:** Implemented in-repo (API + web + Alembic `phase2_003`). Depends on Phase 1 (JWT, org scope).

## Data model

- `**Product`** — Org-scoped catalog (`name`, `category`, `risk_level`, `active`, …). Seeded rows for the `default` org in the migration (MVP placeholders).
- `**LineOfBusiness**` — Org-scoped LOB catalog (`code`, `name`). Initial seed: `MOTOR`, `LIFE`, `HEALTH` for `default`. Migration **`mvp_catalog_007`** narrows MVP to **Auto** (`MOTOR`), **Ramos elementares** (`GENERAL`), **Vida (Life)** (`LIFE`), removes unused `HEALTH` when safe, and seeds three matching **Product** rows (`target_tags = mvp_catalog_v1`).
- `**Client**` — `organization_id`, optional `external_id` / `email` (partial unique indexes per org), `full_name`, contact fields, notes.
- `**ClientLineOfBusiness**` — Client ↔ LOB with `**ingestion_source**` (e.g. `internal_crm`).
- `**ClientHeldProduct**` — Optional FK to `**Product**`, insurer, policy dates/status, `**ingestion_source**`.
- `**Opportunity**` — `client_id`, `owner_id` (user), optional `product_id`, value, probability, `**OpportunityStage**` / `**OpportunityStatus**`, source, `next_action` / `next_action_due_at`, `preferred_insurer_name`, `expected_close_at`, `loss_reason`, timestamps.

Enums: stages `LEAD` … `CLOSED_LOST` plus `POST_SALE` (pós-venda após ganho). `POST /v1/opportunities/{id}/stage` aligns **status** with terminal stages (`CLOSED_WON` / `POST_SALE` → `WON`, `CLOSED_LOST` → `LOST`).

**PRODUCT.md §5.4 (MVP nesta fase):** validação de próxima ação em `QUALIFIED`, `PROPOSAL_SENT`, `NEGOTIATION` com estado `OPEN`; `POST_SALE` só após `CLOSED_WON`+`WON`; fecho perdido exige `loss_reason`; `GET /v1/opportunities/metrics/summary` para contagens por estágio e por corretor (abertas); filtros `stage`, `status`, `owner_id` na listagem. Migração **`opp_product54_011`** adiciona colunas de negócio. Dashboards por produto / seguradora / região e ligação automática a apólices ficam para fases posteriores.

## API (`/v1`, Bearer JWT)


| Area          | Endpoints                                                                    |
| ------------- | ---------------------------------------------------------------------------- |
| Clients       | `GET/POST /clients`, `GET/PATCH/DELETE /clients/{id}`                        |
| Client detail | `GET /clients/{id}` includes `lines_of_business` + `held_products`           |
| Portfolio     | `GET/POST /clients/{id}/lines-of-business`, `DELETE …/{link_id}`             |
|               | `GET/POST /clients/{id}/held-products`, `PATCH/DELETE …/{held_id}`           |
| LOB catalog   | `GET/POST/PATCH/DELETE /lines-of-business`                                   |
| Products      | `GET/POST/PATCH/DELETE /products` (delete = soft `active=false`)             |
| Opportunities | `GET/POST /opportunities`, `GET /opportunities/metrics/summary`, `GET/PATCH/DELETE /opportunities/{id}`, `POST …/stage` |


All queries are scoped to `**current_user.organization_id`**.

## Web

- **App shell** — Nav: Início, Clientes, Oportunidades; logout.
- **Clientes** — List, create, detail with LOB + held-product sections (`internal_crm` on create).
- **Oportunidades** — Filtros (estágio, estado, minhas), resumo de métricas, vista lista ou kanban; detalhe com dados do negócio (seguradora, fecho previsto, próxima ação), motivo de perda ao fechar perdido, estágio `POST_SALE` após ganho.

Copy uses `**common`** namespace (`pt`).

## Tests

- `tests/test_crm.py` (requires `DATABASE_URL`): register → client → LOB link → held product → opportunity → stage to `CLOSED_WON` / `WON`; `test_opportunity_product_54_rules_and_metrics` cobre §5.4 (próxima ação, perda, pós-venda, métricas).

## References

- `[IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md)` Phase 2
- `[IMPLEMENTATION-SPEC.md](./IMPLEMENTATION-SPEC.md)` §3.2 portfolio
- `[STRATEGIC-PRODUCT-ALIGNMENT.md](./STRATEGIC-PRODUCT-ALIGNMENT.md)` — broader product brief vs repo gaps
- `[OPPORTUNITY.md](./OPPORTUNITY.md)`
- `[DEVELOPMENT.md](./DEVELOPMENT.md)`

