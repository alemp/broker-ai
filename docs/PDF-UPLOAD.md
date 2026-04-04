# 🧠 PROMPT — PDF Upload (Constraints, Security, and Scalability)

You are a **Senior Backend Engineer + Cloud Architect** designing a **PDF upload system** for an MVP sales platform.

---

## 🎯 CONTEXT

The platform allows users (brokers/agents) to upload PDF files such as:

- Client documents
- Contracts
- Proposals
- Reports

We need a **secure, scalable, and simple MVP solution**.

---

## ✅ Resolved constraints (MVP)

| Topic | Decision |
|-------|----------|
| Max file size | **100 MB** |
| Allowed types | **PDF only** (no other extensions in MVP) |
| Validation | File extension, declared MIME type, and **magic bytes** (`%PDF`) |
| Storage (production) | **Amazon S3** (SSE optional: SSE-S3 or SSE-KMS) |
| Storage (development) | **Local** S3-compatible or filesystem-backed adapter; **not committed** to the repo (gitignored paths). Same API shape as prod where possible. |
| Keys | Include **`organization_id`** and **`document_id`** (and version if needed) in object key prefix |
| Metadata | PostgreSQL row: owner, org, size, checksum, status, created_at, etc. |
| Upload flow | **Presigned URL** direct to S3 in prod (or dev equivalent); use **multipart upload** for large files approaching 100 MB |
| Status tracking | e.g. `uploading` → `processing` → `processed` / `failed` |
| Max uploads per user per day | **100** per calendar day (default; configurable) |
| Virus/malware | **Out of MVP**; optional hook before `processed` in a later phase — see `IMPLEMENTATION-SPEC.md` |
| Access | Download via **short-lived presigned GET**; authorize same **organization** as uploader |

**Full spec:** [`IMPLEMENTATION-SPEC.md`](./IMPLEMENTATION-SPEC.md)

---

## 🏗️ YOUR TASK

Define *(MVP values above are locked; elaborate in implementation and runbooks)*:

### 1. File Constraints
- Max file size (MB) → **100**
- Allowed file types → **PDF only**
- Max uploads per user per day → **100** (default; configurable)

---

### 2. Security Design

You MUST include:

- Virus/malware scanning strategy → **None in MVP**; design optional hook for later phases
- File validation (MIME type + extension + magic bytes)
- Storage isolation strategy → **per-organization S3 prefix**
- Access control (who can download/view) → **org members; presigned URLs**

---

### 3. Storage Strategy

Define:

- Where files are stored → **AWS S3**
- Naming convention → **org-scoped keys + document id**
- Metadata storage (DB) → **PostgreSQL**

---

### 4. Upload Flow

Design the flow:

- Direct upload vs backend proxy → **Direct to S3 via presigned PUT**
- Pre-signed URLs (if applicable) → **Yes**
- Status tracking (uploading, processed, failed) → **Yes**

---

### 5. Expected Volume (MVP Assumptions)

Estimate *(adjust with design partner)*:

- Files per user per day → **low tens** (assumption until telemetry)
- Average file size → **typically under 5 MB**; allow up to **100 MB**
- Total storage growth → **S3 lifecycle + monitoring**

---

### 6. Future-Proofing

Explain how this evolves to:

- Higher scale
- Document processing (OCR, parsing) → see [`EXTRACTION.md`](./EXTRACTION.md)
- Compliance requirements → LGPD retention, audit logs (`IMPLEMENTATION-SPEC.md`)

---

## ⚠️ LANGUAGE REQUIREMENT

- All code, variables, and technical definitions MUST be in English

---

## 🚀 FINAL INSTRUCTION

Design a system that is:

- Secure by default
- Cheap at MVP stage
- Scalable later
- Simple to implement now