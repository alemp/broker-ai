# Phase 0 — locked stack and layout

This document records **concrete choices** for [Phase 0 — Project skeleton and environments](./IMPLEMENTATION-PLAN.md#phase-0--project-skeleton-and-environments). It should stay in sync with the repo; update it when the stack changes.

## Decisions (confirmed)

| Topic | Choice |
|--------|--------|
| Monorepo | **pnpm** workspaces under `apps/*` |
| Web app | **Vite** + **React** + **TypeScript** |
| UI | **shadcn/ui** (Radix Nova preset) + **Tailwind CSS v4** |
| i18n | **react-i18next**; default locale **pt**; namespace **`common`**; message keys in English, Portuguese copy in JSON |
| API | **Python 3.12+**, **FastAPI**, package **`ai-copilot-api`** under `apps/api/src/ai_copilot_api` |
| Python tooling | **uv** (sync, run, lockfile) |
| Database | **PostgreSQL 16** via **Docker Compose** (development) |
| Migrations | **Alembic** (SQLAlchemy); `DATABASE_URL` via environment |
| Object storage | **Abstraction** with **`local`** (default) and **`s3`** backends; local root **gitignored** (see root `.gitignore`) |
| CI | **GitHub Actions** — API: `uv sync`, `ruff check`, `pytest`; Web: `pnpm install`, `lint`, `build` |

## Repository layout

```text
apps/
  api/          # FastAPI service (uv, Alembic, tests)
  web/          # Vite React app (shadcn, i18n)
docs/           # Product and engineering documentation
docker-compose.yml
pnpm-workspace.yaml
.env.example
```

## Related specifications

- Canonical MVP rules: [`IMPLEMENTATION-SPEC.md`](./IMPLEMENTATION-SPEC.md)
- Phased delivery: [`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md)

## Operational runbook

See [`DEVELOPMENT.md`](./DEVELOPMENT.md).
