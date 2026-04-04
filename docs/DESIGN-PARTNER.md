# 🧠 PROMPT — First Paying / Design Partner User Definition

You are a **Product Owner + Startup Founder + Senior Engineer** defining the **initial go-to-market strategy** for a sales platform.

Your goal is to define **who the first real user (design partner) is**, and how this decision impacts product scope and architecture.

---

## 🎯 CONTEXT

We are building a **data-driven commercial platform ("sales copilot")** for brokers/agents.

We need to decide the **first target user**, which will directly influence:

- Product scope (MVP vs platform)
- Architecture (single-tenant vs multi-tenant)
- Speed of delivery
- Feedback loop quality

---

## ✅ Resolved decision (MVP)

| Choice | **Option B — Single brokerage (design partner)** |
|--------|-----------------------------------------------------|
| Rationale | Real-world validation with controlled complexity; faster than multi-tenant B2B SaaS from day one. |
| Architecture | One production organization for MVP; still use **`organization_id`** on data rows so a second customer does not require a schema rewrite. |
| Full spec | [`IMPLEMENTATION-SPEC.md`](./IMPLEMENTATION-SPEC.md) |

The sections below remain as the original decision prompt for context and trade-off analysis.

---

## ❓ CORE QUESTION

Who is the **first paying or design-partner user**?

Choose ONE and justify:

### Option A — Internal Team
- A small internal sales team
- Fast iteration
- No external dependencies

### Option B — Single Brokerage (Design Partner)
- One real external brokerage
- Real-world validation
- Controlled complexity

### Option C — B2B SaaS (Multi-client from day 1)
- Multiple customers
- Multi-tenant architecture required
- Slower MVP

---

## 🏗️ YOUR TASK

### 1. Choose ONE option
You MUST pick one and justify clearly

---

### 2. Explain Trade-offs

Analyze:

- Speed vs scalability
- Feedback quality
- Technical complexity
- Risk

---

### 3. Define Product Implications

Based on your choice, define:

- MVP scope
- Required features
- What to explicitly NOT build yet

---

### 4. Define Architecture Implications

Explain:

- Single-tenant vs multi-tenant
- Data isolation strategy
- Deployment model

---

### 5. Define Evolution Path

Explain how we move from:

- MVP → next stage → scalable platform

---

## ⚠️ LANGUAGE REQUIREMENT

- All code and technical terms in English
- Explanations can be structured and clear

---

## 🚀 FINAL INSTRUCTION

Think like:

- A startup → optimize for speed and learning
- A product owner → maximize real feedback
- An engineer → avoid premature complexity

Make a decision that increases the probability of product success.