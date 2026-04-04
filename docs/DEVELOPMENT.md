# Local development

Phase 0 runbook for the **ai-copilot** monorepo. Stack details: [`PHASE-0-STACK.md`](./PHASE-0-STACK.md).

## Prerequisites

- **Node.js** 20+
- **pnpm** 10+ (root `packageManager` field pins a version)
- **Docker** (for PostgreSQL via Compose)
- **uv** ([install](https://docs.astral.sh/uv/getting-started/installation/))
- **Python** 3.12+

## 1. PostgreSQL (Docker Compose)

From the repository root:

```bash
docker compose up -d postgres
```

Default connection (matches `apps/api` defaults unless overridden):

- Host: `localhost`
- Port: `5432`
- User / password / database: `ai_copilot` / `ai_copilot_dev` / `ai_copilot`

Copy [`.env.example`](../.env.example) to `.env` at the root if you want to customize Compose variables.

## 2. API (`apps/api`)

Python **3.12** is pinned via [`apps/api/.python-version`](../apps/api/.python-version) for `uv` (install: [Astral `uv`](https://docs.astral.sh/uv/getting-started/installation/)).

```bash
cd apps/api
uv sync --group dev
```

Optional: create `apps/api/.env` to override defaults (see [`.env.example`](../.env.example)). At minimum, ensure `DATABASE_URL` matches your Postgres instance, for example:

```env
DATABASE_URL=postgresql+psycopg://ai_copilot:ai_copilot_dev@localhost:5432/ai_copilot
APP_ENV=development
STORAGE_BACKEND=local
LOCAL_STORAGE_PATH=.local-storage/objects
```

Run migrations:

```bash
export DATABASE_URL=postgresql+psycopg://ai_copilot:ai_copilot_dev@localhost:5432/ai_copilot
uv run alembic upgrade head
```

Start the server:

```bash
uv run uvicorn ai_copilot_api.main:app --reload --host 0.0.0.0 --port 8000
```

- OpenAPI: `http://localhost:8000/docs`
- Health: `http://localhost:8000/health`

### API tests and lint

```bash
cd apps/api
uv run ruff check src tests
uv run pytest
```

## 3. Web (`apps/web`)

From the repository root:

```bash
pnpm install
pnpm dev:web
```

Or from `apps/web`: `pnpm dev`.

The app expects the API at **`http://localhost:8000`** by default. To override, set in `apps/web/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

### Web lint and build

```bash
pnpm lint:web
pnpm build:web
```

## 4. Phase 0 exit checks

- API and web start locally.
- `alembic upgrade head` succeeds against Docker Postgres.
- Local storage writes under `.local-storage/` (gitignored) — verified in API tests; do not commit blobs.

## 5. CI

On push and pull request, [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs API and web checks. Ensure secrets are **not** committed; use `.env` locally only.
