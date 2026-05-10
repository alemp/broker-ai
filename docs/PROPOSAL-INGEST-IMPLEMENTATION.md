# Implementation plan — Proposal ingest & opportunity-linked PDF extraction

This document is the **technical implementation plan** for the feature defined in [`ADR-PROPOSAL-INGEST.md`](./ADR-PROPOSAL-INGEST.md). It is meant to be **updated in-place** as phases land.

- Source of truth for scope and trade-offs: the ADR.
- Source of truth for MVP boundaries: [`MVP_IMPLEMENTATION.md`](./MVP_IMPLEMENTATION.md).
- Language policy: code, entities, columns, schemas and APIs in **English**; UI copy in **pt-BR** via i18n keys.

> **Workspace rule reminder** (`.cursor/rules/docker-compose-rebuild.mdc`): each task that changes code, config or dependencies ends with `ruff check`, `pytest`, `npm run build`, then `docker compose build api web && docker compose up -d --force-recreate api web`, and `alembic upgrade head` when migrations are added.

---

## High-level summary

- `Opportunity` becomes the **proposal container**: gains `insurance_line` (required), `quote_number`, `quote_item`, `quote_valid_until`, `proposal_source`, `proposal_data`.
- `Document` gains **`opportunity_id`** (FK, `ON DELETE CASCADE`) so PDFs are evidence of a specific deal.
- Two ingest channels share **one canonical Pydantic schema per `insurance_line`** (initially `AutoProposalPayload`):
  - **JSON API** for partner integrations.
  - **PDF upload + extraction** triggered after the broker selects `insurance_line` while creating/opening an `Opportunity`.
- Idempotent on `(organization_id, preferred_insurer_name, quote_number, quote_item)`.
- A party (`Client` **or** `Lead`) is **mandatory** for every `Opportunity`. Anonymous quotes are rejected.

---

## Phase status board

| Phase | Title                                                       | Status        |
| ----- | ----------------------------------------------------------- | ------------- |
| 0     | Discovery & ADR                                             | **Done**      |
| 1     | Data model + Alembic migration                              | **Done**      |
| 2     | New opportunity flow (insurance_line → PDF → canonical JSON) | **Done**     |
| 3     | Domain merge service (shared apply layer)                   | **Done**      |
| 4     | JSON ingest API (partner channel)                           | **Done**      |
| 5     | Web UI (wizard, detail tabs, vehicles)                      | Not started   |
| 6     | Documents ↔ Opportunity wiring (core)                       | Not started   |
| 7     | Catalog & coverage taxonomy seed                            | Not started   |
| 8     | Tests, observability & rollout                              | Not started   |
| 9+    | Post-MVP roadmap                                            | Not started   |

---

## Phase 0 — Discovery & ADR

**Status:** Done.

**Deliverables**

- `docs/ADR-PROPOSAL-INGEST.md` — accepted decisions D1–D8, three resolved questions (JSON origin / no anonymous quote / `ON DELETE CASCADE`).
- Reference link added in `docs/MVP_IMPLEMENTATION.md` header.

**Acceptance**

- Decisions are unambiguous and ready to drive code: party mandatory, cascade documents, line via `ProductCategory` enum, single canonical payload per line, partial unique index on quote tuple.

---

## Phase 1 — Data model + Alembic migration

**Status:** Done.

**Goal**

Bring `Opportunity` and `Document` to the shape required by the ADR.

**Deliverables**

- New Alembic migration `apps/api/alembic/versions/<date>_opportunity_proposal_and_documents_opportunity_id.py`:
  - `opportunities`:
    - `insurance_line ProductCategory NOT NULL` (backfilled from `products.category` then `'GENERAL_INSURANCE'` for the rest).
    - `proposal_source VARCHAR(64) NULL`
    - `quote_number VARCHAR(128) NULL`
    - `quote_item SMALLINT NULL`
    - `quote_valid_until DATE NULL`
    - `proposal_data JSONB NULL`
    - Index `ix_opportunities_org_insurance_line(organization_id, insurance_line)`
    - Partial unique index `ix_opportunities_org_quote_unique(organization_id, preferred_insurer_name, quote_number, quote_item) WHERE quote_number IS NOT NULL`
  - `documents`:
    - `opportunity_id UUID NULL REFERENCES opportunities(id) ON DELETE CASCADE`
    - Index `ix_documents_org_opportunity_id(organization_id, opportunity_id)`
- SQLAlchemy model updates in `apps/api/src/ai_copilot_api/db/models.py`:
  - `Opportunity` columns + `documents` relationship.
  - `Document.opportunity_id` + `Opportunity.documents` relationship.
- Pydantic updates in `apps/api/src/ai_copilot_api/schemas/crm.py`:
  - `OpportunityCreate` / `OpportunityUpdate` / `OpportunityOut` / `LeadOpportunityPayload` accept `insurance_line`, `quote_number`, `quote_item`, `quote_valid_until`, `proposal_source`, `proposal_data`.
  - Validator: when `product_id` is set, server enforces `product.category == insurance_line`.
  - Validator: `quote_number` and `proposal_source` provided together (or both null).
- Existing routes adjusted:
  - `apps/api/src/ai_copilot_api/api/routes_opportunities.py` — accept and persist new fields; reject create when `insurance_line` missing.
  - `apps/api/src/ai_copilot_api/api/routes_leads.py` — `convert` payload requires `insurance_line` when an opportunity is created during conversion.

**Files affected**

- `apps/api/alembic/versions/...` (new)
- `apps/api/src/ai_copilot_api/db/models.py`
- `apps/api/src/ai_copilot_api/schemas/crm.py`
- `apps/api/src/ai_copilot_api/api/routes_opportunities.py`
- `apps/api/src/ai_copilot_api/api/routes_leads.py`

**Acceptance**

- `alembic upgrade head` succeeds against an existing DB; backfill leaves no `NULL` `insurance_line`.
- Creating an opportunity without `insurance_line` returns `422`.
- Creating an opportunity whose `product.category != insurance_line` returns `422`.
- Re-uploading a quote with same `(insurer_name, quote_number, quote_item)` updates instead of inserting (will be exercised by Phase 4).

**Landed in this iteration**

- Migration `proposal_ingest_027` (`apps/api/alembic/versions/20260510_proposal_ingest.py`).
- `opportunities` columns: `insurance_line`, `proposal_source`, `quote_number`, `quote_item`, `quote_valid_until`, `proposal_data`; indexes `ix_opportunities_org_insurance_line`, `ix_opportunities_quote_number`, partial unique `ix_opportunities_org_quote_unique`; CHECK `ck_opportunities_quote_required_fields`.
- `documents.opportunity_id` (`ON DELETE CASCADE`) + `ix_documents_org_opportunity_id`.
- `Opportunity.documents` and `Document.opportunity` ORM relationships.
- API: `OpportunityCreate` requires `insurance_line`; `_assert_product_line_match` enforces `product.category == insurance_line`; `_assert_quote_consistency_on_row` mirrors the DB CHECK at the API for clearer 422s. `LeadOpportunityPayload` now requires `insurance_line` on `POST /v1/leads/{id}/convert`.
- Test suite kept green (`docker compose exec api uv run pytest tests` → 52/52).

---

## Phase 2 — New opportunity flow: `insurance_line` → PDF → canonical JSON

**Status:** Done.

**Goal**

Let a broker create an opportunity, pick the insurance line, upload the carrier PDF, and end up with the canonical proposal data on the same opportunity.

**Deliverables**

- Pydantic canonical payload `apps/api/src/ai_copilot_api/schemas/proposal_ingest.py`:
  - `AutoProposalPayload` and its sub-models (`ProposalQuote`, `ProposalApplicant`, `ProposalCoveragePeriod`, `ProposalBrokerage`, `ProposalVehicle`, `ProposalRiskQuestionnaire`, `ProposalLiabilityLimits`, `ProposalAccidentalCoverage`, `ProposalCoverages`, `ProposalDeductibles`, `ProposalPremium`, `ProposalClause`).
  - `ProposalIngestPreviewOut`, `ProposalIngestResultOut`.
- Adapter layer `apps/api/src/ai_copilot_api/domain/proposal_adapters/`:
  - `__init__.py` — `ProposalSourceAdapter` protocol.
  - `bradesco_json_v1.py` — maps the carrier’s Portuguese-keyed JSON to `AutoProposalPayload`.
  - `bradesco_pdf_v1.py` — wraps the existing extractor (`apps/api/src/ai_copilot_api/domain/document_extraction.py`) to produce `AutoProposalPayload`-shaped dicts.
- Extractor extension `apps/api/src/ai_copilot_api/domain/proposal_pdf_extraction.py`:
  - Function `extract_auto_proposal(compact_text, raw_text) -> ExtractionResult` that fills as many `AutoProposalPayload` fields as possible; sets `requires_review=True` when `AutoProposalPayload.model_validate` fails.
  - Reuses `extract_pdf_text_with_ocr` for OCR fallback (already wired in `routes_document_extraction.py`).
- API endpoints:
  - `POST /v1/opportunities/{opportunity_id}/proposal-extract` — runs extraction on the latest `Document(opportunity_id=opportunity_id, document_type=PROPOSAL)`, validates against the canonical payload for `opportunity.insurance_line`, applies via Phase 3 service.
  - `routes_documents.py` upload extended with `Form(opportunity_id: UUID | None)`; tenant-checked.
- Permissions tightened in `apps/api/src/ai_copilot_api/api/deps.py`:
  - Broker may extract / apply proposal for opportunities they own; sales manager / admin unrestricted.

**Files affected**

- `apps/api/src/ai_copilot_api/schemas/proposal_ingest.py` (new)
- `apps/api/src/ai_copilot_api/domain/proposal_adapters/*.py` (new)
- `apps/api/src/ai_copilot_api/domain/proposal_pdf_extraction.py` (new)
- `apps/api/src/ai_copilot_api/api/routes_opportunities.py` (proposal-extract endpoint)
- `apps/api/src/ai_copilot_api/api/routes_documents.py` (`opportunity_id` Form param)
- `apps/api/src/ai_copilot_api/api/deps.py`

**Acceptance**

- Uploading a PDF with `opportunity_id` creates a `Document` linked to that opportunity.
- Calling `proposal-extract` writes the canonical JSON into `Opportunity.proposal_data` with `quote_number`, `quote_valid_until`, `preferred_insurer_name`, and `estimated_value` derived from the payload.
- When validation against `AutoProposalPayload` fails, the run is persisted with `requires_review=True` and a structured error payload that the UI can render.

**Landed in this iteration**

- Canonical schemas in `apps/api/src/ai_copilot_api/schemas/proposal_ingest.py`: `AutoProposalPayload` + sub-models (`ProposalQuote`, `ProposalApplicant`, `ProposalCoveragePeriod`, `ProposalBrokerage`, `ProposalVehicle`, `ProposalRiskQuestionnaire`, `ProposalCoverages`, `ProposalDeductibles`, `ProposalPremium`, `ProposalClause`) plus `ProposalIngestPreviewOut` / `ProposalIngestResultOut`.
- Adapter layer in `apps/api/src/ai_copilot_api/domain/proposal_adapters/`:
  - `__init__.py` exposes the `ProposalSourceAdapter` protocol and `select_adapter_for_pdf` / `select_adapter_for_json`.
  - `bradesco_json_v1.py` maps the carrier's pt-BR JSON (with the `T24:00:00` quirk) onto the canonical dict.
  - `bradesco_pdf_v1.py` reuses the JSON adapter via `extract_auto_proposal` to keep one normalization path for both channels.
- Heuristic extractor `apps/api/src/ai_copilot_api/domain/proposal_pdf_extraction.py` (`extract_auto_proposal(compact_text, raw_text)`).
- Endpoint `POST /v1/opportunities/{opportunity_id}/proposal-extract?dry_run=...` runs OCR-aware extraction, validates against `AutoProposalPayload`, persists a `DocumentExtractionRun`, and writes `Opportunity.proposal_data` + idempotency keys (`quote_number`, `quote_item`, `quote_valid_until`, `preferred_insurer_name`, `estimated_value`, `proposal_source`). Validation failures keep `requires_review=True` and surface a structured `validation_errors` payload.
- `POST /v1/documents` accepts `Form(opportunity_id)`, validates tenant via `_validate_opportunity_in_org`, and the existing-document lookup is now scoped per opportunity. `DocumentOut.opportunity_id` is exposed.
- Permission helper `assert_can_extract_for_opportunity` in `apps/api/src/ai_copilot_api/api/deps.py` (ADR §D7).
- Tests `apps/api/tests/test_proposal_ingest_phase2.py` cover: Bradesco JSON adapter mapping (canonical fields, `T24:00:00` coercion), PDF happy-path with `proposal_data` written + `requires_review=False`, PDF-without-data `requires_review=True` with structured errors, missing-document → 404, and unknown-`opportunity_id` upload → 404.
- Suite stays green (`docker compose exec api uv run pytest tests` → 57/57).

---

## Phase 3 — Domain merge service (shared apply layer)

**Status:** Done.

**Goal**

A single function applies a canonical proposal to an `Opportunity` — used by both the JSON channel (Phase 4) and the PDF channel (Phase 2).

**Deliverables**

- `apps/api/src/ai_copilot_api/domain/proposal_ingest.py`:
  - `normalize_tax_id(raw)` — digits-only CPF/CNPJ normalization.
  - `resolve_party(db, organization_id, applicant, *, opportunity)` → `Client | Lead`. Prefers the opportunity's already-linked party, falls back to lookup by normalized `tax_id` against `Client.company_tax_id`/`external_id` then `Lead.company_tax_id`/`external_id`. Raises `LookupError` when no match (the route layer maps it to `422` per ADR §D7).
  - `merge_personal_block(profile, payload)` and `merge_mobility_block(profile, payload)` — pure helpers under the no-overwrite policy. Mobility upserts into `profile_data.mobility.vehicles[]` keyed by `chassis` (preferred) or `plate` and tags `last_quote_number` / `last_quoted_at`. Sets `owns_vehicle=True` and `vehicle_count` only when previously `None`.
  - `resolve_insurer(db, organization_id, name, *, auto_create=False)` — case-insensitive lookup by name; auto-creates when requested by Phase 4.
  - `resolve_product(db, organization_id, insurer, product_name, insurance_line)` — active-only, scoped by insurer + category.
  - `apply_auto_proposal_to_opportunity(db, *, opportunity, payload, proposal_source, actor_user_id, party=None) -> ApplyResult` — single write path: opportunity columns + `proposal_data`, party scalar enrichment, profile merge, append-only audit. Idempotent: re-applying produces no audit deltas (`record_field_updates` short-circuits on equal old/new).
  - `apply_audit_trail(...)` — emits `CrmAuditEvent` rows for the party (per scalar field) and for the opportunity (`insurance_line`, `proposal_source`, `preferred_insurer_name`, `quote_number`, `quote_item`, `quote_valid_until`, `estimated_value`).
- Profile schema extension in `apps/api/src/ai_copilot_api/schemas/client_profile.py`:
  - New `ClientProfileVehicle` model and `vehicles: list[ClientProfileVehicle] | None` on `ClientProfileMobility` (no DB migration; JSONB).
- Recommendation rule update in `apps/api/src/ai_copilot_api/domain/recommendation_rules.py`:
  - `RULE_AUTO_GAP` derives `owns_vehicle` from legacy field **or** non-empty `vehicles[]`, and considers an opportunity with non-empty `proposal_data` and `insurance_line=AUTO_INSURANCE` (stage ≠ `CLOSED_LOST`) as in-flight coverage so the rule does not re-recommend during an active quote.
- Completeness/alerts update in `apps/api/src/ai_copilot_api/domain/client_profile.py` to weigh `vehicles[]` alongside the legacy `owns_vehicle` flag.
- `routes_opportunities.proposal_extract` was rewired to call `apply_auto_proposal_to_opportunity` (the inline Phase 2 helper was removed) and now resolves the party explicitly via `resolve_party`, returning `422` with the lookup error message when needed.

**Files affected**

- `apps/api/src/ai_copilot_api/domain/proposal_ingest.py` (new)
- `apps/api/src/ai_copilot_api/schemas/client_profile.py`
- `apps/api/src/ai_copilot_api/domain/recommendation_rules.py`
- `apps/api/src/ai_copilot_api/domain/client_profile.py`
- `apps/api/src/ai_copilot_api/api/routes_opportunities.py`
- `apps/api/tests/test_proposal_ingest_phase3.py` (new — 7 tests covering pure helpers, route-level enrichment, no-overwrite, idempotency, and the rule acceptance)

**Acceptance**

- Same payload applied twice yields the same `Opportunity.id` and the same `proposal_data` (verified by `test_apply_extract_is_idempotent`).
- Existing party fields are not overwritten; missing fields are populated (verified by `test_apply_extract_no_overwrite_existing_party_fields`).
- After applying an auto proposal, `RULE_AUTO_GAP` no longer fires for that party (verified by `test_rule_auto_gap_does_not_fire_after_proposal_apply`).
- Suite stays green: `docker compose exec api uv run pytest tests` → 71/71 (includes Phase 4).

---

## Phase 4 — JSON ingest API (partner channel)

**Status:** Done.

**Goal**

Allow programmatic submission of canonical proposals (or carrier-shaped JSON) without a PDF round-trip.

**Deliverables**

- Routes `apps/api/src/ai_copilot_api/api/routes_proposal_ingest.py`:
  - `POST /v1/proposals/auto/preview` (`require_broker_or_above`) — read-only: validates `payload` via `source` adapter, resolves idempotency tuple and party; **never** writes to the DB. Returns `ProposalIngestPreviewOut` (`opportunity_id` / `party_id` when known, `would_create_lead` when preview would create a lead on commit).
  - `POST /v1/proposals/auto/commit` — persists: upserts by `(organization_id, preferred_insurer_name, quote_number, quote_item)` via `find_opportunity_by_quote_tuple`, calls `apply_auto_proposal_to_opportunity`, or creates a `Lead` (`create_lead_from_applicant` + audit snapshot) then a new `Opportunity` when no row exists. `409` + `PROPOSAL_INGEST_PARTY_MISMATCH` when an existing opportunity’s party does not match the applicant tax id; `409` + `PROPOSAL_QUOTE_CONFLICT` on unique violations.
  - `POST /v1/proposals/auto/webhook` — returns `501` with `WEBHOOK_NOT_ENABLED` (placeholder).
- `select_adapter_for_json`: `bradesco_json_v1` / **`bradesco_v1`** → `BradescoAutoJsonAdapterV1`; **`canonical_auto_v1`** → pass-through dict for partners sending canonical JSON already.
- `deps.require_broker_or_above` — `ADMIN`, `SALES_MANAGER`, or `BROKER`.
- Domain: `find_opportunity_by_quote_tuple`, `applicant_matches_party`, `create_lead_from_applicant` in `domain/proposal_ingest.py`.
- `ProposalIngestPreviewOut` / `ProposalIngestResultOut`: optional `opportunity_id`, `party_id`, `party_kind` on preview; PDF `proposal-extract` response now includes `party_id` / `party_kind` when validation succeeds.
- Wiring in `apps/api/src/ai_copilot_api/main.py` — `app.include_router(..., prefix="/v1")`.

**Files affected**

- `apps/api/src/ai_copilot_api/api/routes_proposal_ingest.py` (new)
- `apps/api/src/ai_copilot_api/main.py`
- `apps/api/src/ai_copilot_api/api/deps.py`
- `apps/api/src/ai_copilot_api/domain/proposal_ingest.py`
- `apps/api/src/ai_copilot_api/domain/proposal_adapters/__init__.py`
- `apps/api/src/ai_copilot_api/schemas/proposal_ingest.py`
- `apps/api/src/ai_copilot_api/api/routes_opportunities.py`
- `apps/api/tests/test_proposal_ingest_phase4.py` (new)

**Acceptance**

- Preview never persists (`test_preview_does_not_create_opportunity`).
- Commit creates or updates the opportunity and party; creates a `Lead` when `create_lead_if_missing=true` and no tax match (`test_commit_creates_lead_and_opportunity_then_idempotent`).
- Re-submission of the same quote tuple returns the same `opportunity_id` (idem).
- No matching party with `create_lead_if_missing=false` on preview → `422` + `NO_MATCHING_PARTY`.
- Unknown `source` → `422` + `UNKNOWN_PROPOSAL_SOURCE`.
- Webhook stub → `501` + `WEBHOOK_NOT_ENABLED`.

---

## Phase 5 — Web UI

**Status:** implemented (wizard em `/opportunities/proposal-import`, tabs na ficha, filtro `insurance_line` na lista, upload PDF para corretor/admin com `opportunity_id`, `GET /v1/documents` filtrado no cliente).

**Goal**

Make the broker workflow effortless: pick line → upload PDF → confirm → opportunity ready.

**Deliverables**

- New page `apps/web/src/pages/ProposalIngestPage.tsx`:
  - Step 1: Party (`client` / `lead`), `owner`, **`insurance_line`** select (required).
  - Step 2: PDF upload (drop zone + paste fallback) — calls `POST /v1/documents` with `opportunity_id` (creating opportunity in step 1 first if needed).
  - Step 3: Extraction job status (polls `BatchJobRun`) and review of the canonical JSON.
  - Step 4: Confirm + apply.
- Updates to existing pages:
  - `apps/web/src/pages/OpportunityCreatePage.tsx` — required `insurance_line`.
  - `apps/web/src/pages/OpportunityDetailPage.tsx` — tabs **Documents** and **Proposal data**; badge `From quote` when `proposal_source != null`.
  - `apps/web/src/pages/OpportunitiesPage.tsx` — column + filter by `insurance_line`.
  - `apps/web/src/components/PartyOpportunitiesCard.tsx` — line badge + quote badge.
  - `apps/web/src/components/InsuranceProfileTab.tsx` — `Vehicles` sub-tab listing `mobility.vehicles[]`.
- TS types in `apps/web/src/lib/api.ts` (or a dedicated `apps/web/src/lib/proposalIngest.ts`); no `any`, prefer inferred / `unknown`.
- Lazy route + `ProtectedRoute` wiring in `apps/web/src/App.tsx`.
- i18n keys in `apps/web/src/locales/pt-BR/*` (e.g. “Ramo de seguro”, “Cotação”, “Validade”, “Importar PDF”).

**Files affected**

- `apps/web/src/pages/ProposalIngestPage.tsx` (new)
- `apps/web/src/pages/OpportunityCreatePage.tsx`, `OpportunityDetailPage.tsx`, `OpportunitiesPage.tsx`
- `apps/web/src/components/PartyOpportunitiesCard.tsx`, `InsuranceProfileTab.tsx`
- `apps/web/src/lib/...`, `apps/web/src/locales/...`, `apps/web/src/App.tsx`

**Acceptance**

- `npm run build` clean.
- Vitest covers happy-path and validation error paths of `ProposalIngestPage`.
- UI never sends `any` typed payloads; types match the API contract.

---

## Phase 6 — Documents ↔ Opportunity wiring (core)

**Status:** implemented (`GET /v1/documents?opportunity_id=…` tenant-guarded; `OpportunityDetailOut` embeds `DocumentBrief` with the latest extraction summary; `POST /v1/documents/{id}/extract` runs the canonical proposal pipeline using `Opportunity.insurance_line` and auto-applies via `apply_auto_proposal_to_opportunity` when `confidence >= 70`).

**Goal**

Finish the wiring so that documents and extraction are first-class artifacts of an opportunity (the part of the ADR that goes beyond the migration in Phase 1).

**Deliverables**

- `routes_documents.py`:
  - `GET /v1/documents` accepts optional `opportunity_id` filter.
  - Upload validates `opportunity_id` belongs to the same `organization_id`.
  - Listing per-opportunity returns documents with version + extraction summaries (`DocumentBrief`).
- `routes_document_extraction.py`:
  - When `Document.opportunity_id` is set, the extractor reads `insurance_line` from the **opportunity**, not from the request, and forwards it into `extract_auto_proposal` (Phase 2).
  - On success, calls Phase 3 `apply_auto_proposal_to_opportunity` (no manual confirm step) when `confidence >= 70`; otherwise leaves `requires_review=True` for human confirm via the existing `PATCH .../extractions/{run_id}/confirm`.
- `OpportunityDetailOut` (in `schemas/crm.py`) optionally exposes `documents: list[DocumentBrief]`.

**Files affected**

- `apps/api/src/ai_copilot_api/api/routes_documents.py`
- `apps/api/src/ai_copilot_api/api/routes_document_extraction.py`
- `apps/api/src/ai_copilot_api/schemas/crm.py`

**Acceptance**

- Deleting an `Opportunity` cascades its `Document` rows (DB) and reaps unreferenced storage objects (path already in `routes_documents.py`).
- Extracting a PDF whose document is linked to an `Opportunity` writes `Opportunity.proposal_data` automatically when confidence is high enough.
- Listing documents by opportunity returns the expected rows for that tenant only.

---

## Phase 7 — Catalog & coverage taxonomy seed

**Status:** implemented (idempotent, tenant-aware seed at `apps/api/scripts/seed_bradesco_catalog.py`; seeds Bradesco insurer + `BRADESCO SEGURO AUTO PRIME` product + 9 `CoverageTaxonomy` entries; admin-added synonyms are preserved on re-runs).

**Goal**

Make the resolver succeed for the first design partner and prepare data for coverage-level adequacy.

**Deliverables**

- Insurer + product seed:
  - `Insurer { name: "Bradesco Auto/RE Companhia de Seguros", code: "BRADESCO" }`
  - `Product { name: "BRADESCO SEGURO AUTO PRIME", category: AUTO_INSURANCE, insurer_id: ..., risk_level: MEDIUM, additional_coverages: [...] }`
- `CoverageTaxonomy` initial entries: `001` `comprehensive_coverage`, `006` `mercosur_extension`, `024` `glass_coverage_plus`, `038` `market_referenced_value`, `056` `moral_damages`, `081` `accidental_passengers`, `106` `roadside_assistance_24h`, `115` `courtesy_car`, `157` `medical_hospital_expenses`.
- Optional admin script under `apps/api/scripts/seed_bradesco_catalog.py` (idempotent, tenant-aware) or doc instructions to seed via UI.

Run inside the API container:

```bash
docker exec -w /app -e DATABASE_URL=$DATABASE_URL broker-ai-api-1 \
    uv run python scripts/seed_bradesco_catalog.py --org-slug default
```

The script reports a JSON-like summary (`insurer_created`, `product_created`, `taxonomy_created/updated`) and is safe to re-run.

**Files affected**

- `apps/api/scripts/seed_bradesco_catalog.py` (new)
- `apps/api/tests/test_proposal_ingest_phase7.py` (new)
- `apps/web/src/pages/CoverageTaxonomyPage.tsx` (no code change; used to manage synonyms)

**Acceptance**

- `resolve_product` returns the Bradesco product when the canonical payload references the carrier and product names.
- Coverage taxonomy entries are visible in the existing taxonomy admin page.

---

## Phase 8 — Tests, observability & rollout

**Goal**

Ship with confidence and visibility.

**Deliverables**

- API tests (pytest, Postgres compose):
  - `tests/api/test_opportunities_insurance_line.py` — 422 paths, product/category match.
  - `tests/api/test_proposal_auto_preview.py`, `test_proposal_auto_commit.py` — JSON channel.
  - `tests/api/test_proposal_pdf_flow.py` — PDF channel end-to-end (small fixture PDF).
  - `tests/domain/test_proposal_ingest_service.py` — pure unit.
  - `tests/migrations/test_opportunity_insurance_line_migration.py` — backfill correctness.
- Frontend tests (vitest):
  - `apps/web/src/pages/ProposalIngestPage.test.tsx`
  - Smoke tests on `OpportunityCreatePage` and `OpportunityDetailPage` for `insurance_line`.
- Observability:
  - Structured logs in `proposal_ingest` (`quote_number`, `party_id`, `opportunity_id`, `dry_run`, `insurance_line`).
  - `CrmAuditEvent` rows for every CREATE/UPDATE on `Client`/`Lead`/`Opportunity` mutated by the flow.
  - Dashboard additions in `apps/api/src/ai_copilot_api/api/routes_dashboard.py` and `OpportunityMetricsSummary`:
    - `by_insurance_line: dict[str, int]`
    - “Proposals ingested per day” when `proposal_source IS NOT NULL`.
- Rollout (workspace rule):

```bash
cd apps/api && uv run ruff check src tests && uv run pytest
cd apps/web && npm run build
docker compose build api web && docker compose up -d --force-recreate api web
alembic upgrade head
```

**Acceptance**

- All test suites pass against the compose Postgres.
- Dashboard surfaces line breakdown.
- Audit events present for at least the create-and-apply path.

---

## Phase 9+ — Post-MVP roadmap

These phases follow Stages 2–4 in `MVP_IMPLEMENTATION.md`. They are **out of scope** for the initial delivery but live here to keep continuity.

- **Win → portfolio:** when a `proposal_source IS NOT NULL` opportunity moves to `CLOSED_WON`, automatically create a `ClientHeldProduct` with `effective_date`/`end_date` from `proposal_data.coverage_period`, `ingestion_source = DOCUMENT_EXTRACTION`. Adds `ClientHeldProduct.source_opportunity_id` (migration).
- **Coverage-level adequacy:** *implemented* — `domain/coverage_adequacy.py` matches `Product.additional_coverages` against `Opportunity.proposal_data.clauses[]` (exact code or taxonomy-synonym) and produces a per-coverage traffic light. `OpportunityDetailOut` exposes `coverage_adequacy: list[CoverageAdequacyOut]`.
- **Multi-line adapters:** *foundation + Tokio Marine PME life carrier adapter wired end-to-end* — canonical `LifeProposalPayload` (with optional `insured` for individual plans, optional `group: ProposalLifeGroupProfile` for collective plans, plus a structured `coverage_items[]` capturing per-row carrier detail and a flat `coverages` block rolled up by code), `HomeProposalPayload`, `BusinessProposalPayload`, dispatch via `select_proposal_payload_class(insurance_line, *, subject_kind)`, canonical pass-through JSON adapters (`canonical_life_v1`, `canonical_home_v1`, `canonical_business_v1`), and the first carrier-specific JSON adapter `tokio_life_json_v1` / `tokio_life_v1` (Tokio Marine PME Vida Empresa). The JSON ingest channel itself is now line-agnostic: `_adapt_and_validate(...)` selects the canonical Pydantic class from `adapter.insurance_line` (peeking at `subject_kind` for `GENERAL_INSURANCE`), and `apply_proposal_to_opportunity(...)` (alias `apply_auto_proposal_to_opportunity` kept for backward compat) skips the AUTO mobility merge for non-AUTO payloads. New line-neutral routes `POST /v1/proposals/preview` and `POST /v1/proposals/commit` are exposed alongside the existing `/auto/*` URLs. PDF channel still returns a clean 422 for non-AUTO lines until per-carrier PDF adapters ship.
- **Inbound webhook:** API key + HMAC + replay protection for `/v1/proposals/auto/webhook`.
- **Renewal automation:** batch job detecting `proposal_data.coverage_period.end_at <= today + 60d` and creating `CampaignTouch` for the existing `RENEWAL_REMINDER` `CampaignKind`.

---

## PR sequencing (suggested)

| PR  | Phase | Scope                                                                                              | Risk   |
| --- | ----- | -------------------------------------------------------------------------------------------------- | ------ |
| 1   | 1     | Migration + `Opportunity.insurance_line` + `proposal_*` + `documents.opportunity_id` + tests        | Medium |
| 2   | 1     | Schemas + opportunities/leads routes accept `insurance_line` + frontend select for opportunities    | Low    |
| 3   | 2/3   | `AutoProposalPayload` + adapters + domain merge service + recommendation/profile updates            | Medium |
| 4   | 2/6   | Document upload `opportunity_id` + extraction wiring with `insurance_line` + `proposal-extract` API | Medium |
| 5   | 4     | JSON ingest API (`/v1/proposals/auto/preview` + `commit`)                                           | Medium |
| 6   | 5     | Web wizard + opportunity detail tabs + vehicles tab + i18n                                          | Medium |
| 7   | 7     | Bradesco insurer + product + CoverageTaxonomy seed                                                  | Low    |
| 8   | 8     | Tests, observability, dashboard line breakdown                                                      | Low    |
| 9+  | 9     | Post-MVP roadmap items (each its own ADR/PR)                                                        | Varies |
