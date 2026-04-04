# 🧠 PROMPT — MVP CRM Strategy (Build vs Integrate vs Import)

> **Canonical English implementation docs:** [`IMPLEMENTATION-SPEC.md`](./IMPLEMENTATION-SPEC.md) (§3 CRM + portfolio), [`IMPLEMENTATION-ROADMAP.md`](./IMPLEMENTATION-ROADMAP.md) (MVP → final product). **Code and API identifiers:** English.

You are a **Product Owner + Senior Engineer + Startup Builder** defining the **CRM strategy for the MVP** of a sales platform.

---

## 🎯 CONTEXT

We are building a **sales copilot platform** where:

- Opportunities are the core entity
- Recommendations depend on client + interaction data
- Speed of delivery is critical

We must decide how to handle CRM data in the MVP.

---

## ✅ Resolved decision (MVP)

| Choice | **Option A + Option C (combined)** |
|--------|-------------------------------------|
| **A — Internal minimal CRM** | **Source of truth** for clients, opportunities, pipeline, owners, **lines of business**, and **held products** (see `IMPLEMENTATION-SPEC.md` §3.2). |
| **C — File import** | Bootstrap and bulk **client** updates via **CSV and Excel** (preview, validation, audit); optional columns for LOB / held products. Not a substitute for CRM screens. |
| **Not in MVP** | **B — External CRM API integration** (pick one vendor, OAuth, sync). Defer until after design-partner validation. |
| Data ownership | Application database is canonical; CSV imports are **ingest paths** with idempotent upsert: **`external_id` first, else normalized `email`** (see `IMPLEMENTATION-SPEC.md` §3). |
| Full spec | [`IMPLEMENTATION-SPEC.md`](./IMPLEMENTATION-SPEC.md) |

The sections below remain as the original prompt for trade-offs and future evolution (e.g. multi-CRM).

---

## ❓ DECISION OPTIONS (reference)

### Option A — Build Minimal Internal CRM
- Basic client + opportunity management inside our system

### Option B — Integrate External CRM
- Choose ONE CRM; sync data via API

### Option C — CSV / Import Only (Read-only CRM)
- Import clients and data via CSV
- No full CRM features *(when used alone; with A, CSV complements the built-in CRM)*

---

## 🏗️ YOUR TASK

### 1. Choose ONE option
You MUST pick one and justify clearly *(superseded by resolved decision above for MVP build)*

---

### 2. Trade-off Analysis

Compare:

- Speed to market
- Complexity
- Data quality
- User experience
- Dependency on third parties

---

### 3. MVP Scope Definition

Based on your choice, define:

- What CRM features are included
- What is explicitly OUT of scope

---

### 4. Data Model Impact

Explain:

- How Client and Opportunity entities are affected
- Data ownership (source of truth)

---

### 5. Future Evolution

Explain how this evolves into:

- Full CRM OR
- Multi-CRM integrations

---

## ⚠️ LANGUAGE REQUIREMENT

- All code, models, and technical terms must be in **English**
- Keep explanations clear and structured

---

## 🚀 FINAL INSTRUCTION

Think like:

- A startup → optimize for speed
- A product owner → maximize learning
- An engineer → avoid unnecessary complexity

Make a decision that enables shipping fast WITHOUT blocking future scale.