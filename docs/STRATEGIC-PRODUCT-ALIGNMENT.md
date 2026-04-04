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

---

## 2. Functional modules: strategic scope vs implementation

Legend: **Done** = shipped in repo through the phase noted (e.g. [`PHASE-2-CRM.md`](./PHASE-2-CRM.md), [`PHASE-3-PROFILE.md`](./PHASE-3-PROFILE.md)). **Planned** = scheduled in [`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md) with phase number. **Partial** = some entities/APIs exist today; full brief not met until the listed phase.

| Strategic module (brief §5) | In-repo status | Phase / notes |
|------------------------------|----------------|---------------|
| **5.1** Users, roles, permissions, org structure | **Partial** | JWT auth, org scope, users ([`PHASE-1-AUTH.md`](./PHASE-1-AUTH.md)). Missing: broker/manager/admin **roles**, regional/team/supervisor, password recovery, module permissions, **audit log** — extend over time; LGPD audit Phase 10 |
| **5.2** Leads, clients, opportunities, import | **Partial** | `Client` + `Opportunity` + owner; no separate **Lead** entity. **Bulk import** → **Phase 5** |
| **5.3** Enriched insurance profile (blocks A–H) | **Done (core)** | [`PHASE-3-PROFILE.md`](./PHASE-3-PROFILE.md): JSONB `profile_data`, Pydantic blocks, merge `PATCH`, score + alerts, detail UI subset; bulk import mapping **Phase 5**; consent enforcement **Phase 10** |
| **5.4** Commercial funnel | **Partial** | Pipeline exists with **6** stages — see [`enums.py`](../apps/api/src/ai_copilot_api/db/enums.py). Brief: **10** steps + post-sale fields. Missing on `Opportunity`: insurer considered, expected close, loss reason; enforce next-action/loss rules — backlog (can straddle Phase 2 follow-up or Phase 4) |
| **5.5** Interactions, agenda, history | **Done (core)** | [`PHASE-4-INTERACTIONS.md`](./PHASE-4-INTERACTIONS.md): `Interaction` + API, timeline (client/opp), dashboard overdue + today; `last_interaction_at` sync; `next_action_due_at` + overdue filter — push notifications / full calendar later |
| **5.6** Insurer/product/coverage catalog | **Partial** | `Product`, `LineOfBusiness`, `ClientHeldProduct` (`insurer_name` on held rows). Missing: partner **Insurer** master, **coverage** hierarchy, commercial **arguments**, attachments — enrich through **Phase 6** and catalog epics |
| **5.7** Consultative recommendation | **Planned** | **Phase 6** — rule engine + explainability + UI; add accept/ignore/history in same phase or follow-on |
| **5.8** Adequacy semáforo (green/yellow/red) | **Planned** | **Phase 9** — batch scoring + explicit adequacy UX + explanation |
| **5.9** Post-sale, régua, campaigns | **Planned** | Out of numbered MVP phases; **Phase 11 / Stage 2** or external tools (HubSpot/RD/WhatsApp) |
| **5.10** Executive dashboards | **Planned** | **Phase 9**; use brief KPIs as acceptance checklist |
| **5.11** Intelligent assistant (copilot) | **Planned** | Roadmap Stage 4; after core CRM + catalog + rules + semáforo mature |

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
3. **Phase 5 — Import** — scale data entry and LOB/held rows (+ optional profile columns).
4. **Phase 6 — Rule engine** — explainable recommendations per spec.
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
