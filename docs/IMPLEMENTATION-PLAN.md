# Implementation plan (MVP)

**Status:** **Phases 0–6** and **Phase 9** are implemented in-repo (Phase 5: [`PHASE-5.md`](./PHASE-5.md); Phase 6: [`PHASE-6.md`](./PHASE-6.md); Phase 9: [`PHASE-9.md`](./PHASE-9.md)), plus **PRODUCT §5.2 (pre–Phase 5)** — leads, client broker assignment (`owner_id`), individual vs company client, insured persons (`InsuredPerson`), append-only CRM audit trail, lead→client conversion (optional opportunity), `GET /v1/org/users`, and matching web flows. **Phase 7–8, 10+** remain as planned until executed. See [`PHASE-0-STACK.md`](./PHASE-0-STACK.md), [`PHASE-1-AUTH.md`](./PHASE-1-AUTH.md), [`PHASE-2-CRM.md`](./PHASE-2-CRM.md), [`PHASE-3-PROFILE.md`](./PHASE-3-PROFILE.md), [`PHASE-4-INTERACTIONS.md`](./PHASE-4-INTERACTIONS.md), and [`DEVELOPMENT.md`](./DEVELOPMENT.md).  
**Living checklist:** Stakeholder scope from [`PRODUCT.md`](./PRODUCT.md) vs repo status is maintained in [`STRATEGIC-PRODUCT-ALIGNMENT.md`](./STRATEGIC-PRODUCT-ALIGNMENT.md) — update that file when phases ship or scope shifts.  
**Authority:** Decisions and constraints live in [`IMPLEMENTATION-SPEC.md`](./IMPLEMENTATION-SPEC.md). Long-range progression (MVP → final product, CRM ingress) is in [`IMPLEMENTATION-ROADMAP.md`](./IMPLEMENTATION-ROADMAP.md). This file turns them into phased work, dependencies, and acceptance checks.

---

## 1. Purpose

- Sequence work so **auth → CRM → enriched profile → interactions → catalog/rules → documents → import → extraction → batch insights → compliance** can ship incrementally (milestone **document order**: Phases 6–7, then **Phase 5** before **Phase 8** — see §4).
- Make dependencies explicit so parallel work (e.g. UI stubs vs API contracts) does not block integration.
- Define **milestones** the design-partner brokerage can validate.

---

## 2. In scope (MVP)

- Single **organization**; `organization_id` on tenant data.
- **Email/password** authentication; users belong to the org.
- **Client** and **Opportunity** CRUD, pipeline stages per `OPPORTUNITY.md`.
- **Lines of business** (`LineOfBusiness`, `ClientLineOfBusiness`) and **held products** (`ClientHeldProduct`) on the client, with **`ingestion_source`**, maintained in-app and via bulk import.
- **MVP product lines** (catalog + LOB labels): **Auto**, **Ramos elementares** (general / multirisco), **Vida (Life)** — see Alembic `mvp_catalog_007` and `ProductCategory.GENERAL_INSURANCE`.
- **Enriched insurance-oriented client profile** per [`PRODUCT.md`](./PRODUCT.md) §5.3 — **Phase 3** (**partial**: API + schema A–H + score/alerts + **formulário web com todos os campos**; faltam obrigatoriedade mínima, coleta assistida, governança — ver [`PHASE-3-PROFILE.md`](./PHASE-3-PROFILE.md), [`CHECKLIST-PROFILE-5.3.md`](./CHECKLIST-PROFILE-5.3.md)).
- **Interactions** (types, timeline, link to client/opportunity, next-action and overdue signals) per [`PRODUCT.md`](./PRODUCT.md) §5.5 — **Phase 4**.
- **Product** catalog and **rule-based** recommendations with explainability (which rule matched); rules consume **portfolio** data and **profile** fields where modeled (LOB + held products per spec §3.2) — **Phase 6**.
- **PDF** upload: 100 MB max, PDF only, validation (extension, MIME, magic bytes), **100 uploads/user/day** default — **Phase 7**.
- **CSV and Excel (`.xlsx`) import** for **clients**, including optional LOB / held-product columns per template; upsert order: `external_id` → normalized `email` → insert-only or strict error — **Phase 5** (placed before Phase 8 in §4; still depends on Phase 2).
- **Hybrid extraction:** auto + manual review; confidence and source (`automatic` / `manual`) — **Phase 8**.
- **Batch / near–real-time** jobs for processing pipeline and dashboard-style scoring — **Phase 9**.
- UI: **React** + **shadcn**; **Portuguese** copy via **i18n-ready** keys.
- **LGPD-oriented** design: audit-sensitive actions, retention story, subprocessors list (iterate to full operational compliance) — **Phase 10**.

---

## 3. Out of scope (MVP)

- External CRM **API** sync.
- **CSV import for opportunities** (post-MVP; see Phase 11).
- **Virus/malware** scanning on upload (revisit before wider production).
- **Kafka**; complex ML training pipelines.
- **Multi-tenant** SaaS onboarding for many unrelated orgs (schema ready, product flow not).

---

## 4. Phases and milestones

### Phase 0 — Project skeleton and environments

**Goal:** Runnable apps, config split, no business features yet.

**Locked stack (do not change without updating docs):** [`PHASE-0-STACK.md`](./PHASE-0-STACK.md) — **Vite** + React + shadcn, **pnpm** monorepo, **uv** + FastAPI, **Docker Compose** Postgres, **GitHub Actions** CI.

| Work item | Notes |
|-----------|--------|
| Repository layout | **`apps/api`**, **`apps/web`**; pnpm workspace at repo root. |
| Python API shell | FastAPI, **`GET /health`**, OpenAPI at `/docs`, env-based config (`pydantic-settings`). |
| React app shell | **Vite**; **react-router-dom**; shadcn (Radix Nova); **i18n** (`react-i18next`, default **`pt`**, namespace **`common`**). |
| PostgreSQL | **Docker Compose** (`postgres:16-alpine`); **Alembic** migrations. |
| Object storage abstraction | **`ObjectStorage`** protocol; **`local`** + **`s3`**; switch via **`STORAGE_BACKEND`**; paths under `.gitignore`. |
| CI skeleton | **GitHub Actions**: `ruff` + `pytest` + `alembic upgrade head` (with service Postgres) + web **lint** + **build**. |
| Secrets | **`.env.example`** at repo root; never commit secrets. |

**Exit criteria:** API and web start locally; DB migrates; storage writes a test object locally without committing blobs.

**Depends on:** None.

---

### Phase 1 — Identity, organization, users

**Goal:** Secure access scoped to one brokerage org.

**Implemented:** [`PHASE-1-AUTH.md`](./PHASE-1-AUTH.md) — JWT (HS256) access token, Argon2 passwords, default org slug `default`, routes `/v1/auth/*` and `/v1/me`. **API + web + Postgres** run via **`docker compose up`** (see [`DEVELOPMENT.md`](./DEVELOPMENT.md)).

| Work item | Notes |
|-----------|--------|
| `Organization`, `User`, membership | Alembic `phase1_002`; default org seeded in migration; `users.organization_id` FK. |
| Registration / login | `POST /v1/auth/register`, `POST /v1/auth/login`; Argon2 via `argon2-cffi`. |
| Session or JWT | **JWT** bearer; `JWT_SECRET`, `JWT_EXPIRE_HOURS`; no refresh token (Phase 1). |
| Middleware / deps | `get_current_user` loads user + org; `org_id` claim must match row. |

**Exit criteria:** User can sign up (or admin-created), log in, and call an authenticated endpoint that enforces org scope.

**Depends on:** Phase 0.

---

### Phase 2 — Client, opportunity, and client portfolio

**Goal:** Core CRM and pipeline per `OPPORTUNITY.md`, plus **lines of business** and **held products** as first-class data (`IMPLEMENTATION-SPEC.md` §3.2).

**Implemented:** [`PHASE-2-CRM.md`](./PHASE-2-CRM.md) — Alembic `phase2_003`, `/v1` routes for clients, portfolio, LOB catalog, products, opportunities; web shell + client/opportunity flows; `tests/test_crm.py`.

| Work item | Notes |
|-----------|--------|
| Schema | `Client`, `Opportunity` with `organization_id`; enums for stage/status. |
| Portfolio schema | `LineOfBusiness` (org catalog), `ClientLineOfBusiness`, `ClientHeldProduct` (FK to `Product` when matched; insurer, status, dates); **`ingestion_source`** on held rows (and LOB links if needed). |
| API | CRUD + list/filter + stage transitions; portfolio endpoints nested or sub-resources on `Client`. |
| Web | Client list/detail **including** LOB and held-product sections; opportunity board or list + detail; stage updates; localized strings via i18n keys. |

**Exit criteria:** Broker user manages clients, opportunities, and **in-app** portfolio data end-to-end; API persists `ingestion_source = internal_crm` (or equivalent) for manual rows.

**Depends on:** Phase 1.

---

### Phase 3 — Enriched client profile ([`PRODUCT.md`](./PRODUCT.md) §5.3)

**Status:** **Partial** — backend schema (A–H), merge API, completeness score, consistency **alerts** (ampliados), and **full-field** web editing on client detail; still open: configurable required fields, assisted capture, broader “business-critical” gap rules, governance. Details: [`PHASE-3-PROFILE.md`](./PHASE-3-PROFILE.md), [`CHECKLIST-PROFILE-5.3.md`](./CHECKLIST-PROFILE-5.3.md).

**Implementation (current):** [`PHASE-3-PROFILE.md`](./PHASE-3-PROFILE.md).

**Goal:** Structured insurance-oriented attributes beyond core contact fields so recommendations, semáforo (Phase 9), and campaigns can use real propensity inputs — without forcing all fields on day one.

| Work item | Notes |
|-----------|--------|
| Domain model | Persist profile data aligned to brief blocks A–H (personal/family, professional/financial, property, mobility, health, business/guarantee, pet, behavior/preferences). Start with **JSON column or normalized tables** per engineering preference; version fields in OpenAPI. |
| Progressive UX | Client detail: sections/blocs; optional fields; **completeness score**; **alerts** for critical gaps (configurable rules). |
| API | `GET/PATCH` profile (or merge into client with clear schema); org-scoped; respect LGPD-oriented consent flags if introduced here or in Phase 10. |
| Import hook | Document optional **profile columns** for Phase 5 template (can ship after core profile CRUD). |
| Governance | Document base legal / consent / visibility in operator notes; full enforcement may extend Phase 10. |

**Exit criteria (target):** Broker fills **all** blocks via UI (or API + import) with progressive UX; completeness score and **expanded** critical-gap alerts; Phase 6 rules read profile keys in production paths; governance hooks documented or enforced per Phase 10.

**Currently met:** Profile persisted and patchable for all blocks via API **and** UI (all schema fields); completeness + alerts on client detail; PT labels for alert codes in-app (see [`PHASE-3-PROFILE.md`](./PHASE-3-PROFILE.md)).

**Depends on:** Phase 2.

**Checklist row:** [`STRATEGIC-PRODUCT-ALIGNMENT.md`](./STRATEGIC-PRODUCT-ALIGNMENT.md) §5.3.

---

### Phase 4 — Interactions, agenda, and history ([`PRODUCT.md`](./PRODUCT.md) §5.5)

**Status:** **Done** — see [`PHASE-4-INTERACTIONS.md`](./PHASE-4-INTERACTIONS.md).

**Goal:** Cadence and relationship memory — adoption driver for brokers (value, not only bureaucracy).

| Work item | Notes |
|-----------|--------|
| Model | `Interaction` (org, type enum: call, WhatsApp, email, meeting, visit, proposal sent, client reply, note, post-sale, campaign touch, …); body/summary; `occurred_at`; links to `client_id` and optional `opportunity_id`; `created_by` user. |
| API | CRUD + list by client/opportunity; filter by type/date; optional “due” or next-step linkage. |
| Opportunity sync | Updating `last_interaction_at` / `next_action` on opportunity when an interaction is logged (rule in API or domain service). |
| Web | Client and opportunity detail: **chronological timeline**; create interaction; **day panel** / “today’s actions” (minimal first version). |
| Alerts | MVP: list/filter overdue **next_action**; optional notifications later. |

**Exit criteria:** Broker logs interactions; timeline visible on client; opportunity `last_interaction_at` stays consistent with latest logged interaction when wired.

**Depends on:** Phase 2.

**Checklist row:** [`STRATEGIC-PRODUCT-ALIGNMENT.md`](./STRATEGIC-PRODUCT-ALIGNMENT.md) §5.5.

---

### PRODUCT §5.2 — Leads, client ownership, empresa/segurados, audit (before Phase 5)

**Goal:** Close [`PRODUCT.md`](./PRODUCT.md) §5.2 gaps that are **not** bulk import: **Lead** lifecycle, **corretor** on **Client**, **Empresa** vs pessoa física, **segurados** nested on the client, **histórico** of field-level changes, and **convert lead → client** (with optional **Opportunity**).

**Implemented:** Alembic `module52_006` (`leads`, `insured_persons`, `crm_audit_events`; client columns `owner_id`, `client_kind`, company fields). API: `/v1/org/users`, `/v1/leads` (+ `POST …/convert`), `/v1/clients/…` PATCH with audit, `/v1/clients/{id}/insured-persons`, `/v1/clients/{id}/audit-events`. Web: **Leads** list/detail + conversion; client create/detail: owner, tipo, empresa, segurados, histórico.

**Exit criteria:** Broker creates a lead, converts to client (optional oportunity), assigns **owner**, registers **COMPANY** + legal name, adds **insured persons**, and sees **audit** events on the client detail screen.

**Depends on:** Phase 2. **Does not include** CSV/Excel import (that is **Phase 5** — documented before Phase 8 in §4).

---

### Phase 6 — Product catalog and rule engine

**Status:** **Done** — see [`PHASE-6.md`](./PHASE-6.md).

**Pre–Phase 6 slice (shipped before this phase):** PRODUCT §5.6–§5.9 MVP backend + web parcial — `Insurer` master, produtos enriquecidos, `recommendation_runs` + feedback, semáforo + fila de revisão, campanhas/toques, consentimento de marketing no cliente. Ver [`PHASE-PRE6-MODULES-56-59.md`](./PHASE-PRE6-MODULES-56-59.md). **Post–Phase 6 backlog** (parametrização avançada, mais regras, UX adicional): ver subsecção **Post–Phase 6 backlog** logo abaixo.

**Goal:** Explainable recommendations from client attributes **and** portfolio (LOB + held products) **and profile fields** where available.

| Work item | Notes |
|-----------|--------|
| `Product` model | As in `RECCOMENDATION.md`; admin or seed data for MVP. |
| Rules | Safe evaluation (no string `eval`); priority ordering; conditions may reference **LOB membership**, **held** `Product` / status, and **Phase 3 profile** keys; store “matched rule ids” on output. |
| API | `GET` recommendations for client (and optionally opportunity); **`GET /v1/recommendation-rules`** built-in catalog. |
| Web | Recommendations + **rule trace** and structured fields on client (incl. live preview) and opportunity. |

**Exit criteria:** Changing a rule changes output predictably; UI shows why a product was suggested; **at least one** demo rule uses portfolio data (e.g. cross-sell gap); **at least one** demo rule uses a profile field **or** documented fallback when profile not yet populated.

**Depends on:** Phase 2 (portfolio model); **Phase 3** recommended before production cut of rules-rich MVP; Phase 5 optional for bulk-loaded clients.

---

### Post–Phase 6 backlog — DB-driven parametrization, rule catalog, and UX

**Status:** **Tracked** — not part of the closed Phase 6 milestone; ships as one or more follow-up increments after [`PHASE-6.md`](./PHASE-6.md) (code-defined rules in `recommendation_rules.py`, `GET /v1/recommendation-rules`, explainable UI).

**Goal:** Move from **deploy-only** rule tuning to **broker-operable** configuration where safe, grow the **catalog** of consultative rules with tests, and deepen **UX** for transparency and operations — without arbitrary code execution from the database.

#### 1) Advanced parametrization (DB-driven matrix)

| Theme | Direction |
|-------|-----------|
| **Separation of concerns** | Keep **rule logic** in versioned application code (typed conditions, no `eval` of strings). Store **parameters** the logic reads (thresholds, allowed `product_id` / LOB codes, copy templates, relative priorities) in **Postgres** — the “matrix”. |
| **Schema shape (illustrative)** | Rows keyed by `rule_id` (+ optional `organization_id` for future multi-tenant rule packs), JSON payload validated against a **JSON Schema** per rule family, plus metadata: `status` (draft / published), `effective_from` / `effective_to`, `updated_at`, actor for audit. |
| **Evaluation** | At runtime, evaluator loads builtin rule + **merges** DB params; missing or invalid params → safe fallback or skip with logged detail. **Reject** storing executable expressions or raw code in DB for this backlog slice. |
| **Migration** | Incrementally **extract literals** from `recommendation_rules.py` into seeded matrix rows + Alembic; feature-flag or env to compare old vs new output in staging. |
| **Governance** | Align with **Phase 10**: who may publish, immutable history or append-only audit for matrix changes, optional “preview run” before effective date. |

#### 2) More rules

| Theme | Direction |
|-------|-----------|
| **Catalog growth** | Add domain packs (e.g. SME guarantees, life riders, cross-line bundles) as new `rule_id`s with the same **explainability contract** (`rule_ids`, `rule_trace`, structured rationale fields). |
| **Quality bar** | Each rule: **unit tests** with frozen portfolio + profile fixtures; regression on `rule_trace` for fired / not-fired cases; update **`GET /v1/recommendation-rules`** metadata (`inputs`, description) when behavior or inputs change. |
| **Operations** | Optional later: analytics on **fire rate** / “never fired in N days” to retire or refactor stale rules. |

#### 3) Additional UX

| Theme | Direction |
|-------|-----------|
| **Matrix admin** | Role-gated UI (or internal tool) to edit **published parameters** within schema validation; clear **draft vs published** workflow. |
| **Preview** | “Run recommendations as if draft params were live” for a selected client or opportunity (read-only, no silent prod impact). |
| **Explainability** | Client / opportunity surfaces: filter trace to **fired rules only**; optional export-friendly summary for training or compliance conversations. |
| **Discoverability** | Link from Intel / recommendation panels to **rule catalog** (`/v1/recommendation-rules`) descriptions where it helps brokers trust the engine. |

**Dependencies:** Phase 6 (current engine and API); Phase 3 for richer inputs into new rules; Phase 5 for bulk-loaded clients in tests; Phase 10 for audit and access control on matrix edits.

**Exit criteria (when this backlog is delivered):** At least one production path reads **parameters from the DB**; brokers (or designated operators) can change a **documented knob** without an application deploy; new rules ship with tests + updated rule catalog metadata; UX includes **preview** and/or an explicit **publish** step for matrix changes.

**Explicit non-goals for this backlog:** End-user-authored arbitrary rule expressions from the DB; a full visual rule builder (revisit in a later roadmap item).

---

### Phase 7 — PDF upload pipeline

**Goal:** Durable uploads within limits; async processing hook.

| Work item | Notes |
|-----------|--------|
| DB | Document metadata, status, org, uploader, size, checksum. |
| Rate limit | 100/user/day (configurable). |
| Upload | Presigned PUT (S3) or local equivalent; multipart for large files. |
| Worker | Poll or queue: pick `processing` jobs; validate PDF; update status. |
| Web | Upload UI; list documents; download via authorized URL only. |

**Exit criteria:** 100 MB PDF succeeds with multipart; non-PDF rejected; daily cap enforced; no full file in API memory.

**Depends on:** Phase 1; Phase 0 storage abstraction.

---

### Phase 5 — CSV and Excel client import (including portfolio)

**Status:** **Done** — see [`PHASE-5.md`](./PHASE-5.md).

**Goal:** Bulk bootstrap and updates without external CRM; **same canonical tables** as the UI.

| Work item | Notes |
|-----------|--------|
| Template + docs | Required/optional columns for core client fields; **optional** LOB codes and held-product columns (or child-row convention); document for `external_id`, `email`; **optional profile columns** once Phase 3 schema is stable. |
| Parsers | **CSV** + **Excel `.xlsx`** (shared validation pipeline; values-only for cells). |
| Parse + validate | Row-level errors; preview API. |
| Commit + audit | Transactional apply; log actor, timestamp, file hash; idempotent upsert rules from spec; set `ingestion_source` to `csv_import` / `excel_import`. |
| Web | Upload → preview → confirm; accept `.csv` and `.xlsx`. |

**Exit criteria:** Import 100+ rows with mixed inserts/updates **including** at least one scenario with LOB and held-product data populated; audit record exists; invalid rows reported without silent corruption.

**Depends on:** Phase 2; **PRODUCT §5.2** extends client schema (owner, kind, company, segurados) — import template should align when Phase 5 ships. **Phase 3** optional for profile column mapping in template. **Independent of Phase 7** (may run in parallel with PDF pipeline / extraction work).

---

### Phase 8 — Hybrid extraction

**Goal:** Structured fields + confidence + manual override.

| Work item | Notes |
|-----------|--------|
| Extraction v0 | Start with text-layer PDF parsing if possible; define field schema JSON. |
| Confidence + threshold | Below threshold → `needs_review`. |
| Manual override API + UI | Edit fields; set source to `manual` for overridden keys. |
| Linking | Attach document to `Client` / `Opportunity` (UX flow). |
| Portfolio | On confirmation, may upsert **`ClientHeldProduct`** / LOB hints with `ingestion_source = document_extraction` (same tables as CRM/import). |

**Exit criteria:** Happy path auto-fills; failure path allows save after user edit; confirmed extraction can feed **portfolio** rows for recommendations.

**Depends on:** Phase 7; Phase 2 for linking.

---

### Phase 9 — Batch scoring and dashboard

**Status:** **Done** — see [`PHASE-9.md`](./PHASE-9.md).

**Goal:** “High potential” and similar flags without real-time streaming; **adequacy semáforo** (green/yellow/red) per [`PRODUCT.md`](./PRODUCT.md) §5.8 as explicit scored output + explanation where feasible.

| Work item | Notes |
|-----------|--------|
| Job scheduler | Optional APScheduler interval via `ADEQUACY_REFRESH_INTERVAL_MINUTES` (0 = off); manual `POST /v1/jobs/adequacy-refresh`. |
| Scoring rules | Reuses `evaluate_adequacy`; **rule_version** + **inputs_hash** on each snapshot row. |
| API | `client_adequacy_snapshots`, `batch_job_runs`; list filter `adequacy_traffic_light`; dashboard summary + last job. |
| Web | Início: counts + last job + trigger batch; client list semáforo + filter. |

**Exit criteria:** Scores refresh on schedule (when configured) or on demand; UI reflects last job run time; semáforo counts and per-client flags on list.

**Depends on:** Phase 2; Phase 6 optional for richer signals; **Phase 3** improves signal quality.

---

### Phase 10 — LGPD hardening and release readiness

**Goal:** Operational minimum for design-partner go-live.

| Work item | Notes |
|-----------|--------|
| Retention | Policies per entity; optional scheduled purge/archival (document legal sign-off). |
| Export / delete | Paths for data subject requests (scope with legal). |
| Audit | Sensitive reads/downloads logged. |
| Subprocessors | List in privacy notice (AWS, future OCR/LLM). |
| Runbooks | Backup, restore drill, incident contacts. |

**Exit criteria:** Checklist signed off with product/legal; staging matches prod topology.

**Depends on:** Prior phases as applicable.

---

### Phase 11 — Post-MVP (tracked, not MVP commitment)

- File import (**CSV / Excel**) for **opportunities** (if still desired).
- Optional **virus scan** step before `processed`.
- **External CRM integrations** (map vendor data → canonical `Client` + portfolio tables); see `IMPLEMENTATION-ROADMAP.md` Stage 2+.
- Stronger extraction (OCR/LLM) and learning from corrections; extraction may set `ingestion_source = document_extraction` on portfolio rows after confirmation.

---

## 5. Dependency graph (summary)

```text
Phase 0 → Phase 1 → Phase 2 (incl. portfolio) → Phase 3 (enriched profile)
                                            → Phase 4 (interactions)
                                            → Phase 6 (rules)
              Phase 0 → Phase 7 (PDF pipeline)
         Phase 2 → Phase 5 (CSV + XLS) — milestone doc order: before Phase 8
              Phase 7 → Phase 8 (extraction)
Phase 2 + Phase 6/7 → Phase 9 (scoring / semáforo / dashboards)
All relevant → Phase 10
```

---

## 6. Cross-cutting practices

| Area | Plan |
|------|------|
| API contracts | OpenAPI kept in sync; frontend generated or hand-typed clients. |
| Migrations | Forward-only in MVP; review breaking changes with FE. |
| Testing | Unit tests for rules, upsert, PDF validation; integration tests for auth + org scope; E2E for critical flows when stable. |
| Observability | Structured logs, correlation id, job success/failure metrics. |
| Security | OWASP ASVS light touch; rate limits on auth and upload; no secrets in repo. |

---

## 7. MVP definition of done (product)

- Design-partner user can: manage pipeline; **maintain client LOB and held products in-app**; **enrich client profile** (Phase 3) and **log interactions** (Phase 4); get **portfolio- and profile-aware** recommendations (Phase 6); upload policies (Phase 7); **import clients via CSV/Excel including portfolio columns** (Phase 5); complete extraction review (Phase 8); see refreshed scores / semáforo-style signals (Phase 9).
- No committed blobs; prod uses S3; dev uses local storage.
- Documentation: operator can deploy staging + prod from runbook (to be written in Phase 10). Implementation docs and code remain **English** per `IMPLEMENTATION-ROADMAP.md`.

---

## 8. Document map

| Document | Role |
|----------|------|
| [`IMPLEMENTATION-SPEC.md`](./IMPLEMENTATION-SPEC.md) | Locked decisions |
| [`IMPLEMENTATION-ROADMAP.md`](./IMPLEMENTATION-ROADMAP.md) | MVP → final product; CRM ingress |
| [`STRATEGIC-PRODUCT-ALIGNMENT.md`](./STRATEGIC-PRODUCT-ALIGNMENT.md) | **Living checklist:** stakeholder scope ([`PRODUCT.md`](./PRODUCT.md)) ↔ repo; update when phases complete |
| [`PRODUCT.md`](./PRODUCT.md) | Stakeholder product brief (Portuguese); §5.3 / §5.5 referenced by Phases 3–4 |
| [`CHECKLIST-PROFILE-5.3.md`](./CHECKLIST-PROFILE-5.3.md) | §5.3 profile: blocks, functional reqs, import — tracked vs repo |
| [`PHASE-5.md`](./PHASE-5.md) | CSV/Excel client import (Phase 5) |
| [`PHASE-6.md`](./PHASE-6.md) | Rule engine + explainable recommendations (Phase 6) |
| [`PHASE-9.md`](./PHASE-9.md) | Batch adequacy semáforo, job audit, dashboard summary (Phase 9) |
| **`IMPLEMENTATION-PLAN.md`** | **This file — phased plan**; **Post–Phase 6 backlog** (DB-driven rule matrix, more rules, UX) in §4 after Phase 6 |
| [`OPPORTUNITY.md`](./OPPORTUNITY.md) | Opportunity domain attributes |
| [`PDF-UPLOAD.md`](./PDF-UPLOAD.md), [`EXTRACTION.md`](./EXTRACTION.md) | Document flows |

---

## 9. Next step when implementation starts

1. Use [`STRATEGIC-PRODUCT-ALIGNMENT.md`](./STRATEGIC-PRODUCT-ALIGNMENT.md) to track **§5.x** rows against phase delivery.  
2. Execute **Phase 3** and **Phase 4** (or Phase 5 first if import is higher priority for the partner — note Phase 6 rules benefit from Phase 3).  
3. Track progress as tickets mapped to phases above.
