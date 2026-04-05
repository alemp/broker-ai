# Phase 6 — Product catalog and rule engine (consultative recommendations)

**Status:** Implemented. Rules are **code-defined** (no string `eval`); evaluation lives in `evaluate_rules_for_client` in [`recommendation_rules.py`](../apps/api/src/ai_copilot_api/domain/recommendation_rules.py). Outputs carry **`rule_ids`** per suggested product and a **`rule_trace`** (all rules evaluated with fired / not fired and a short detail).

## Goals met (exit criteria)

- **Predictable rules:** Changing conditions in code changes recommendations in a testable way (`tests/test_modules_56_59.py`).
- **Explainability:** UI shows rationale, matched `rule_ids`, protection gaps, predictable objections, next-best action; client detail includes a **live preview** (`GET` recommendations) with **rule trace** expander; opportunity detail surfaces the same item fields.
- **Portfolio signal:** At least one rule uses LOB / catalog gap (e.g. `RULE_LOB_AUTO_PORTFOLIO_GAP`).
- **Profile signal:** At least one rule uses Phase 3 profile keys (e.g. `RULE_PROFILE_HIGH_EARNER_PROTECTION` on `professional.approximate_income_band`).

## API (intel / recommendations)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/v1/clients/{client_id}/recommendations` | Preview: `items` + `rule_trace`; optional `opportunity_id` |
| `POST` | `/v1/clients/{client_id}/recommendation-runs` | Persist run + items (existing pre–Phase 6) |
| `GET` | `/v1/recommendation-runs` / `…/{id}` | List / detail runs |
| `POST` | `/v1/recommendation-feedback` | Broker feedback on suggestions |
| `GET` | `/v1/recommendation-rules` | **Phase 6** — authenticated catalog of built-in rule metadata (`rule_id`, `title`, `description`, `inputs`) |

`GET /v1/recommendation-rules` mirrors `list_builtin_recommendation_rules()` for transparency (operators, docs, future UI).

## Web

- **Cliente:** Intel tab + **Pré-visualização atual** on detail (refresh + full item fields + rule trace).
- **Oportunidade:** Recommendation card with the same structured fields where applicable.

## Dependencies

- **Phase 2:** `Client`, LOB, held products, `Product` catalog.
- **Phase 3:** Profile JSON for rules that read profile blocks.

## Related docs

- Pre–Phase 6 intel slice: [`PHASE-PRE6-MODULES-56-59.md`](./PHASE-PRE6-MODULES-56-59.md).
- Plan: [`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md) §Phase 6.
