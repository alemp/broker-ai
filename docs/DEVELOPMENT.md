# Local development

Monorepo runbook for **ai-copilot**. Stack overview: [`PHASE-0-STACK.md`](./PHASE-0-STACK.md). Phase 1 auth and Compose: [`PHASE-1-AUTH.md`](./PHASE-1-AUTH.md). Phase 2 CRM and portfolio: [`PHASE-2-CRM.md`](./PHASE-2-CRM.md).

**Portuguese copy:** product-facing text in this repo uses **Brazilian Portuguese (pt-BR)** only for now; more locales will follow with i18n. See [`LANGUAGE.md`](./LANGUAGE.md).

## Recommended: full stack in Docker Compose

From the repository root (requires **Docker**):

```bash
docker compose up --build
```

- **Web (static build + nginx):** [http://localhost:8080](http://localhost:8080) — register, login, dashboard, clients, opportunities (`WEB_PORT`).
- **API:** [http://localhost:8000](http://localhost:8000) — OpenAPI at `/docs` (`API_PORT`).
- **Postgres:** `localhost:5432` (`POSTGRES_PORT`) if you need host access.

The API container runs **`alembic upgrade head`** on start, then **uvicorn**. Set a strong **`JWT_SECRET`** in production (see [`.env.example`](../.env.example)).

The web bundle is built with **`VITE_API_BASE_URL`** (default `http://localhost:8000`) so the **browser** can reach the API from your machine. If you change published API ports or use another hostname, set `VITE_API_BASE_URL` before `docker compose build`.

## Optional: hybrid local tooling (API / web on host, Postgres in Docker)

### 1. PostgreSQL only

```bash
docker compose up -d postgres
```

Defaults: user / password / database `ai_copilot` / `ai_copilot_dev` / `ai_copilot`.

### 2. API (`apps/api`)

Python **3.12** — [`apps/api/.python-version`](../apps/api/.python-version). Install **uv**: [Astral docs](https://docs.astral.sh/uv/getting-started/installation/).

```bash
cd apps/api
uv sync --group dev
```

Example `apps/api/.env` or shell exports:

```env
DATABASE_URL=postgresql+psycopg://ai_copilot:ai_copilot_dev@localhost:5432/ai_copilot
APP_ENV=development
JWT_SECRET=local-dev-only
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080
STORAGE_BACKEND=local
LOCAL_STORAGE_PATH=.local-storage/objects
```

```bash
uv run alembic upgrade head
uv run uvicorn ai_copilot_api.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Web (`apps/web`) — Vite dev server

```bash
pnpm install
pnpm dev:web
```

`apps/web/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

### API tests and lint

```bash
cd apps/api
uv run ruff check src tests
uv run pytest
```

Integration tests in `tests/test_auth.py` run when **`DATABASE_URL`** is set (e.g. CI or local Postgres after `alembic upgrade head`). Other tests do not require a database.

### Web lint and build

```bash
pnpm lint:web
pnpm build:web
```

For **`pnpm build:web`**, set `VITE_API_BASE_URL` in the environment if the default is wrong (CI sets it to `http://localhost:8000`).

## CI

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs API checks (with Postgres) and web lint/build. Do not commit secrets; use `.env` locally only.

## Test deployment (Neon + Render)

For a hosted **test** stack (Postgres on Neon, API and static web on Render), see [`DEPLOY-TEST.md`](./DEPLOY-TEST.md) and the root [`render.yaml`](../render.yaml). Local Docker Compose remains the default for development.
