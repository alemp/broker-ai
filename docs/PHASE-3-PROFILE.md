# Phase 3 — Perfil enriquecido do cliente (§5.3)

## Estado

**Não concluído face a [`PRODUCT.md`](./PRODUCT.md) §5.3** — o **contrato de dados e API** está largamente alinhado ao brief; **UX, requisitos funcionais completos e governança** ainda não.

| Área | Situação |
|------|----------|
| **Modelo / API** | JSONB `clients.profile_data`; blocos A–H em `schemas/client_profile.py`; merge por `PATCH`; `GET/PATCH /v1/clients/{id}/profile`; `profile`, `profile_completeness_score`, `profile_alerts` em `GET /v1/clients/{id}`. |
| **Score e alertas** | `completeness_score` (média de preenchimento por bloco). `profile_alerts`: códigos estáveis limitados em `domain/client_profile.py` — não cobre todos os gaps “críticos” do brief. |
| **Web** | No detalhe do cliente: A/C/D (fase de vida, filhos; imóvel básico; veículo) **e** blocos **B, E–H** (profissional/financeiro, saúde, empresa/garantias, pet, comportamento) no mesmo formulário com `PATCH` agregado. **Ainda sem** resto alargado de C (valor, localização, etc.). |
| **Requisitos §5.3** | Preenchimento progressivo por blocos: **só via API** para blocos completos; na app, incremental só no subconjunto acima. Campos obrigatórios mínimos: **não**. Coleta assistida: **não**. Uso por recomendação / semáforo / campanhas: **Phase 6+ / 9 / 11**. |
| **Governança (nota §5.3)** | Base legal, consentimento, trilhas, segregação de visibilidade: **Phase 10** (documentado no plano; não implementado no produto). |
| **Import** | Colunas opcionais de perfil no template: **Phase 5**. |

## Contrato

- **GET** `/v1/clients/{client_id}/profile` → `{ profile, completeness_score, alerts }`
- **PATCH** `/v1/clients/{client_id}/profile` → corpo JSON com chaves de bloco opcionais (`personal`, `professional`, …); merge superficial por bloco; `null` num campo remove a chave nesse bloco.
- **GET** detalhe do cliente inclui `profile`, `profile_completeness_score`, `profile_alerts`.

Esquema alinhado a `docs/PRODUCT.md` §5.3; códigos de alerta estáveis em `domain/client_profile.py`.

## Migração

`alembic upgrade head` aplica `phase3_004` (`profile_data` NOT NULL, default `{}`).
