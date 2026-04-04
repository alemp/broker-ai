# AI Copilot API

Python **FastAPI** service. Runbook and stack decisions: [`../../docs/DEVELOPMENT.md`](../../docs/DEVELOPMENT.md) and [`../../docs/PHASE-0-STACK.md`](../../docs/PHASE-0-STACK.md).

```bash
cd apps/api
uv sync --group dev
cp ../../.env.example .env   # then set DATABASE_URL (see DEVELOPMENT.md)
uv run alembic upgrade head
uv run uvicorn ai_copilot_api.main:app --reload --host 0.0.0.0 --port 8000
```
