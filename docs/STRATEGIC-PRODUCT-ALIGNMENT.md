# Strategic product brief ↔ repository implementation

**Purpose:** Map the **intelligent commercial platform for insurance brokerages** product scope to **this codebase** and to [`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md) / [`IMPLEMENTATION-ROADMAP.md`](./IMPLEMENTATION-ROADMAP.md). The canonical stakeholder brief is [`PRODUCT.md`](./PRODUCT.md) (Portuguese).

**Living checklist:** Update **§2** (module status) and **§3** (crosswalk) when a phase ships or scope changes. Phase numbers follow the current [`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md) (Phases 3–4 = profile + interactions; import = Phase 5; rules = Phase 6; …).

**Language:** This file is **English** per [`IMPLEMENTATION-ROADMAP.md`](./IMPLEMENTATION-ROADMAP.md) §header. [`PRODUCT.md`](./PRODUCT.md) remains in Portuguese for business audiences.

---

## 1. Reconciling “buy + integrate + differentiate” with the MVP build

The strategic brief recommends an **accelerator** model: adopt mature CRM, marketing automation, WhatsApp Business API, and BI (e.g. HubSpot, Pipedrive, Salesforce, RD Station, Power BI, Looker Studio) and build only **differentiation** (enriched insurance profile, recommendation engine, adequacy “traffic light”, prioritization, specialized catalog, broker UX, later copilot).

**MVP decision in this repo** (locked in [`MVP-CRM-STRATEGY.md`](./MVP-CRM-STRATEGY.md) and [`IMPLEMENTATION-SPEC.md`](./IMPLEMENTATION-SPEC.md) §3):

| Strategic recommendation | MVP in this repo | Rationale |
|--------------------------|------------------|-----------|
| External CRM as system of record | **No** — **internal minimal CRM** + **CSV/Excel import** | Speed, single canonical model for portfolio + rules, design-partner validation before vendor lock-in |
| Marketing / régua on third-party tools | **Not integrated** in MVP | Same; may integrate in **Stage 2+** per roadmap |
| Build differentiation (rules, catalog, portfolio intelligence) | **Yes** — planned in Phases 3–9 | Aligns with brief §7.3 |

**Product narrative:** For the first release we **defer CRM/marketing accelerators** and ship a **unified thin CRM + portfolio** so recommendations and future semáforo/scoring read one truth. **External CRM sync** remains explicit **post-MVP** ([`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md) Phase 11, [`IMPLEMENTATION-ROADMAP.md`](./IMPLEMENTATION-ROADMAP.md) Stage 2).

**MVP insurance lines (catalog focus):** **Auto**, **Ramos elementares** (general / multirisco), **Vida (Life)** — DB seed and LOB labels via Alembic `mvp_catalog_007`; API enum `ProductCategory.GENERAL_INSURANCE` for elementares.

---

## 2. Functional modules: strategic scope vs implementation

Legend: **Done** = shipped in repo through the phase noted (e.g. [`PHASE-2-CRM.md`](./PHASE-2-CRM.md), [`PHASE-3-PROFILE.md`](./PHASE-3-PROFILE.md)). **Planned** = scheduled in [`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md) with phase number. **Partial** = some entities/APIs exist today; full brief not met until the listed phase.

| Strategic module (brief §5) | In-repo status | Phase / notes |
|------------------------------|----------------|---------------|
| **5.1** Users, roles, permissions, org structure | **Partial** | JWT auth, org scope, users ([`PHASE-1-AUTH.md`](./PHASE-1-AUTH.md)). Missing: broker/manager/admin **roles**, regional/team/supervisor, password recovery, module permissions, **audit log** — extend over time; LGPD audit Phase 10 |
| **5.2** Leads, clients, opportunities, import | **Partial** | **Done:** same as pre–Phase 5 slice **plus** [**Phase 5**](./PHASE-5.md) CSV/Excel import (`/v1/clients/import/*`, `client_import_batches`, LOB/held/profile/segurados columns). **Still:** full **roles**/hierarchy still §5.1 |
| **5.3** Enriched insurance profile (blocks A–H) | **Partial** | **In repo:** JSONB `profile_data`, Pydantic A–H, merge `PATCH`, `completeness_score`, `profile_alerts` (regras de consistência + cópia PT na UI), **web edita todos os campos do schema** no detalhe do cliente. **Gaps vs brief:** campos obrigatórios mínimos configuráveis; coleta assistida; alertas “críticos” de negócio além da consistência; governança (consentimento, visibilidade) → **Phase 10**. Import em massa → `profile_json` [**Phase 5**](./PHASE-5.md). [`PHASE-3-PROFILE.md`](./PHASE-3-PROFILE.md), [`CHECKLIST-PROFILE-5.3.md`](./CHECKLIST-PROFILE-5.3.md). |
| **5.4** Commercial funnel | **Partial** | Pipeline exists with **6** stages — see [`enums.py`](../apps/api/src/ai_copilot_api/db/enums.py). Brief: **10** steps + post-sale fields. Missing on `Opportunity`: insurer considered, expected close, loss reason; enforce next-action/loss rules — backlog (can straddle Phase 2 follow-up or Phase 4) |
| **5.5** Interactions, agenda, history | **Done (core)** | [`PHASE-4-INTERACTIONS.md`](./PHASE-4-INTERACTIONS.md): `Interaction` + API, timeline (client/opp), dashboard overdue + today; `last_interaction_at` sync; `next_action_due_at` + overdue filter — push notifications / full calendar later |
| **5.6** Insurer/product/coverage catalog | **Partial** | **Pre–Phase 6:** `Insurer` CRUD, produtos com texto de cobertura, argumentos comerciais, JSONB para coberturas adicionais/materiais — see [`PHASE-PRE6-MODULES-56-59.md`](./PHASE-PRE6-MODULES-56-59.md). **Still:** hierarquia formal de coberturas, anexos binários, governança de catálogo avançada → **Phase 6+** |
| **5.7** Consultative recommendation | **Done (MVP rules + explainability)** | [**Phase 6**](./PHASE-6.md): motor em código com `rule_ids` + `rule_trace`; preview `GET /v1/clients/…/recommendations`; catálogo `GET /v1/recommendation-rules`; UI cliente/oportunidade com campos consultivos e traço de regras. **Still:** IA generativa, matriz DB parametrizável → **Phase 11 / roadmap** |
| **5.8** Adequacy semáforo (green/yellow/red) | **Partial** | **Pre–Phase 6:** `evaluate_adequacy`, API + fila MVP `adequacy-review-queue`. **Still:** scoring em lote, UX por produto/apólice, tarefas automáticas → **Phase 9** (full brief) |
| **5.9** Post-sale, régua, campaigns | **Partial** | **Pre–Phase 6:** campanhas, toques, segmentação JSON, consentimento/canal no cliente — see [`PHASE-PRE6-MODULES-56-59.md`](./PHASE-PRE6-MODULES-56-59.md). **Still:** entrega real (e-mail/WhatsApp), webhooks, jornadas multi-toque → **Stage 2 / Phase 11** or integrations |
| **5.10** Executive dashboards | **Planned** | **Phase 9**; use brief KPIs as acceptance checklist |
| **5.11** Intelligent assistant (copilot) | **Planned** | Roadmap Stage 4; after core CRM + catalog + rules + semáforo mature |

### 2.1 PRODUCT §5.2 — checklist vs this repo

[`PRODUCT.md`](./PRODUCT.md) §5.2 lists **entities** (Lead, Opportunity, Client, Segurado, Empresa) and **seven** functional requirements. Coverage after the **§5.2 pre–Phase 5** slice:

| # | Requirement (brief) | In repo today |
|---|----------------------|---------------|
| — | **Lead** entity | **Yes** — `Lead` + CRUD + status; convert creates `Client` and optional `Opportunity` |
| — | **Segurado** / **Empresa** | **Yes** — **Empresa** = `ClientKind.COMPANY` + legal/tax fields; **Segurado** = `InsuredPerson` under `Client` |
| 1 | Manual lead registration | **Yes** — leads API + web |
| 2 | Bulk spreadsheet import | **Yes** — [`PHASE-5.md`](./PHASE-5.md) |
| 3 | Progressive enrichment | **Partial** — profile JSONB + portfolio + interactions; §5.3 UI still incremental |
| 4 | Convert lead → client or opportunity | **Yes** — `POST /v1/leads/{id}/convert` |
| 5 | Assign responsible broker | **Partial** — `Client.owner_id` + `Lead.owner_id`; org-wide **roles** still §5.1 |
| 6 | Data update history | **Partial** — append-only `crm_audit_events` for client, lead, insured, opportunity (create path); broad LGPD retention still **Phase 10** |
| 7 | Single view with multiple products | **Partial** — client detail: held products + LOB + new CRM/segurados/audit sections |

**Remaining** for full §5.2: optional hardening (roles, richer audit filters, empresa as separate party if product demands it beyond `ClientKind`).

---

## 3. Roadmap crosswalk: strategic phases ↔ engineering phases

| Strategic brief roadmap ([`PRODUCT.md`](./PRODUCT.md) §9) | Engineering plan ([`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md)) |
|----------------------------------------------------------|------------------------------------------------------------------------|
| Phase 1 — Operational MVP (CRM, basic profile, interactions, dashboards) | **Phases 0–4** done (foundation + CRM + portfolio + profile + interactions). **Phase 9** dashboards |
| Phase 2 — Intelligent MVP (enriched profile, catalog, rule recommendations, basic régua) | **Phase 3** enriched profile; **Phase 6** catalog/rules; régua still external or post-MVP |
| Phase 3 — Monetize book (semáforo, upsell queue, contextual campaigns) | **Phase 9** (semáforo/scoring) + **Phase 11 / Stage 2** (campaigns) |
| Phase 4 — AI acceleration (arguments, summaries, copilot, predictive NBA) | **Phase 8** hybrid extraction + **Stage 4** copilot / gen-AI |
| Phase 5 — Scale (assistant, integrations, multi-brokerage) | **Phase 11** + [`IMPLEMENTATION-ROADMAP.md`](./IMPLEMENTATION-ROADMAP.md) Stages 2–3 |

---

## 4. Recommended backlog priorities (product + engineering)

1. **Phase 3 — Enriched profile (§5.3)** — unblocks semáforo and strong rules.
2. **Phase 4 — Interactions (§5.5)** — adoption and “memory” for brokers.
3. ~~**Phase 5 — Import**~~ **Done** — see [`PHASE-5.md`](./PHASE-5.md).
4. ~~**Phase 6 — Rule engine**~~ **Done** — [`PHASE-6.md`](./PHASE-6.md).
5. **Opportunity fields + funnel rules (§5.4)** — insurer, expected close, loss reason; optional stage expansion vs brief’s 10 steps.
6. **Phase 9 — Semáforo** — explicit UX + explanations on scoring output.

---

## 5. Document map

| Document | Role |
|----------|------|
| [`PRODUCT.md`](./PRODUCT.md) | Full stakeholder product brief (Portuguese); strategic scope and MVP modules |
| **`STRATEGIC-PRODUCT-ALIGNMENT.md`** | **This file — living checklist:** stakeholder scope ↔ repo |
| [`MVP-CRM-STRATEGY.md`](./MVP-CRM-STRATEGY.md) | Resolved MVP: internal CRM + file import |
| [`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md) | Phases 0–11 and exit criteria |
| [`IMPLEMENTATION-ROADMAP.md`](./IMPLEMENTATION-ROADMAP.md) | Stages 1–4, CRM ingress, portfolio requirement |

---

## 6. Maintenance

When a phase ships, update **§2** (change **Planned** → **Done** or **Partial** with note). When [`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md) phase numbers change again, update **§2–§4** in the same PR. Prefer linking modules to **phase numbers** in this file rather than duplicating full specs (single source: `IMPLEMENTATION-PLAN`).
