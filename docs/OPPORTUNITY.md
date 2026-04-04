# 🧠 PROMPT — Opportunity Domain Definition (Sales Platform)

You are a **Senior Software Engineer and Domain-Driven Design (DDD) expert** working on a **data-driven commercial platform (AI-assisted sales system)**.

Your task is to **define, model, and implement the "Opportunity" domain entity**, which is a **core concept of the sales pipeline**.

---

## 🎯 BUSINESS CONTEXT

The platform acts as a **"sales copilot"** for brokers/agents, helping them:

- Track deals
- Prioritize leads
- Increase conversion rates
- Use data and AI to guide decisions

In this system, the **Opportunity is the central unit of revenue generation and analysis**.

---

## ✅ Resolved context (MVP)

| Topic | Decision |
|-------|----------|
| Tenant | **Single design-partner brokerage** in production for MVP; model **`organization_id`** on **Client**, **Opportunity**, and related aggregates anyway. |
| Pipeline / attributes | As specified in this document (stages, status, `next_action`, probabilities, etc.). |
| Scoring / dashboard | **Batch or near–real-time** jobs refresh flags and “high potential” style insights. |
| Full spec | [`IMPLEMENTATION-SPEC.md`](./IMPLEMENTATION-SPEC.md) |

---

## 🧩 DOMAIN DEFINITION

An **Opportunity** is:

> A potential business deal associated with a client, with a measurable probability of closing, that progresses through defined stages of a sales pipeline.

---

## ⚠️ LANGUAGE REQUIREMENT (STRICT)

- ✅ ALL code MUST be written in **English**
- ✅ Variable names, classes, functions, enums, database fields = **English only**
- ❌ Do NOT use Portuguese in code
- ✅ Comments and documentation = English

---

## 🏗️ YOUR TASK

Design and implement:

### 1. Domain Model
- Define the Opportunity entity
- Include all relevant attributes
- Use clean and scalable design (DDD if possible)

### 2. Data Structure
- Provide a database schema (SQL or NoSQL)
- Consider scalability and future AI usage

### 3. Enums and Types
Define:
- OpportunityStage
- OpportunityStatus

### 4. Business Rules
Implement rules such as:
- An opportunity must have an owner (agent/broker)
- It must be linked to a client
- It must always have a stage
- It can evolve over time
- It can be won or lost

### 5. Relationships
Model relationships with:
- Client
- User (agent/broker)
- Product (optional: one or many)

### 6. Optional (Bonus)
- Event model (event-driven architecture)
- Example events:
  - OpportunityCreated
  - OpportunityStageChanged
  - OpportunityWon
  - OpportunityLost

---

## 🔑 REQUIRED ATTRIBUTES

Your model MUST include at least:

- id
- organization_id *(MVP: one org; required for forward-compatible multi-org)*
- client_id
- owner_id
- product_id (or list)
- estimated_value
- closing_probability (0–100)
- stage
- status (open, won, lost)
- source (lead origin)
- created_at
- updated_at
- last_interaction_at
- next_action

---

## 🔄 PIPELINE STAGES (REFERENCE)

Use something like:

- LEAD
- QUALIFIED
- PROPOSAL_SENT
- NEGOTIATION
- CLOSED_WON
- CLOSED_LOST

---

## 🧪 EXPECTED OUTPUT

Provide:

1. Entity/model code
2. Database schema
3. Enums/types
4. Example object (JSON)
5. (Optional) Event definitions

---

## 🧠 ENGINEERING PRINCIPLES

- Keep it simple (MVP-ready, avoid overengineering)
- Design for future scalability
- Make it AI-ready (data completeness matters)
- Use clean code practices
- Prefer explicit over implicit

---

## 🚀 FINAL INSTRUCTION

Think like:
- A product owner → focus on business value
- An engineer → focus on scalability and clarity
- A startup → focus on speed and simplicity

Build a clean, extensible, production-ready foundation for the Opportunity domain.