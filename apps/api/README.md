# AI Copilot API

Python **FastAPI** service. Runbook: [`../../docs/DEVELOPMENT.md`](../../docs/DEVELOPMENT.md). Test hosting (Neon + Render): [`../../docs/DEPLOY-TEST.md`](../../docs/DEPLOY-TEST.md). Auth (Phase 1): [`../../docs/PHASE-1-AUTH.md`](../../docs/PHASE-1-AUTH.md).

**Docker (recommended):** from repo root, `docker compose up --build` (API on port **8000** by default).

**Local uv:**

```bash
cd apps/api
uv sync --group dev
# set DATABASE_URL, JWT_SECRET, CORS_ORIGINS (see ../../.env.example and DEVELOPMENT.md)
uv run alembic upgrade head
uv run uvicorn ai_copilot_api.main:app --reload --host 0.0.0.0 --port 8000
```
