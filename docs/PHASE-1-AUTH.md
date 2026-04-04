# Phase 1 — Identity, organization, and Docker Compose runtime

This document records **Phase 1** delivery: authentication, single default organization, JWT access tokens, and running **API + web + Postgres** via **Docker Compose**.

## Authentication model

| Topic | Decision |
|--------|-----------|
| Password storage | **Argon2id** via `argon2-cffi` (`PasswordHasher`) |
| Transport | **HTTPS** in production; local Docker uses HTTP on published ports |
| Token format | **JWT** (HS256), carried as **`Authorization: Bearer`** |
| Claims | `sub` (user id), `org_id` (organization id), `email`, `iat`, `exp` |
| Secret | `JWT_SECRET` (required in any shared/staging/prod environment) |
| Expiry | `JWT_EXPIRE_HOURS` (default **24**); **no refresh token** in Phase 1 |
| Multi-org UX | **Single default org** for the design partner: new users register into org with slug `DEFAULT_ORGANIZATION_SLUG` (default **`default`**) |

**Rationale:** Stateless JWT keeps the API simple for Phase 1. Refresh tokens and multi-tenant self-serve onboarding are deferred to later phases (`IMPLEMENTATION-ROADMAP.md`).

## API routes (versioned)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/v1/auth/register` | No | Create user in default org |
| POST | `/v1/auth/login` | No | Issue access token |
| GET | `/v1/me` | Bearer | Current user + organization |
| GET | `/health` | No | Liveness |

## Database

- Tables: `organizations`, `users` (see Alembic revision `phase1_002`).
- Seed: one row `('Design partner brokerage', 'default')` inserted in the migration.

## Docker Compose

From the repository root:

```bash
docker compose up --build
```

- **API:** `http://localhost:8000` (configurable with `API_PORT`)
- **Web (nginx + static build):** `http://localhost:8080` (configurable with `WEB_PORT`)
- **Postgres:** `localhost:5432` (optional host access)

The browser must call the API on a URL it can reach. The web image is built with `VITE_API_BASE_URL` (default **`http://localhost:8000`**). Override with env when running Compose if you publish the API on another host/port.

## Related docs

- Runbook: [`DEVELOPMENT.md`](./DEVELOPMENT.md)
- Stack snapshot: [`PHASE-0-STACK.md`](./PHASE-0-STACK.md)
- Plan: [`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md) — Phase 1
