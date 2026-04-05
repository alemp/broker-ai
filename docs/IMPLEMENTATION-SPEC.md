# Implementation specification (MVP)

Canonical technical and product decisions for the intelligent sales copilot MVP.  
**Documentation language:** Implementation specs, roadmaps, plans, and **application code** use **English** (identifiers, APIs, comments). Localized UI strings use i18n keys. For **Portuguese** copy, use **Brazilian Portuguese (pt-BR)** only until more locales ship — see [`LANGUAGE.md`](./LANGUAGE.md).

**Source prompts:** `AGENT.md`, `DESIGN-PARTNER.md`, `MVP-CRM-STRATEGY.md`, `OPPORTUNITY.md`, `RECCOMENDATION.md`, `PDF-UPLOAD.md`, `EXTRACTION.md`.  
**Extended roadmap:** [`IMPLEMENTATION-ROADMAP.md`](./IMPLEMENTATION-ROADMAP.md) (MVP → final product, CRM portfolio ingress).

---

## 1. Product context

- **Vision:** Data-driven, AI-assisted sales copilot for brokers/agents (`AGENT.md`).
- **First customer:** One external **design-partner brokerage** (real validation, controlled scope).
- **Core domain entity:** **Opportunity** (pipeline, scoring, recommendations attach to client + deal context).

---

## 2. Go-to-market and tenancy

| Decision | Value |
|----------|--------|
| Design partner model | **Single brokerage** (not internal-only, not multi-client SaaS on day one) |
| Tenancy | Single org in production for MVP; model **`organization_id`** on tenant-scoped rows from the start to ease a second customer later without a rewrite |
| Isolation | All CRM, documents, and opportunities belong to that organization; users are members of the org |

---

## 3. CRM strategy (combined A + C) and client portfolio ingress

### 3.1 Core CRM

| Decision | Value |
|----------|--------|
| **A — Internal minimal CRM** | Source of truth for **Client**, **Opportunity**, pipeline, owners |
| **C — File import** | Bootstrap and bulk update **clients** in MVP via **CSV and Excel (`.xlsx`)** ([`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md) Phase 5); **opportunities via file import** → Phase 11 (post-MVP) |
| Import UX | Upload → validate → preview → dry-run errors → commit; **audit** (who, when, file hash) |
| **Upsert (resolved)** | **(1)** `external_id` when present and non-empty → upsert; **(2)** else normalized **email** → upsert; **(3)** else insert-only or strict validation error (configurable). |

**Out of MVP:** External CRM **API** sync (connectors are **Stage 2+** per `IMPLEMENTATION-ROADMAP.md`).

### 3.2 Lines of business and held products (required data)

Information about **lines of business (LOB)** and **products the client already holds** must be representable and ingestible from **every** channel that supplies CRM data:

| Ingress | MVP | Notes |
|---------|-----|--------|
| **Own CRM** (in-app) | Yes | Users edit `ClientLineOfBusiness` and `ClientHeldProduct` (or equivalent) on the client profile |
| **CSV / Excel import** | Yes | Template includes optional columns (or related rows) for LOB codes and held products; same canonical tables as the UI |
| **External CRM integrations** | Post-MVP | Connectors map vendor objects → same canonical model; see roadmap Stage 2 |

**Provenance:** Persist **`ingestion_source`** on held-product rows (and LOB links where useful): `internal_crm`, `csv_import`, `excel_import`, `external_crm`, `document_extraction`.

**Recommendations** and **batch scoring** must read this portfolio (e.g. cross-sell gaps: active motor, no life).

### 3.3 Canonical entities (names indicative)

- `LineOfBusiness` — org-scoped LOB catalog  
- `ClientLineOfBusiness` — client ↔ LOB  
- `ClientHeldProduct` — placement row: link to `Product` when matched, insurer, status, dates; `ingestion_source`  
- `Product` — sellable catalog (`RECCOMENDATION.md`)

**PDF hybrid extraction** may propose updates to held products/LOB after user confirmation — same tables, `ingestion_source = document_extraction`.

---

## 4. Stack and infrastructure

| Layer | Choice |
|-------|--------|
| Backend | **Python** (e.g. FastAPI), **API-first** |
| Frontend | **React** + **shadcn/ui** |
| Repo layout (Phase 0+) | **pnpm** monorepo: `apps/api` (FastAPI, uv), `apps/web` (Vite); see [`PHASE-0-STACK.md`](./PHASE-0-STACK.md) and [`DEVELOPMENT.md`](./DEVELOPMENT.md) |
| Database | **PostgreSQL** (e.g. Amazon RDS or Aurora) |
| Object storage (production) | **Amazon S3** (PDFs; SSE-S3 or SSE-KMS optional) |
| Object storage (development) | **Local only** — S3-compatible endpoint (e.g. MinIO) and/or filesystem-backed adapter; **no buckets or blob data in the git repository** (see `.gitignore` at repo root) |
| Async / batch | Workers + scheduled jobs for PDF processing, extraction, dashboard/scoring refresh (**batch / near–real-time**; no streaming requirement for MVP) |
| Messaging | **No Kafka** in MVP; optional lightweight queue (e.g. SQS + worker) when needed |
| Auth | **Email + password** |
| Cloud | **AWS** |
| Observability | CloudWatch; add Datadog/Prometheus later if required |

**Development storage (policy):**

- Use configuration (e.g. `STORAGE_BACKEND`, `AWS_ENDPOINT_URL`, or equivalent) so the same code paths target **local** storage in dev and **S3** in staging/production.
- Keep MinIO data dirs, `.local-storage/`, or similar under **gitignored paths** only; never commit PDFs or storage state.

**Code and schema:** English identifiers only (`OPPORTUNITY.md`, `AGENT.md`).

---

## 5. Internationalization and compliance

| Topic | Decision |
|-------|----------|
| UI locale (MVP) | **Portuguese only** |
| i18n | **i18n-ready** from day one (message keys, no hardcoded user-facing strings in core logic) |
| Data residency | **Not required** for this phase; revisit when scaling or entering regulated hosting constraints |
| LGPD | **By design:** minimization, retention policies, access control, audit for sensitive actions, subprocessors documented (AWS + any OCR/LLM vendors) |

---

## 6. PDF upload (`PDF-UPLOAD.md`)

| Item | Decision |
|------|----------|
| Max file size | **100 MB** |
| Allowed types | **PDF only** |
| Validation | Extension, `Content-Type`, and **magic bytes** (`%PDF`) |
| Storage (prod) | **S3**; key naming: `organization_id`, `document_id`, version if needed; metadata in DB |
| Storage (dev) | **Local / S3-compatible**, not tracked in git (see §4) |
| Upload pattern | **Presigned PUT** to S3 (or dev equivalent); **multipart** for large files near 100 MB |
| Status lifecycle | e.g. `uploading` → `processing` → `processed` / `failed` |
| Virus/malware | **Out of MVP** — no scanning gate before `processed`; **revisit before broader production** or Phase 2 (optional hook in pipeline for later) |
| Rate limits | **100 uploads per user per calendar day** (configurable); typical pattern for authenticated B2B apps; tune with metrics |

---

## 7. Extraction (`EXTRACTION.md`)

| Decision | Value |
|----------|--------|
| Mode | **Hybrid (Option B):** automatic extraction first; **manual confirm/edit** when confidence is low or parsing fails |
| Model | Structured extracted fields + **confidence** + **source** (`automatic` vs `manual`) |
| UX | Review screen when extraction fails or below threshold; user corrections override auto output for affected fields |
| Evolution | Later: stronger OCR/LLM, higher automation, learning from corrections |

---

## 8. Opportunity domain (`OPPORTUNITY.md`)

- All attributes and enums as specified in `OPPORTUNITY.md` (stages: `LEAD` … `CLOSED_LOST`, status open/won/lost, `next_action`, etc.).
- Add **`organization_id`** on Opportunity, Client, and related aggregates for future multi-org.
- Relationships: Client, User (owner), optional Product link(s).

---

## 9. Recommendations (`RECCOMENDATION.md`)

- **MVP:** Rule-based engine over **Product** catalog (categories, risk, tags).
- Rules: priority, conditions on **client attributes**, **lines of business**, **held products** (and extracted document fields when available), explainability (**which rule fired**).
- **No complex ML** in MVP; scoring refresh via **batch jobs** aligned with dashboard.

---

## 10. Implementation order (suggested)

1. Baseline: PostgreSQL, **local object storage** for dev (gitignored), secrets, logging; wire S3 for deployed envs.
2. Auth (email/password), `Organization`, `User` membership.
3. **Client** + **Opportunity** CRUD and pipeline UI (React + shadcn).
4. **LOB catalog**, **ClientLineOfBusiness**, **ClientHeldProduct** + in-app CRUD; **`ingestion_source`**.
5. **CSV and Excel** import for **clients** including optional LOB / held-product columns (upsert rules in §3).
6. **Product** catalog + rule engine + UI surfacing recommendations (inputs include portfolio per §3.2).
7. PDF upload (presigned or dev-local equivalent) + metadata + worker pipeline.
8. Hybrid extraction + review UI + link to Client/Opportunity.
9. Batch scoring / “high potential” flags and dashboard widgets.
10. LGPD hardening (retention jobs, export/delete paths as required).
11. **Later:** file import for opportunities (if desired); virus scanning hook; external CRM connectors (`IMPLEMENTATION-ROADMAP.md`).

---

## 11. Risks (condensed)

- CSV re-import overwriting CRM data → mitigated by **upsert order** (`external_id` → email) + audit trail.
- 100 MB PDFs → **multipart**, async-only processing, no full-file buffering in API workers.
- shadcn + i18n → centralize copy via i18n keys, avoid scattered literal strings.
- Hybrid extraction ignored by users → gate critical actions on **confirmed** fields when needed.
- **No virus scan in MVP** → acceptable for controlled design-partner rollout; reassess before wider exposure.

---

## 12. Resolved items (formerly open)

| Topic | Resolution |
|-------|------------|
| CSV upsert key | **`external_id` first, else normalized `email`**; otherwise insert-only or strict validation error |
| Opportunities in CSV | **Phase 11** (post-MVP; see [`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md)) |
| Virus scanning | **Not in MVP** |
| Uploads per user per day | **100** (default cap, configurable) |

---

## 13. Document map

| Document | Role |
|----------|------|
| `AGENT.md` | Strategic phases and vision |
| `IMPLEMENTATION-SPEC.md` | **This file — locked MVP decisions** |
| `IMPLEMENTATION-PLAN.md` | Phased delivery plan (tasks, dependencies, exit criteria) |
| `IMPLEMENTATION-ROADMAP.md` | MVP → final product; CRM ingress and portfolio requirements |
| `PRODUCT.md` | Stakeholder product brief and MVP functional scope (Portuguese) |
| `STRATEGIC-PRODUCT-ALIGNMENT.md` | Stakeholder commercial-intelligence scope ↔ repo modules and engineering phases |
| `PHASE-0-STACK.md` | Locked Phase 0 tooling (Vite, uv, Compose, CI) |
| `DEVELOPMENT.md` | Local runbook (Postgres, API, web, Docker Compose) |
| `PHASE-1-AUTH.md` | Phase 1 JWT auth, default org, Compose runtime |
| `DESIGN-PARTNER.md` | Prompt + resolved: single brokerage |
| `MVP-CRM-STRATEGY.md` | Prompt + resolved: internal CRM + CSV |
| `OPPORTUNITY.md` | Domain spec for Opportunity |
| `RECCOMENDATION.md` | Product catalog + rules MVP |
| `PDF-UPLOAD.md` | Prompt + resolved upload constraints |
| `EXTRACTION.md` | Prompt + resolved hybrid extraction |
