# ADR: Proposal ingest and opportunity-linked PDF extraction

**Status:** Accepted (Phase 0 — design locked for implementation)  
**Date:** 2026-05-10  
**Deciders:** Engineering (design partner assumptions documented below)

---

## Context

The brokerage needs to capture **motor insurance quotations** (and later other lines) as **first-class CRM opportunities**, not only as free-form notes or detached documents. Inputs arrive as:

1. **Structured JSON** from quoting systems or partners (e.g. carrier-specific payloads).
2. **PDF proposal files** uploaded by brokers after the user selects the **insurance line** (`insurance_line`); an internal extractor produces **canonical JSON** aligned with the same schema used for direct JSON ingest.

The product already has `Opportunity`, `Client` / `Lead`, `Client.profile_data` (enriched profile JSON), `Document` + `DocumentExtractionRun`, and `ProductCategory` on `Product`. A prior schema iteration used separate `LineOfBusiness` tables; those were **removed** (`alembic/versions/20260419_remove_lines_of_business.py`). **Ramos** (lines) for opportunities are therefore modeled with **`ProductCategory`**-style enumeration on the opportunity itself, consistent with `Product.category`.

---

## Decision

### D1 — The opportunity is the proposal container

- Persist the canonical proposal payload on **`opportunities`** as typed JSON (e.g. `proposal_data`) plus stable identifiers for idempotency (`quote_number`, `quote_item`, `quote_valid_until`, `proposal_source`).
- **`insurance_line`** is a **required** column on `opportunities`, using the same enum values as `Product.category` (`ProductCategory`: `AUTO_INSURANCE`, `LIFE_INSURANCE`, `HEALTH_INSURANCE`, `GENERAL_INSURANCE`).
- When `product_id` is set, **`insurance_line` MUST match `products.category`** (enforced in API / domain layer).

### D2 — Two ingest channels, one canonical schema per line

| Channel | Flow |
|--------|------|
| **JSON API** | Partner or internal job posts canonical `AutoProposalPayload` (English field names) → validate → merge onto `Opportunity` + party profile. |
| **PDF** | User creates or opens an `Opportunity`, selects **`insurance_line`**, uploads PDF → `Document` linked via **`documents.opportunity_id`** → extraction job → output dict validated as the same canonical payload for that line → merge onto the same `Opportunity`. |

- **Adapter boundary:** External payloads (Portuguese keys, carrier-specific shapes) are normalized **only** in adapters (e.g. `bradesco_json_v1`, future `bradesco_pdf_v1`). **Database and API contracts use English** per `docs/MVP_IMPLEMENTATION.md` §2.

### D3 — Documents are mandatory evidence, linked to the opportunity (Phase 6 core)

- Add **`documents.opportunity_id`** (nullable for backward compatibility with org-level documents not tied to a deal).
- Upload API accepts optional **`opportunity_id`**; server validates tenant and that the opportunity belongs to the same `organization_id`.
- Extraction jobs for proposal PDFs **read `insurance_line` from the parent `Opportunity`** when `opportunity_id` is set, so routing does not rely solely on client-supplied metadata on the upload form.
- **Cascade on delete:** the FK uses **`ON DELETE CASCADE`** — when an `Opportunity` is removed, its linked `Document` rows (and downstream `DocumentVersion` / `DocumentExtractionRun` rows that already cascade from `documents`) are removed too. Storage objects are reaped through the existing `_delete_storage_object_if_unreferenced` path in `routes_documents.py`. Org-level documents (those without `opportunity_id`) are unaffected.

### D4 — Party resolution (client vs lead)

- Every `Opportunity` **MUST** be linked to exactly one party — a `Client` **or** a `Lead`. **Anonymous quotes are not supported**: ingest commit fails with `422` if neither `client_id` nor `lead_id` can be resolved.
- Match party by **normalized tax id** stored on **`clients.external_id`** / **`leads.external_id`** (same spirit as client import upsert in `MVP_IMPLEMENTATION.md` §4). When the JSON or extracted PDF carries a tax id, the server attempts the lookup automatically; otherwise the UI requires the user to pick a `Client` or `Lead` before commit.
- When no party is found by tax id, the default action is **create a `Lead`** (parity with “unknown prospect” flows and existing `Lead` → `Client` conversion). Creating a `Client` immediately remains an optional flag for a later iteration.

### D5 — Idempotency

- Unique business key for the same quoted item: **`(organization_id, preferred_insurer_name, quote_number, quote_item)`** when `quote_number` is not null, implemented as a **partial unique index** so manually created opportunities without quotes are not constrained.
- Re-ingest of the same quote **updates** the existing `Opportunity` row (same `id`), refreshing `proposal_data` and monetary fields.

### D6 — Profile merge policy

- Applying a proposal **enriches** `profile_data` (e.g. mobility / vehicles) with a **no-overwrite** rule for non-empty existing fields, consistent with progressive enrichment described in `PRODUCT.md` §5.3.

### D7 — Permissions (assumption until product confirms)

- **Today:** document extraction trigger is admin-only (`routes_document_extraction.py`).
- **Target:** brokers may run extraction for **`Document` rows whose `opportunity_id` points to an opportunity they own** (`owner_id == current_user.id`), or any broker if `SALES_MANAGER` / `ADMIN` — exact matrix to be encoded in `api/deps.py` during implementation.

### D8 — Portfolio (`ClientHeldProduct`)

- **Out of scope for initial ingest:** winning an opportunity does **not** automatically create `ClientHeldProduct` until a dedicated ADR or Phase 11 item explicitly defines `CLOSED_WON` → portfolio automation and optional `source_opportunity_id`.

---

## Consequences

### Positive

- Single CRM object (`Opportunity`) for pipeline, forecasting, and renewal follow-up.
- PDF and JSON share one validation and merge path → less drift.
- `insurance_line` enables filtering, dashboards, and line-specific extractors without reintroducing LOB tables.

### Negative / trade-offs

- **`ProductCategory` mixes “marketing line” and technical P&C split** (e.g. auto vs multirisk). If the business later needs finer LOB, add a dedicated `InsuranceLine` enum or revive LOB tables — migration would adjust `insurance_line` source of truth.
- Partial unique index on insurer **name** string is weaker than `insurer_id`; a follow-up may add `opportunity.insurer_id` FK.

---

## Resolved questions (design partner — 2026-05-10)

1. **JSON origin & signed webhook (Phase 4+):** confirmed scope — internal quoting export plus carrier-side payloads; a signed inbound webhook (API key + HMAC) is in plan for Phase 4+ and not blocking earlier phases. *(see D2)*
2. **Anonymous quote:** **not allowed**. Every opportunity must be linked to either a `Client` or a `Lead`. *(see D4)*
3. **`DELETE` opportunity:** linked documents use **`ON DELETE CASCADE`**. *(see D3)*

---

## References

- `docs/MVP_IMPLEMENTATION.md` — MVP scope, language policy, import upsert.
- `docs/PRODUCT.md` §5.3–5.4 — enriched profile and funnel.
- `apps/api/src/ai_copilot_api/db/models.py` — `Opportunity`, `Document`, `Product`.
- `apps/api/src/ai_copilot_api/api/routes_document_extraction.py` — extraction job pattern.
