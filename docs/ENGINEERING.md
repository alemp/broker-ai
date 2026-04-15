# Engineering guide (monorepo)

This document consolidates the **engineering runbook** for `ai-copilot`:

- Local development (Docker Compose first)
- CI checks
- Test deployment (Neon + Render)
- Web UX/UI guidelines (shadcn + Tailwind)
- Language policy (pt-BR for UI copy; English for code)

It intentionally replaces older phase/status documents and prompt-style docs.

---

## Stack (MVP, locked unless intentionally changed)

- **Monorepo**: `pnpm` workspaces
- **API**: Python 3.12+, FastAPI, Alembic, uv
- **Web**: Vite + React + TypeScript + shadcn/ui + Tailwind CSS v4
- **DB**: PostgreSQL 16 (Docker Compose in dev)
- **Object storage**: abstraction with `local` (dev default) + `s3` (prod)
- **Auth**: email + password (JWT access token)

Repository layout:

```text
apps/
  api/          # FastAPI service (uv, Alembic, tests)
  web/          # Vite React app (shadcn, i18n-ready)
docs/           # Product and engineering documentation
docker-compose.yml
pnpm-workspace.yaml
.env.example
```

---

## Language policy

- **UI copy**: **pt-BR only** for now (through i18n).
- **Code**: **English only** for identifiers, API schemas, enums, and technical messages.
- When adding Portuguese text anywhere in the repo, use **Brazilian Portuguese** (avoid PT-PT variants).

---

## Local development (recommended): full stack via Docker Compose

From the repository root:

```bash
docker compose up --build
```

Endpoints:

- **Web**: `http://localhost:8080`
- **API**: `http://localhost:8000` (OpenAPI at `/docs`)
- **Postgres**: `localhost:5432` (optional host access)

Notes:

- The API container runs `alembic upgrade head` on start, then serves Uvicorn.
- The web bundle is built with `VITE_API_BASE_URL` so the browser can reach the API.

---

## Local development (optional): API/web on host, Postgres in Docker

### 1) Start Postgres only

```bash
docker compose up -d postgres
```

### 2) API (apps/api)

Python version: see `apps/api/.python-version`.

```bash
cd apps/api
uv sync --group dev
```

Example `apps/api/.env`:

```env
DATABASE_URL=postgresql+psycopg://ai_copilot:ai_copilot_dev@localhost:5432/ai_copilot
APP_ENV=development
JWT_SECRET=local-dev-only
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080
STORAGE_BACKEND=local
LOCAL_STORAGE_PATH=.local-storage/objects
```

Run migrations + dev server:

```bash
uv run alembic upgrade head
uv run uvicorn ai_copilot_api.main:app --reload --host 0.0.0.0 --port 8000
```

### 3) Web (apps/web)

```bash
pnpm install
pnpm dev:web
```

Example `apps/web/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

---

## Verification commands (local / CI parity)

API:

```bash
cd apps/api
uv run ruff check src tests
uv run pytest
```

Web:

```bash
pnpm lint:web
pnpm build:web
```

---

## CI

GitHub Actions runs:

- API: `uv sync`, `ruff check`, `pytest` (with Postgres), migrations
- Web: `pnpm install`, lint, build

Do not commit secrets. Use `.env` locally only.

---

## Test deployment (Neon + Render)

This is a **test** environment only (not production hardening).

Architecture:

- **Postgres**: Neon
- **API**: Render Web Service (python runtime, `apps/api`)
- **Web**: Render Static Site

Blueprint: `render.yaml` at repo root.

Required env (high level):

- API: `DATABASE_URL`, `CORS_ORIGINS`, `JWT_SECRET`, `STORAGE_BACKEND` (often `local` on Render for tests)
- Web (build-time): `VITE_API_BASE_URL` (requires rebuild on change)

The API start command applies migrations on boot (`alembic upgrade head`).

---

## Web UX/UI guide (baseline)

### Audience and goals

Primary users are brokerage staff working on: clients, leads, opportunities, insurers, campaigns. Goals:

- Scan and act fast (overdue actions, today’s interactions, filters)
- Trust the system (clear loading/errors without jargon)
- Usable on mobile (navigation + lists)

### Design principles

1. Progressive disclosure (summary → drill-down)
2. Consistent layout rhythm across pages
3. Accessibility by default (keyboard, focus, one `<main>`, skip link)
4. Use Tailwind + shadcn tokens; avoid one-off “magic numbers”
5. UI in pt-BR; code/routes in English

### Layout rules (defaults)

- Prefer `max-w-6xl` for data-heavy pages
- Use `px-4` for horizontal padding
- Use `space-y-8` between major sections; `gap-4`/`gap-6` inside cards

### Feedback states

- Loading: use skeletons where it helps
- Empty: explain what’s empty + one CTA when useful
- Error: one-line message + retry where applicable; field-level form errors

### Accessibility checklist

- Focus styles on all interactive controls
- Icon-only buttons have `aria-label`
- Skip link is first focusable element; targets `#main-content`

