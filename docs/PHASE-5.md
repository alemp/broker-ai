# Phase 5 — CSV / Excel client import

**Status:** Implemented. Bulk import uses the same `clients`, `client_lines_of_business`, `client_held_products`, `insured_persons`, and `profile_data` tables as the UI, with `ingestion_source` set to `csv_import` or `excel_import`.

## API

- `POST /v1/clients/import/preview` — multipart field `file` (`.csv` or `.xlsx`). Returns row counts, SHA-256 of the file, row-level errors (messages in **pt-BR**), and a short preview of valid rows.
- `POST /v1/clients/import/commit` — same upload. Re-validates; if any row fails validation, returns `400` with `detail` as a list of `{ row_number, message }`. On success, applies all rows in one transaction and inserts an audit row in `client_import_batches` (actor, filename, hash, counts).

**Limits:** 15 MB file, 10 000 data rows.

## Upsert rules (`IMPLEMENTATION-SPEC.md` §3.1)

1. If `external_id` is non-empty → match client by `(organization_id, external_id)`.
2. Else match by normalized `email` (case-insensitive).
3. Each row must have at least one of `external_id` or `email`. Otherwise the row is rejected.
4. `full_name` is required on every row.

New clients are created with audit `CREATE` events; updates use field-level audit for changed attributes.

## Column reference (header row)

Headers are matched case-insensitively; spaces and hyphens become underscores; **accents are ignored** for matching (e.g. `Razão social` → `razao_social` → `company_legal_name`). Brazilian Portuguese column titles are first-class (e.g. `Nome completo` → `full_name`, `E-mail` / `correio` → `email`, `Linhas de negócio` → `lob_codes`). English canonical names still work.

| Column | Required | Notes |
|--------|----------|--------|
| `full_name` | Yes | |
| `email` | One of email / `external_id` | Normalized; used for upsert |
| `external_id` | One of email / `external_id` | Used for upsert first |
| `phone`, `notes` | No | On update, empty cell = leave unchanged |
| `owner_email` | No | Must match a user email in the same org |
| `client_kind` | No | `INDIVIDUAL` (default) or `COMPANY` / `EMPRESA` / `PJ` |
| `company_legal_name`, `company_tax_id` | If `COMPANY` | |
| `marketing_opt_in` | No | `true`/`false`/`1`/`0`/`sim`/`não` |
| `preferred_marketing_channel` | No | |
| `lob_codes` | No | Semicolon- or comma-separated **LOB codes** (e.g. `MOTOR`, `LIFE`) — must exist in org catalog |
| `held_products` | No | Segments separated by `;`. Each segment: `product_name\|insurer_name\|policy_status\|effective_date\|end_date` (pipe-separated). `product_name` must match **exactly one** active catalog product name in the org (case-insensitive trim). |
| `profile_json` | No | JSON object merged into `profile_data` (same blocks as Phase 3 API) |
| `insured_persons_json` | No | JSON array of `{ "full_name", "relation" }` (`relation`: `HOLDER`, `DEPENDENT`, `OTHER`) — **appended** as new `InsuredPerson` rows |

## Web

**Clientes** → **Importar CSV/Excel** (`/clients/import`): upload → preview → confirm.

## Dependencies

API: `openpyxl` (`.xlsx`), `python-multipart` (upload forms).
