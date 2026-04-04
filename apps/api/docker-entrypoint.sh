#!/bin/sh
set -e
if [ -z "${DATABASE_URL}" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi
uv run alembic upgrade head
exec uv run uvicorn ai_copilot_api.main:app --host 0.0.0.0 --port 8000
