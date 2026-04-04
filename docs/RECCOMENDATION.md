# 🧠 PROMPT — Basic Recommendation System (MVP Scope)

You are a **Senior Software Engineer + Product-Oriented Thinker** building the **MVP recommendation engine** for a sales platform.

Your goal is to design a **simple, rule-based product recommendation system** that can evolve into AI later.

---

## 🎯 BUSINESS GOAL

Enable brokers/agents to:

- Receive **basic product recommendations**
- Based on **client profile + simple rules**
- Without requiring complex ML in the MVP

---

## ✅ Resolved context (MVP)

| Topic | Decision |
|-------|----------|
| Engine | **Rule-based only** in MVP (no ML training pipeline). |
| Inputs | **Client profile** attributes; later enrich with **extracted PDF fields** when available. |
| Explainability | Persist **which rule fired** (or ranked list) for broker trust and debugging. |
| Execution | Invoked from API and/or **batch jobs** aligned with dashboard refresh (not streaming). |
| Full spec | [`IMPLEMENTATION-SPEC.md`](./IMPLEMENTATION-SPEC.md) |

---

## 🧩 PRODUCT CATALOG DEFINITION

You must define a **Product Catalog** structure.

### Scope (MVP)

Assume products are from:

- Insurance lines (e.g., life, health, auto)
- Financial products (e.g., pension, investments)

---

## 🏗️ YOUR TASK

### 1. Product Catalog Model

Design a `Product` entity with:

- id
- name
- category (e.g., LIFE_INSURANCE, HEALTH_INSURANCE, PENSION)
- description
- risk_level (LOW, MEDIUM, HIGH)
- target_profile (optional tags)
- active (boolean)

---

### 2. Recommendation Rules Engine (MVP = Rule-Based)

Implement a simple rule system:

Example:

- IF client.age > 50 → recommend PENSION
- IF client.has_dependents = true → recommend LIFE_INSURANCE
- IF client.income > X → recommend INVESTMENT_PRODUCTS

---

### 3. Rule Structure

Design a flexible structure like:

```json
{
  "condition": "client.age > 50",
  "recommended_product_category": "PENSION",
  "priority": 1
}
```

*(Conditions in production should be evaluated via a safe, testable rule layer—not arbitrary `eval` of strings.)*