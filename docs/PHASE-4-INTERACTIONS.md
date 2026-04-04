# Phase 4 — Interações, histórico e agenda ([`PRODUCT.md`](./PRODUCT.md) §5.5)

## Estado

Implementado: modelo `Interaction` (tipo enum, resumo, `occurred_at`, `client_id`, `opportunity_id` opcional, `created_by`), migração `phase4_005`, `GET/POST/PATCH/DELETE /v1/interactions` com filtros (`client_id`, `opportunity_id`, `interaction_type`, `occurred_from` / `occurred_to`), sincronização de `Opportunity.last_interaction_at` a partir do máximo de `occurred_at` das interações ligadas, campos opcionais no registro para atualizar `next_action` e `next_action_due_at` da oportunidade, coluna `opportunities.next_action_due_at`, filtro `GET /v1/opportunities?overdue_next_action=true` (abertas com prazo &lt; agora). Web: timeline na ficha do cliente e da oportunidade; painel no dashboard (atrasadas + interações de hoje).

## Contrato API (resumo)

| Método | Caminho | Notas |
|--------|---------|--------|
| GET | `/v1/interactions` | Query: `client_id`, `opportunity_id`, `interaction_type`, `occurred_from`, `occurred_to`, paginação |
| POST | `/v1/interactions` | Corpo: `client_id`, `interaction_type`, `summary`, opcionais `opportunity_id`, `occurred_at`, `opportunity_next_action`, `opportunity_next_action_due_at` |
| GET/PATCH/DELETE | `/v1/interactions/{id}` | Org-scoped |

Tipos: `CALL`, `WHATSAPP`, `EMAIL`, `MEETING`, `VISIT`, `PROPOSAL_SENT`, `CLIENT_REPLY`, `NOTE`, `POST_SALE`, `CAMPAIGN_TOUCH`.

## Migração

`alembic upgrade head` aplica `phase4_005` (tabela `interactions` + `next_action_due_at` em `opportunities`).
