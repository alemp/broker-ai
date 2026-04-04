# Implementation roadmap: MVP → final product

**Language policy:** All **implementation documentation** and **application code** (identifiers, comments, API schemas, user-facing technical messages) are maintained in **English**. End-user UI copy may be localized via i18n (e.g. Portuguese for the first market) while keys and defaults remain English-friendly.

**Related documents:**

| Document | Purpose |
|----------|---------|
| [`IMPLEMENTATION-SPEC.md`](./IMPLEMENTATION-SPEC.md) | Locked MVP technical decisions |
| [`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md) | Phased engineering tasks and exit criteria |
| [`STRATEGIC-PRODUCT-ALIGNMENT.md`](./STRATEGIC-PRODUCT-ALIGNMENT.md) | Maps insurance brokerage strategic brief (modules, accelerator vs build) to repo status and phases |

This roadmap describes **product and technical progression** from the first shippable MVP through a **full commercial intelligence platform**, including how **client lines of business** and **held products** must flow from every CRM ingress path.

---

## 1. Strategic requirement: client portfolio from every source

Regardless of how data enters the platform, the system must converge on a **canonical view** of:

1. **Lines of business (LOB)** the client participates in — e.g. motor, life, health, pension (normalized codes aligned to the brokerage’s taxonomy).
2. **Products the client holds** — policies or financial products already placed: link to internal `Product` catalog where possible, plus insurer, status (active/lapsed/cancelled), effective/expiry dates, and optional premium or sum assured (as available).

**Ingress paths (full vision):**

| Source | MVP | Later stages |
|--------|-----|----------------|
| **Own CRM** (in-app create/edit) | Yes — users maintain LOB tags and held products on the Client record | Same; richer UX and validation |
| **CSV import** | Yes — columns map to client core fields **and** optional LOB / held-product columns (repeatable rows or delimited lists per agreed template) | Hardening, larger files, automation |
| **Excel import (.xlsx)** | Recommended same milestone as CSV (shared parser pipeline) | Same |
| **External CRM integrations** (HubSpot, Salesforce, vertical CRMs, etc.) | No | Yes — connectors map vendor objects → canonical `Client` + `ClientLineOfBusiness` + `ClientHeldProduct` |

**Principles:**

- **Single write model:** Importers and integrations **upsert** into the same tables the UI uses; no shadow “import-only” silo.
- **Provenance:** Each held-product row (and optionally LOB membership) carries **`ingestion_source`** (`internal_crm`, `csv_import`, `excel_import`, `external_crm`, `document_extraction`) and timestamps for audit and reconciliation.
- **Recommendations** and **scoring** consume this portfolio: rules such as “if client has active AUTO but no LIFE → suggest LIFE” require reliable LOB/product data.

---

## 2. Canonical domain sketch (English naming)

Names are indicative; finalize in schema migrations.

| Concept | Purpose |
|---------|---------|
| `Client` | Party; `organization_id`; demographics and contact fields used by rules |
| `LineOfBusiness` | Master list of LOB codes (org-specific catalog) |
| `ClientLineOfBusiness` | Many-to-many: client ↔ LOB, optional `source`, `effective_from` |
| `Product` | Sellable catalog item (`RECCOMENDATION.md`) |
| `ClientHeldProduct` | Client’s current/past placement: FK to `Product` when matched, else structured free text; insurer, status, dates; **`ingestion_source`** |
| `Opportunity` | Pipeline deal; optional links to target `Product`(s) (`OPPORTUNITY.md`) |

**Document extraction (PDF)** may propose or update `ClientHeldProduct` / LOB after user confirmation (hybrid flow) — same tables, source `document_extraction`.

---

## 3. Progression overview

```text
MVP (design partner)  →  Growth  →  Platform scale  →  Full intelligent product
        │                    │              │                      │
   Own CRM + CSV/XLS    External CRM    Multi-tenant      Gen-AI copilot,
   LOB + held products  connectors       events/APIs       real-time NBA,
   Rules + PDF          Warehouse        ML ops            experimentation
```

---

## 4. Stage 1 — MVP (design-partner brokerage)

**Objective:** Prove commercial value: pipeline, portfolio-aware recommendations, policy PDFs, hybrid extraction.

| Area | Deliverables | Status (track in tickets) |
|------|----------------|---------------------------|
| Foundation | Python API, React + shadcn, PostgreSQL, local/S3 storage, auth, org scope | **Done** (Phases 0–1; see [`PHASE-0-STACK.md`](./PHASE-0-STACK.md), [`PHASE-1-AUTH.md`](./PHASE-1-AUTH.md)) |
| CRM core | `Client`, `Opportunity`, pipeline UI | **Done** (Phase 2; see [`PHASE-2-CRM.md`](./PHASE-2-CRM.md)) |
| **Portfolio** | `LineOfBusiness`, `ClientLineOfBusiness`, `ClientHeldProduct`; CRUD in UI; **`ingestion_source`** | **Done** (Phase 2) |
| **Enriched profile** | Insurance-oriented client attributes (blocks), completeness, alerts ([`PRODUCT.md`](./PRODUCT.md) §5.3) | **Done** ([`PHASE-3-PROFILE.md`](./PHASE-3-PROFILE.md); [`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md) **Phase 3**) |
| **Interactions** | Timeline, types, agenda/day panel ([`PRODUCT.md`](./PRODUCT.md) §5.5) | Planned (**Phase 4**) |
| Bulk ingest | **CSV + Excel** import for clients **including** LOB / held-product columns per template; upsert: `external_id` → email | Planned (**Phase 5**) |
| Catalog & rules | `Product` + LOB **catalog CRUD**; **rule engine** uses client attributes **and** LOB / held products / profile | **Partial** — catalog in Phase 2; rules **Phase 6** |
| Documents | PDF upload (limits per spec); hybrid extraction; link to client/opportunity | Planned (**Phases 7–8**) |
| Intelligence | Batch scoring / “high potential”; dashboard refresh; adequacy semáforo (see [`STRATEGIC-PRODUCT-ALIGNMENT.md`](./STRATEGIC-PRODUCT-ALIGNMENT.md)) | Planned (**Phase 9**) |
| Compliance | LGPD-oriented audit, retention story, subprocessors list | Planned (**Phase 10**) |

**MVP exit:** Partner users maintain portfolio in-app or via import; recommendations reflect gaps/overlays in LOB/products; PDF flow does not bypass confirmed data rules.

---

## 5. Stage 2 — Growth (efficiency and integrations)

**Objective:** Reduce manual entry; deepen data quality.

| Area | Deliverables |
|------|----------------|
| Integrations | **First external CRM** connector (read + selective write-back if needed); field mapping UI; conflict policy |
| Import | Scheduled imports, validation reports, Excel templates versioning |
| Recommendations | Richer rules, Next Best Action prototypes, propensity scoring (simple ML optional) |
| Extraction | OCR / LLM-assisted parsing; higher automation rate |
| Operations | Virus scan option for PDFs; rate limits tuned to production traffic |

**Exit:** At least one production CRM feeding canonical LOB + held products without manual double entry for standard fields.

---

## 6. Stage 3 — Platform scale

**Objective:** Infrastructure for multiple orgs and high volume.

| Area | Deliverables |
|------|----------------|
| Multi-tenant | Self-service org onboarding; billing hooks (if SaaS) |
| Architecture | Event-driven patterns (e.g. SQS/Kafka) for sync and analytics |
| Data | Warehouse (e.g. BigQuery/Snowflake); curated models for BI |
| APIs | Public or partner APIs for opportunities and portfolio read models |
| CRM | **Multiple CRM connectors**; normalization layer for vendor-specific taxonomies → internal LOB |

**Exit:** Second customer on platform without fork; sync and reporting SLAs defined.

---

## 7. Stage 4 — Full intelligent product

**Objective:** Maximum differentiation (`AGENT.md` Phase 4).

| Area | Deliverables |
|------|----------------|
| Copilot | Generative AI assistant grounded on client portfolio + opportunities + documents |
| Real-time | Low-latency recommendations where product requires it |
| Journeys | Orchestrated sales playbooks across channels |
| Experimentation | A/B testing framework for copy, rules, and models |
| Learning | Feedback loops from won/lost outcomes into ranking and rules |

**Exit:** Measurable lift in conversion and cycle time vs Stage 1 baseline.

---

## 8. Progress tracking (template)

Use one row per epic; update **Status** (`Planned` / `In progress` / `Done` / `Deferred`) and **Target stage**.

| Epic | Stage | Status | Notes |
|------|-------|--------|-------|
| Example: Client portfolio model | 1 | Planned | Schema + UI |
| Example: Excel import | 1 | Planned | Shared with CSV pipeline |
| Example: Salesforce connector | 2 | Planned | Mapping workshop required |

*(Replace with your issue tracker keys, e.g. JIRA/Linear IDs.)*

---

## 9. Risk summary (portfolio-aware CRM)

| Risk | Mitigation |
|------|------------|
| Inconsistent LOB codes across imports and CRMs | Master `LineOfBusiness` table + alias mapping per integration |
| Duplicate held products from overlapping sources | Unique constraints + merge rules; `ingestion_source` priority documented |
| Excel formula-heavy files | Import **values only**; reject protected/linked books or document limitations |
| External CRM partial payloads | Sync jobs mark `stale` or `unknown`; UI shows last successful sync time |

---

## 10. Document map

| Document | Role |
|----------|------|
| `IMPLEMENTATION-ROADMAP.md` | **This file** — MVP → final product + CRM portfolio requirement |
| `STRATEGIC-PRODUCT-ALIGNMENT.md` | Strategic brief ↔ repository modules and phases |
| `IMPLEMENTATION-SPEC.md` | MVP decisions (updated for LOB / held products / Excel) |
| `IMPLEMENTATION-PLAN.md` | Engineering phases (updated for portfolio + Excel) |
| `PHASE-0-STACK.md` | Locked Phase 0 tooling (Vite, uv, Docker Compose, GitHub Actions) |
| `PHASE-2-CRM.md` | Phase 2 CRM + portfolio implementation summary |
| `DEVELOPMENT.md` | Local development runbook (Postgres, API, web) |
| `PHASE-1-AUTH.md` | Phase 1 JWT auth and Docker Compose (api + web + postgres) |
