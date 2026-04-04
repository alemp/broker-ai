# Implementation plan (MVP)

**Status:** **Phase 0** (skeleton) is implemented in-repo; later phases remain planning until executed. See [`PHASE-0-STACK.md`](./PHASE-0-STACK.md) and [`DEVELOPMENT.md`](./DEVELOPMENT.md).  
**Authority:** Decisions and constraints live in [`IMPLEMENTATION-SPEC.md`](./IMPLEMENTATION-SPEC.md). Long-range progression (MVP → final product, CRM ingress) is in [`IMPLEMENTATION-ROADMAP.md`](./IMPLEMENTATION-ROADMAP.md). This file turns them into phased work, dependencies, and acceptance checks.

---

## 1. Purpose

- Sequence work so **auth → CRM → import → catalog/rules → documents → extraction → batch insights → compliance** can ship incrementally.
- Make dependencies explicit so parallel work (e.g. UI stubs vs API contracts) does not block integration.
- Define **milestones** the design-partner brokerage can validate.

---

## 2. In scope (MVP)

- Single **organization**; `organization_id` on tenant data.
- **Email/password** authentication; users belong to the org.
- **Client** and **Opportunity** CRUD, pipeline stages per `OPPORTUNITY.md`.
- **Lines of business** (`LineOfBusiness`, `ClientLineOfBusiness`) and **held products** (`ClientHeldProduct`) on the client, with **`ingestion_source`**, maintained in-app and via bulk import.
- **CSV and Excel (`.xlsx`) import** for **clients**, including optional LOB / held-product columns per template; upsert order: `external_id` → normalized `email` → insert-only or strict error.
- **Product** catalog and **rule-based** recommendations with explainability (which rule matched); rules consume **portfolio** data (LOB + held products) per spec §3.2.
- **PDF** upload: 100 MB max, PDF only, validation (extension, MIME, magic bytes), **100 uploads/user/day** default.
- **Production storage:** S3; **development:** local / S3-compatible, **not** in git (see `.gitignore`).
- **Hybrid extraction:** auto + manual review; confidence and source (`automatic` / `manual`).
- **Batch / near–real-time** jobs for processing pipeline and dashboard-style scoring.
- UI: **React** + **shadcn**; **Portuguese** copy via **i18n-ready** keys.
- **LGPD-oriented** design: audit-sensitive actions, retention story, subprocessors list (iterate to full operational compliance).

---

## 3. Out of scope (MVP)

- External CRM **API** sync.
- **CSV import for opportunities** (Phase 2).
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

| Work item | Notes |
|-----------|--------|
| `Organization`, `User`, membership | Seed or bootstrap first org + admin. |
| Registration / login | Email + password; password hashing (e.g. Argon2/bcrypt). |
| Session or JWT | Document choice; refresh/expiry policy. |
| Middleware | Every mutating route resolves `organization_id` from membership. |

**Exit criteria:** User can sign up (or admin-created), log in, and call an authenticated endpoint that enforces org scope.

**Depends on:** Phase 0.

---

### Phase 2 — Client, opportunity, and client portfolio

**Goal:** Core CRM and pipeline per `OPPORTUNITY.md`, plus **lines of business** and **held products** as first-class data (`IMPLEMENTATION-SPEC.md` §3.2).

| Work item | Notes |
|-----------|--------|
| Schema | `Client`, `Opportunity` with `organization_id`; enums for stage/status. |
| Portfolio schema | `LineOfBusiness` (org catalog), `ClientLineOfBusiness`, `ClientHeldProduct` (FK to `Product` when matched; insurer, status, dates); **`ingestion_source`** on held rows (and LOB links if needed). |
| API | CRUD + list/filter + stage transitions; portfolio endpoints nested or sub-resources on `Client`. |
| Web | Client list/detail **including** LOB and held-product sections; opportunity board or list + detail; stage updates; localized strings via i18n keys. |

**Exit criteria:** Broker user manages clients, opportunities, and **in-app** portfolio data end-to-end; API persists `ingestion_source = internal_crm` (or equivalent) for manual rows.

**Depends on:** Phase 1.

---

### Phase 3 — CSV and Excel client import (including portfolio)

**Goal:** Bulk bootstrap and updates without external CRM; **same canonical tables** as the UI.

| Work item | Notes |
|-----------|--------|
| Template + docs | Required/optional columns for core client fields; **optional** LOB codes and held-product columns (or child-row convention); document for `external_id`, `email`. |
| Parsers | **CSV** + **Excel `.xlsx`** (shared validation pipeline; values-only for cells). |
| Parse + validate | Row-level errors; preview API. |
| Commit + audit | Transactional apply; log actor, timestamp, file hash; idempotent upsert rules from spec; set `ingestion_source` to `csv_import` / `excel_import`. |
| Web | Upload → preview → confirm; accept `.csv` and `.xlsx`. |

**Exit criteria:** Import 100+ rows with mixed inserts/updates **including** at least one scenario with LOB and held-product data populated; audit record exists; invalid rows reported without silent corruption.

**Depends on:** Phase 2.

---

### Phase 4 — Product catalog and rule engine

**Goal:** Explainable recommendations from client attributes **and** portfolio (LOB + held products).

| Work item | Notes |
|-----------|--------|
| `Product` model | As in `RECCOMENDATION.md`; admin or seed data for MVP. |
| Rules | Safe evaluation (no string `eval`); priority ordering; conditions may reference **LOB membership** and **held** `Product` / status; store “matched rule ids” on output. |
| API | `GET` recommendations for client (and optionally opportunity). |
| Web | Surface recommendations on client/opportunity views. |

**Exit criteria:** Changing a rule changes output predictably; UI shows why a product was suggested; **at least one** demo rule uses portfolio data (e.g. cross-sell gap).

**Depends on:** Phase 2 (portfolio model); Phase 3 optional for bulk-loaded clients.

---

### Phase 5 — PDF upload pipeline

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

### Phase 6 — Hybrid extraction

**Goal:** Structured fields + confidence + manual override.

| Work item | Notes |
|-----------|--------|
| Extraction v0 | Start with text-layer PDF parsing if possible; define field schema JSON. |
| Confidence + threshold | Below threshold → `needs_review`. |
| Manual override API + UI | Edit fields; set source to `manual` for overridden keys. |
| Linking | Attach document to `Client` / `Opportunity` (UX flow). |
| Portfolio | On confirmation, may upsert **`ClientHeldProduct`** / LOB hints with `ingestion_source = document_extraction` (same tables as CRM/import). |

**Exit criteria:** Happy path auto-fills; failure path allows save after user edit; confirmed extraction can feed **portfolio** rows for recommendations.

**Depends on:** Phase 5; Phase 2 for linking.

---

### Phase 7 — Batch scoring and dashboard

**Goal:** “High potential” and similar flags without real-time streaming.

| Work item | Notes |
|-----------|--------|
| Job scheduler | Cron or queue worker on interval. |
| Scoring rules | Versionable; log inputs snapshot or hash for debugging. |
| API | Expose scores/flags on list endpoints or dedicated resource. |
| Web | Dashboard widgets / filters on opportunities or clients. |

**Exit criteria:** Scores refresh on schedule; UI reflects last job run time.

**Depends on:** Phase 2; Phase 4 optional for richer signals.

---

### Phase 8 — LGPD hardening and release readiness

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

### Phase 9 — Post-MVP (tracked, not MVP commitment)

- File import (**CSV / Excel**) for **opportunities** (if still desired).
- Optional **virus scan** step before `processed`.
- **External CRM integrations** (map vendor data → canonical `Client` + portfolio tables); see `IMPLEMENTATION-ROADMAP.md` Stage 2+.
- Stronger extraction (OCR/LLM) and learning from corrections; extraction may set `ingestion_source = document_extraction` on portfolio rows after confirmation.

---

## 5. Dependency graph (summary)

```text
Phase 0 → Phase 1 → Phase 2 (incl. portfolio) → Phase 3 (CSV + XLS)
                                            → Phase 4
              Phase 0 → Phase 5 → Phase 6
Phase 2 + Phase 4/5 → Phase 7
All relevant → Phase 8
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

- Design-partner user can: manage pipeline; **maintain client LOB and held products in-app**; **import clients via CSV/Excel including portfolio columns**; get **portfolio-aware** recommendations; upload policies; complete extraction review; see refreshed scores.
- No committed blobs; prod uses S3; dev uses local storage.
- Documentation: operator can deploy staging + prod from runbook (to be written in Phase 8). Implementation docs and code remain **English** per `IMPLEMENTATION-ROADMAP.md`.

---

## 8. Document map

| Document | Role |
|----------|------|
| [`IMPLEMENTATION-SPEC.md`](./IMPLEMENTATION-SPEC.md) | Locked decisions |
| [`IMPLEMENTATION-ROADMAP.md`](./IMPLEMENTATION-ROADMAP.md) | MVP → final product; CRM ingress |
| **`IMPLEMENTATION-PLAN.md`** | **This file — phased plan (execution not started)** |
| [`OPPORTUNITY.md`](./OPPORTUNITY.md) | Opportunity domain attributes |
| [`PDF-UPLOAD.md`](./PDF-UPLOAD.md), [`EXTRACTION.md`](./EXTRACTION.md) | Document flows |

---

## 9. Next step when implementation starts

1. Confirm monorepo vs polyrepo and exact folder names.  
2. Execute **Phase 0** only; gate review before Phase 1.  
3. Track progress as tickets mapped to phases above.
