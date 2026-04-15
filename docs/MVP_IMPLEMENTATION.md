# MVP implementation (canonical, update-in-place)

This document is the **single technical source of truth for the MVP scope**, replacing phase/status files and prompt-style specs. It is designed to be **updated in-place** as the MVP evolves.

**Do not edit** product narrative documents:

- `AGENT.md` (strategic prompt and delivery phases)
- `PRODUCT.md` (stakeholder brief, pt-BR)
- `PRODUCT_ADDITIONAL_INFO.md` (extended product vision for policy/coverage adequacy)

---

## 0. Implementation status (current)

Legend:

- **Done**: implemented end-to-end (DB + API + UI where applicable)
- **Partially done**: implemented in part, or missing a key required sub-piece
- **Not started**: no implementation present yet

### Status summary


| Area                                                                          | Status             | Notes                                                                                                                                                                                             |
| ----------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tenancy (single partner, `organization_id` everywhere)                        | **Done**           | Tenant scoping is present across major tables (`organization_id`).                                                                                                                                |
| Users / Organization (membership, auth)                                       | **Partially done** | Auth is implemented (`/register`, `/login`, `/me`) and org users can be listed (`GET /org/users`), but there is **no user admin CRUD** (create/update/deactivate roles) in API/UI.                |
| Core CRM entities (Clients, Leads, Opportunities, Interactions)               | **Done**           | CRUD + UI pages exist for these entities.                                                                                                                                                         |
| Portfolio (held products + provenance)                                        | **Done**           | `ClientHeldProduct` with `ingestion_source` is implemented; import supports held products.                                                                                                        |
| Portfolio (LOB as first-class entity)                                         | **Not started**    | No `LineOfBusiness` / `ClientLineOfBusiness` tables or UI surfaced yet.                                                                                                                           |
| Enriched client profile (A–H blocks), completeness score + alerts             | **Done**           | Profile is stored as JSON (`profile_data`) and used by adequacy/rules.                                                                                                                            |
| Rule-based recommendations + explainability (rule trace)                      | **Done**           | Rules run, trace returned/stored; builtin rule catalog endpoint exists.                                                                                                                           |
| Adequacy semáforo (client-level) + batch snapshots + dashboard aggregates     | **Done**           | Batch job persists `ClientAdequacySnapshot`; dashboard exposes counts + last job.                                                                                                                 |
| Campaign segmentation + scheduled touches (internal)                          | **Partially done** | Campaign CRUD + segment refresh exist and create `CampaignTouch` rows, but there is **no UI** to list/manage touches or schedule them beyond “segment refresh now”. Provider sending is post-MVP. |
| Client import (CSV + Excel) with upload→validate→preview→commit + audit trail | **Done**           | `/clients/import/preview` + `/commit` + `ClientImportBatch` implemented; UI supports preview/commit.                                                                                              |
| Documents + extraction (PDF upload + structured extraction)                   | **Partially done** | Storage abstraction exists (`local` + `s3`), but no PDF upload/extraction pipeline yet.                                                                                                           |


### What is missing to finish (precise)

This checklist is split into:

- **Stage 1 — MVP “done”**: what must exist to claim the Stage 1 MVP scope is fully delivered
- **Full “policy adequacy” product**: what is required to reach the final vision described in `PRODUCT_ADDITIONAL_INFO.md` (Stages 2–4)

#### Stage 1 — MVP “done” checklist

- **Users / Organization**
  - Add **user admin CRUD** (at least: create user in org, update name/password, deactivate/reactivate, reset password)
  - Add **roles/permissions** (even minimal: admin vs broker) if required for the design-partner workflow
  - Add UI screens for user management (or explicitly define as out-of-scope for MVP)
  - Admin-only access: only **Administrator** can manage users (per `PRODUCT.md` minimal profiles)
  - Minimal roles to implement now (from `PRODUCT.md`): **Administrator**, **Sales manager**, **Broker** (Support/ops is optional next phase)
- **Portfolio: Lines of business (LOB)**
  - Add DB models + migrations for `LineOfBusiness` and `ClientLineOfBusiness` (tenant-scoped)
  - Add API endpoints to manage LOBs and client LOB links (create/list/update/delete)
  - Add UI in client detail to view/edit LOBs (and use them in segmentation + recommendations if they are required MVP inputs)
  - If Campaigns are used for the design partner, keep them as the **last** MVP workstream (lowest priority within MVP).

- **Campaigns (internal tooling — lowest MVP priority)**
  - Add UI to **view campaign audience/touches** (list touches, status, scheduled_at, channel)
  - Add UI controls to **reschedule/cancel/mark-sent** touches (or document a manual operational flow)
  - Add ability to run segmentation for “scheduled” times (even if sending is post-MVP, the scheduling + touch lifecycle should be usable)

#### Full “policy adequacy” product checklist (Stages 2–4)

- **Documents**
  - Implement PDF upload endpoints with constraints (PDF-only, size limit, magic-bytes validation)
  - Add storage-backed persistence (already abstracted as `local` + `s3`) and a document metadata model
  - Add document type classification (policy vs general conditions vs proposal vs endorsement)
- **Extraction + normalization**
  - Define structured extraction schemas for policy + general conditions
  - Implement hybrid extraction workflow (auto extract + manual confirmation/edit when low confidence)
  - Build coverage normalization taxonomy (carrier text → canonical coverage)
- **Adequacy (coverage-level)**
  - Implement per-coverage adequacy matrix and semáforo by coverage (not just client-level)
  - Add executive report generation (coverage gaps + next best offer narrative)
- **Connectors / platformization**
  - External CRM connectors (Stage 2)
  - Optional upload malware scanning hook (Stage 2)
  - Event-driven patterns + BI foundations (Stage 3)
  - Copilot / gen-AI grounded on CRM + portfolio + documents (Stage 4)

## 1. Product scope (MVP)

### Tenancy

- MVP ships for a **single design-partner brokerage**, but the DB schema must carry `organization_id` across tenant-scoped tables to avoid a rewrite later.

### Core entities (MVP)

- **User / Organization** (membership, auth)
- **Lead** (convertible)
- **Client** (person or company)
- **Insured person** (under client)
- **Opportunity** (pipeline deal)
- **Line of business (LOB)** and **Client-held products** (portfolio)
- **Insurers / Products** catalog (admin-maintained)

### Key product capabilities (MVP)

- CRM: clients, leads, opportunities, owners
- Portfolio-aware selling: LOB + held products on each client
- Enriched insurance profile (A–H blocks) with completeness score and alerts
- Interactions timeline + next action + overdue signals
- Rule-based recommendations with explainability (rule trace)
- Adequacy semáforo (GREEN/YELLOW/RED) at **client level**, with batch snapshots and dashboard aggregation
- Campaign segmentation and scheduled touches (MVP “internal” post-sale tooling)

---

## 2. Engineering decisions (MVP)

### Stack

- Backend: **Python** (FastAPI)
- Frontend: **React** (Vite) + shadcn/ui + Tailwind v4
- DB: **PostgreSQL**
- Storage: abstraction with `local` + `s3`

### Language policy

- Code + technical docs: **English**
- UI copy: **pt-BR** via i18n keys

---

## 3. Canonical data model (high level)

### Portfolio requirement (critical)

No matter how a client enters the platform, we converge into a canonical view of:

1. **Client lines of business (LOB)**
2. **Client held products** (current/past placements)

Ingestion must write into the **same tables** used by the UI (no “import-only” silos).

**Provenance** is required:

- `ingestion_source` must exist on held-product rows (and may exist on LOB links), including:
  - `internal_crm`
  - `csv_import`
  - `excel_import`
  - `external_crm` (post-MVP)
  - `document_extraction` (planned: post-PDF/extraction)

### Entities (indicative naming)

- `Client`
- `Opportunity`
- `LineOfBusiness`
- `ClientLineOfBusiness`
- `Product`
- `ClientHeldProduct`
- `Insurer`
- `Interaction`
- `Campaign`, `CampaignTouch`
- `ClientAdequacySnapshot` (batch-computed semáforo)
- `BatchJobRun` (job audit)

---

## 4. Import (MVP): CSV + Excel for clients

### UX requirements

Upload → validate → preview → dry-run errors → commit.

Persist an import audit trail (who, when, file hash/fingerprint).

### Upsert resolution (MVP)

1. `external_id` when present and non-empty → upsert
2. else normalized email → upsert
3. else insert-only or strict validation error (configurable)

Imports must be able to include optional LOB and held-product data.

---

## 5. Catalog + recommendation rules (MVP)

### Catalog

Admin-managed insurers and products (insurance lines include Auto, General/Property, Life as initial focus).

Products can carry enriched commercial fields (coverage summary, exclusions notes, recommended profile, arguments, support materials), stored as text and/or JSON.

### Recommendation engine (MVP)

Rule-based only (no ML training pipeline), consuming:

- Client profile (A–H)
- Portfolio (LOB + held products)
- Optional extracted fields later (post-document pipeline)

Explainability is mandatory:

- store or return which rules matched (`rule_ids`/trace)

---

## 6. Adequacy semáforo (MVP, current state)

### What it is today

- GREEN / YELLOW / RED at the **client** level
- Derived from profile completeness/alerts and protection gaps inferred from portfolio/rules
- Persisted via scheduled or manual **batch** runs as a snapshot per client

### Batch behavior (MVP)

Batch run stores:

- traffic light
- summary + reasons
- input fingerprint/hash (so unchanged inputs can be skipped)
- job audit (success/fail, timestamps)

The UI must support:

- Adequacy summary counts (dashboard)
- Filter clients by last stored traffic light
- Indicate whether view is from batch snapshot or live evaluation

---

## 7. Documents + extraction (planned for the “policy adequacy” goal)

The extended goal in `PRODUCT_ADDITIONAL_INFO.md` requires a 3-layer system:

1. What was contracted (policy)
2. How the product actually works (general conditions)
3. What the client needed (risk/profile)

To reach that goal, the MVP groundwork is:

- PDF upload constraints (100MB, PDF only, magic bytes validation)
- Storage abstraction (local in dev; S3 in prod)
- Hybrid extraction: automatic first, then manual confirmation/editing when confidence is low

**Not yet implemented in the current MVP scope** (must be added later):

- document type classification (policy vs general conditions vs proposal vs endorsement)
- policy + general-conditions structured extraction schemas
- coverage normalization taxonomy (carrier text → canonical coverage)
- per-coverage adequacy matrix and semáforo by coverage
- executive report generation (per coverage + next best offer narrative)

---

## 8. Campaigns (MVP — lowest priority within MVP)

Campaigns and touches exist to support simple post-sale cadence and segmentation.

Segmentation criteria include (MVP set):

- `marketing_opt_in`
- `min_profile_completeness`
- `missing_product_category`
- `max_adequacy_traffic_light`

Sending via email/WhatsApp providers is **post-MVP** (Stage 2+).

---

## 9. Roadmap (compressed)

### Stage 1 — MVP (design partner)

- CRM + portfolio + profile + interactions
- Catalog + rule recommendations
- Client-level semáforo + batch snapshots + dashboard
- Client import via CSV/Excel
- Campaign segmentation (internal — lowest priority within MVP)

### Stage 2 — Growth

- First external CRM connector(s)
- Stronger document pipeline (PDF + extraction hardening)
- Optional virus scan hook for uploads
- Early propensity scoring (optional)

### Stage 3 — Platform scale

- Multi-tenant product onboarding
- Event-driven patterns where needed
- Warehouse/BI foundations

### Stage 4 — Full intelligent product

- Copilot / gen-AI (grounded on portfolio + opportunities + documents)
- Experimentation (A/B tests)
- Learning loops from won/lost outcomes

