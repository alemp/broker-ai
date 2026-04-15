# MVP implementation (canonical, update-in-place)

This document is the **single technical source of truth for the MVP scope**, replacing phase/status files and prompt-style specs. It is designed to be **updated in-place** as the MVP evolves.

**Do not edit** product narrative documents:

- `AGENT.md` (strategic prompt and delivery phases)
- `PRODUCT.md` (stakeholder brief, pt-BR)
- `PRODUCT_ADDITIONAL_INFO.md` (extended product vision for policy/coverage adequacy)

---

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

## 7. Campaigns (MVP)

Campaigns and touches exist to support simple post-sale cadence and segmentation.

Segmentation criteria include (MVP set):

- `marketing_opt_in`
- `min_profile_completeness`
- `missing_product_category`
- `max_adequacy_traffic_light`

Sending via email/WhatsApp providers is **post-MVP** (Stage 2+).

---

## 8. Documents + extraction (planned for the “policy adequacy” goal)

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

## 9. Roadmap (compressed)

### Stage 1 — MVP (design partner)

- CRM + portfolio + profile + interactions
- Catalog + rule recommendations
- Client-level semáforo + batch snapshots + dashboard
- Campaign segmentation (internal)
- Client import via CSV/Excel

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

