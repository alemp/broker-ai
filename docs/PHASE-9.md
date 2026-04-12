# Phase 9 — Batch scoring and dashboard (adequacy semáforo)

**Status:** implemented in-repo.

## Goal

Persist **adequacy traffic light** (PRODUCT.md §5.8) from scheduled or manual **batch** runs, with **input fingerprinting**, **job audit**, **dashboard aggregates**, and **list/filter** on clients — without requiring real-time recomputation on every read.

## Backend

- **Tables** (Alembic `phase9_adequacy_015`): `client_adequacy_snapshots` (one row per client, upsert), `batch_job_runs` (per-org job audit).
- **Rule version** constant: `phase9-v1` in `domain/adequacy_batch.py` (bump when adequacy logic changes materially).
- **Fingerprint**: SHA-256 of canonical JSON over `profile_data`, LOB links, held products, `client_kind`.
- **Domain**: `refresh_adequacy_for_organization`, `refresh_all_organizations_adequacy`, `effective_adequacy_assessment`, `resolve_adequacy_for_api`, `traffic_light_for_segmentation`.
- **API**
  - `POST /v1/jobs/adequacy-refresh` — run batch for current org.
  - `GET /v1/jobs/adequacy-refresh/last` — last finished job (SUCCESS/FAILED).
  - `GET /v1/dashboard/adequacy-summary` — counts by light, clients without snapshot, last job.
  - `GET /v1/clients?adequacy_traffic_light=GREEN|YELLOW|RED` — filter by last snapshot.
  - `GET /v1/clients/{id}/adequacy?source=batch_first|live` — default `batch_first` uses snapshot when present.
- **Campaign segmentation** uses batch snapshot when present (`traffic_light_for_segmentation`).
- **Scheduler**: optional `ADEQUACY_REFRESH_INTERVAL_MINUTES` (>0 enables APScheduler interval for all orgs).

## Web

- **Início**: adequacy summary card, last job line, button to trigger `POST …/adequacy-refresh`.
- **Clientes**: semáforo column; filter by stored light.
- **Cliente → Intel**: line indicating batch vs live source and batch timestamp when applicable.

## Exit criteria (plan)

- Scores refresh on schedule (when env > 0) or on demand; UI shows last job time; semáforo counts on dashboard; stored flags on client list.
