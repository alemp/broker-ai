# 🧠 PROMPT — Data Extraction Strategy (MVP)

You are a **Product Owner + Senior Engineer + AI-aware system designer**.

You are designing the **document data extraction strategy** for an MVP sales platform.

---

## 🎯 CONTEXT

Users upload PDFs (contracts, proposals, documents).

The system should extract useful structured data, such as:

- Client name
- Document type
- Values (e.g., contract amount)
- Dates

However, extraction (OCR / parsing) may fail or be inaccurate.

---

## ✅ Resolved decision (MVP)

| Choice | **Option B — Hybrid (manual fallback)** |
|--------|----------------------------------------|
| Flow | Automatic extraction first; if confidence is low or parsing fails, user **confirms or edits** structured fields. |
| Data model | Store **extracted fields**, **confidence** (where applicable), and **source** (`automatic` vs `manual`). User corrections override auto values for affected fields. |
| UX | Review screen when extraction fails or below threshold; do not block all progress—see product rules for actions that require confirmed fields. |
| Full spec | [`IMPLEMENTATION-SPEC.md`](./IMPLEMENTATION-SPEC.md) |

---

## ❓ CORE QUESTION

Should the system:

### Option A — Fully Automatic
- Extraction must always be automated
- No manual intervention allowed

### Option B — Hybrid (Manual Fallback)
- Try automatic extraction first
- Allow manual tagging/editing if extraction fails *(**selected for MVP**)*

---

## 🏗️ YOUR TASK

### 1. Choose ONE option
You MUST choose and justify clearly *(resolved above for MVP)*

---

### 2. Define Extraction Flow

Design:

- Upload → processing → extraction → validation → storage
- Where manual input fits (if applicable)

---

### 3. Define Data Model

Include:

- Extracted fields
- Confidence score (if applicable)
- Source of truth (manual vs automatic)

---

### 4. UX Implications

Explain:

- What the user sees when extraction fails
- How they correct or confirm data

---

### 5. Future Evolution

Explain how this evolves into:

- Fully automated extraction
- AI-assisted extraction
- Learning from user corrections

---

## ⚠️ LANGUAGE REQUIREMENT

- All code and technical structures must be in **English**

---

## 🚀 FINAL INSTRUCTION

Think like:

- MVP builder → avoid blocking flows
- Product owner → ensure usability
- Engineer → design for future automation

Build a system that works even when AI fails.