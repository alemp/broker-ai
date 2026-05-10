# MVP implementation (canonical, update-in-place)

This document is the **single technical source of truth for the MVP scope**, replacing phase/status files and prompt-style specs. It is designed to be **updated in-place** as the MVP evolves.

**Do not edit** product narrative documents:

- `AGENT.md` (strategic prompt and delivery phases)
- `PRODUCT.md` (stakeholder brief, pt-BR)
- `PRODUCT_ADDITIONAL_INFO.md` (extended product vision for policy/coverage adequacy)

### Related ADRs

- [`ADR-PROPOSAL-INGEST.md`](./ADR-PROPOSAL-INGEST.md) — Proposal ingest: `Opportunity` as proposal container, `insurance_line`, JSON and PDF channels, `documents.opportunity_id`, idempotency, party resolution.

### Related implementation plans

- [`PROPOSAL-INGEST-IMPLEMENTATION.md`](./PROPOSAL-INGEST-IMPLEMENTATION.md) — Phase-by-phase plan for the proposal-ingest feature (data model, PDF/JSON channels, web UI, tests, rollout).

Section **§10** below is the **canonical plan** for adapting the current auth/tenancy model to the **self-service product flow**: marketing entry → onboarding (login/register) → **create organization at signup** → optional **email invitations**.

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
| Users / Organization (membership, auth)                                       | **Partially done** | Auth (`/register`, `/login`, `/me`); org settings (`PATCH /org/admin`); **admin user CRUD** in API + UI (`/org/admin/users`, `/users`). **Missing for self-service SaaS flow:** landing + onboarding hub; **register creates a new org** (today signup joins `DEFAULT_ORGANIZATION_SLUG`); **email invitations** (today: temp password shown in UI only). |
| Self-service onboarding (landing → onboarding → new org at signup → invites) | **Not started**    | See **§10** for the implementation plan.                                                                                                                                                          |
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
  - **User admin CRUD** (create in org, update, deactivate/reactivate, reset password) — **done** in API + `/users` UI for ADMIN
  - **Roles/permissions** — minimal roles exist (**Administrator**, **Sales manager**, **Broker**); keep enforcing admin-only user management
  - **Self-service onboarding & tenancy (product flow)** — **not done**; tracked in **§10** (register-with-organization, invitations by email, landing/onboarding UX). Treat as a **parallel workstream** to Stage 1 CRM items if the go-to-market requires it before design-partner-only access
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

- **Multi-tenant product onboarding** (self-service org creation, invitations, optional multi-org-per-user) — detailed phased plan in **§10**
- Event-driven patterns where needed
- Warehouse/BI foundations

### Stage 4 — Full intelligent product

- Copilot / gen-AI (grounded on portfolio + opportunities + documents)
- Experimentation (A/B tests)
- Learning loops from won/lost outcomes

---

## 10. Self-service onboarding, tenancy & invitations (implementation plan)

This section adapts the **current** model (global self-register joins `DEFAULT_ORGANIZATION_SLUG`; one `organization_id` per user; admin-created users with optional **temporary password** returned in the API/UI) to the **desired flow**:

1. User visits the **main product marketing** surface.
2. User clicks **“Comece agora”** (or equivalent CTA).
3. User lands on an **onboarding** experience with **login** or **sign up**.
4. On sign up, the user provides **basics to create a new organization** (not the shared default tenant).
5. Optionally, the user **invites teammates by email**.
6. The platform remains **multi-organization** at the data level (`organization_id` on tenant tables); **multi-org per single user account** is optional later (§10.7).

### 10.1 Product and data-model decisions (before implementation)

**MVP tenant model (recommended first slice)**

- Each new self-service signup **creates** an `Organization` row and a **single** `User` row with `role = ADMIN` for that org.
- Keep **`users.email` globally unique** for MVP unless **§10.7** (membership table) is implemented; then define policy for “invite existing platform user into another org.”

**Marketing vs app**

- Prefer implementing the **landing + CTA** inside `apps/web` (public routes) unless marketing lives on another domain; then only the **target URL** of “Comece agora” changes.

**Invitations**

- Use **opaque token** (store **hash** only), **expiry**, and **accept** endpoint; avoid relying on “first login with this email” without a secret.

### 10.2 Phase 0 — Register with new organization (API + DB)

- Add a dedicated transaction, e.g. `POST /v1/auth/register-with-organization`, body including at least:
  - User: `email`, `password`, optional `full_name`
  - Organization: `name`, optional `currency`; `slug` either **client-supplied with validation** or **server-derived** from name (unique, normalized, reserved slugs rejected)
- On success: return the same **`TokenResponse`** shape as today so the web `AuthContext` stays aligned.
- **Deprecate or gate** the current `POST /v1/auth/register` that attaches to `DEFAULT_ORGANIZATION_SLUG` (keep for dev/seeds behind env or remove after migration story is clear).
- **Tests:** integration tests with `DATABASE_URL` (happy path, duplicate slug, duplicate email).

### 10.3 Phase 1 — Email invitations

- **Table** `organization_invitations` (name aligned with project conventions): `id`, `organization_id`, `email` (normalized), `role`, `token_hash`, `expires_at`, `invited_by_user_id`, `accepted_at`, `created_at`; unique constraint for **pending** invites per org+email as appropriate.
- **API (ADMIN)**  
  - `POST /v1/org/invitations` — create invite, enqueue email  
  - `GET /v1/org/invitations` — list pending (optional)  
  - `DELETE /v1/org/invitations/{id}` — revoke (optional)
- **API (public)**  
  - `GET /v1/invitations/validate?token=…` — safe metadata (org display name, invited email mask, expired flag)  
  - `POST /v1/invitations/accept` — `token`, `password` (and optional `full_name` for new users); creates `User` in the inviting org with the given role or returns a clear error if email already exists (per MVP policy).
- **Email delivery:** introduce a small `EmailBackend` (log-only in dev; provider in prod); template with link `https://<app>/invite?token=…`.
- **Security:** rate limits on validate/accept; never log raw tokens.

### 10.4 Phase 2 — Frontend (`apps/web`)

- **Public landing** route with **“Comece agora”** → `/onboarding` (or `/start`).
- **Onboarding hub** `/onboarding`: primary actions **Entrar** (`/login`) and **Criar conta** (`/register` or single-step wizard).
- **Register page:** collect organization fields + call `register-with-organization`.
- **Invite accept** `/invite`: read `token` from query; loading / invalid / expired / set-password / success; then session same as login.
- **Optional post-login prompt** “Convide sua equipe” linking to admin invite UI.
- **i18n:** pt-BR keys for all new copy.

### 10.5 Phase 3 — Admin UI alignment

- Extend **`/users`** (or adjacent screen): besides “create user with temp password”, add **“Send invitation”** using `POST /v1/org/invitations`; list pending invites; optional resend/revoke.
- Document operational difference: **invite** (email + self-serve accept) vs **direct create** (temp password in UI) — product may keep both during transition.

### 10.6 Phase 4 — Hardening

- Rate limiting on registration and invitation endpoints.
- Observability: invitation sent / accepted / expired (metrics or structured logs).
- Production email: verified domain, secrets, environment-specific base URL for links.

### 10.7 Phase 5 (optional) — Multiple organizations per user

- Add **`organization_members`** (or equivalent): `(user_id, organization_id, role, …)` and migration from current `users.organization_id`.
- **Switch org:** e.g. `POST /v1/me/switch-organization` issuing a new JWT with selected `organization_id`.
- **UI:** org switcher in shell; invitation accept flow updated if the same email can join a second org.

### 10.8 Implementation order (suggested)

| Order | Deliverable | Verification |
| ----- | ----------- | ------------ |
| 1 | API `register-with-organization` + tests | New signup does not depend on default org row |
| 2 | Landing + onboarding + extended register form | Manual E2E from CTA to dashboard |
| 3 | Invitations schema + API + dev email | Accept invite locally end-to-end |
| 4 | `/invite` page + UsersPage invitation actions | Admin invites; invitee sets password |
| 5 | Policy for duplicate email + docs | Product rules explicit for support |
| 6 | (Optional) §10.7 membership + org switcher | Same login, multiple orgs |

### 10.9 Risks and dependencies

- **Default org** (`DEFAULT_ORGANIZATION_SLUG`): plan for existing environments and any legacy users (rename, migrate, or keep for internal tenants only).
- **Transactional email** is a hard dependency for production quality of invitations.
- **CORS and absolute URLs** for invite links must match deployed web origin(s).

