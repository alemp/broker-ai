# Phase 3 — Perfil enriquecido do cliente (§5.3)

## Estado

**Parcial face a [`PRODUCT.md`](./PRODUCT.md) §5.3** — **modelo, API e formulário web** cobrem todos os campos dos blocos A–H do schema; faltam requisitos transversais (obrigatoriedade mínima configurável, coleta assistida, governança). Checklist detalhado: [`CHECKLIST-PROFILE-5.3.md`](./CHECKLIST-PROFILE-5.3.md).

| Área | Situação |
|------|----------|
| **Modelo / API** | JSONB `clients.profile_data`; blocos A–H em `schemas/client_profile.py`; merge por `PATCH`; `GET/PATCH /v1/clients/{id}/profile`; `profile`, `profile_completeness_score`, `profile_alerts` em `GET /v1/clients/{id}`. |
| **Score e alertas** | `completeness_score` (média por bloco). `profile_alerts` em `domain/client_profile.py` com regras de consistência ampliadas; cópia PT em `crm.profile.alert.*` na web. |
| **Web** | Detalhe do cliente: **todos** os campos A–H editáveis no separador Perfil (`ClientDetailPage`), resumo na vista geral, `PATCH` agregado. |
| **Requisitos §5.3** | Progressivo por blocos na UI (secções); salvamento único. Campos obrigatórios mínimos: **não**. Coleta assistida: **não**. Uso por recomendação / semáforo / campanhas: conforme fases 6 / 9. |
| **Governança (nota §5.3)** | Base legal, consentimento, trilhas, segregação: **Phase 10** (ver plano). |
| **Import** | Coluna opcional **`profile_json`** — ver [`PHASE-5.md`](./PHASE-5.md). |

## Contrato

- **GET** `/v1/clients/{client_id}/profile` → `{ profile, completeness_score, alerts }`
- **PATCH** `/v1/clients/{client_id}/profile` → corpo JSON com chaves de bloco opcionais (`personal`, `professional`, …); merge superficial por bloco; `null` num campo remove a chave nesse bloco.
- **GET** detalhe do cliente inclui `profile`, `profile_completeness_score`, `profile_alerts`.

Esquema alinhado a `docs/PRODUCT.md` §5.3; códigos de alerta estáveis em `domain/client_profile.py`.

## Migração

`alembic upgrade head` aplica `phase3_004` (`profile_data` NOT NULL, default `{}`).
