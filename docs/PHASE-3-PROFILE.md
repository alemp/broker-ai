# Phase 3 — Perfil enriquecido do cliente (§5.3)

## Estado

Implementado no API e no detalhe web: armazenamento JSONB (`clients.profile_data`), modelo Pydantic por blocos (A–H), merge parcial, `completeness_score`, `profile_alerts`, `GET/PATCH /v1/clients/{id}/profile`, e campos espelhados em `GET /v1/clients/{id}`.

## Contrato

- **GET** `/v1/clients/{client_id}/profile` → `{ profile, completeness_score, alerts }`
- **PATCH** `/v1/clients/{client_id}/profile` → corpo JSON com chaves de bloco opcionais (`personal`, `professional`, …); merge superficial por bloco; `null` num campo remove a chave nesse bloco.
- **GET** detalhe do cliente inclui `profile`, `profile_completeness_score`, `profile_alerts`.

Esquema alinhado a `docs/PRODUCT.md` §5.3; códigos de alerta estáveis em `domain/client_profile.py`.

## Migração

`alembic upgrade head` aplica `phase3_004` (`profile_data` NOT NULL, default `{}`).
