# Pré–Fase 6: módulos PRODUCT.md §5.6–§5.9

Documento de entrega antes da Fase 6: catálogo (seguradoras/produtos enriquecidos), recomendação consultiva, semáforo de adequação e campanhas de pós-venda.

## 5.6 Catálogo de seguradoras e produtos

- **Entidade `insurers`**: CRUD em `GET|POST /v1/insurers`, `GET|PATCH /v1/insurers/{id}`.
- **Produto**: campos adicionais (`insurer_id`, `line_of_business_id`, `main_coverage_summary`, `additional_coverages`, `exclusions_notes`, `recommended_profile_summary`, `commercial_arguments`, `support_materials`). Listagem com pesquisa textual opcional `GET /v1/products?q=`.
- **UI**: página `/insurers` e catálogo de produtos continua em `/v1/products` (detalhe no cliente usa produtos existentes).

## 5.7 Recomendação consultiva (camada de regras)

- **Domínio**: `domain/recommendation_rules.py` — `assess_protection_gaps`, `evaluate_rules_for_client` (priorização + traço de regras).
- **API**:
  - `POST /v1/clients/{client_id}/recommendation-runs` (body opcional `opportunity_id`).
  - `GET /v1/clients/{client_id}/recommendation-runs`.
  - `POST /v1/clients/recommendation-feedback` — aceitar / ignorar / descartar sugestão.
- **UI**: cartão “Adequação e recomendações” no detalhe do cliente com últimas execuções e botão “Gerar recomendação”.
- **Ranking de oportunidades**: `GET /v1/opportunities?sort=propensity_desc` ordena por `closing_probability × estimated_value` (MVP de “propensão × valor”).

## 5.8 Análise de adequação (semáforo)

- **Domínio**: `domain/adequacy_rules.py` — `evaluate_adequacy` (GREEN / YELLOW / RED) alinhado às lacunas de proteção e qualidade do perfil.
- **API**: `GET /v1/clients/{client_id}/adequacy`.
- **Fila de revisão**: `GET /v1/clients/adequacy-review-queue?limit=…` (primeiros clientes com semáforo não verde, varrimento MVP).

## 5.9 Pós-venda e régua de comunicação

- **Modelos**: `campaigns`, `campaign_touches` (agendamento, canal, estado).
- **Segmentação**: `segment_criteria` JSON — chaves suportadas: `marketing_opt_in`, `min_profile_completeness`, `missing_product_category` (enum, ex. `LIFE_INSURANCE`), `max_adequacy_traffic_light` (`GREEN` | `YELLOW` | `RED`).
- **API**:
  - CRUD campanhas: `GET|POST /v1/campaigns`, `GET|PATCH /v1/campaigns/{id}`.
  - `POST /v1/campaigns/{id}/segment-refresh` — cria toques PENDING para o público atual.
  - `GET /v1/campaigns/{id}/touches`, `PATCH .../touches/{touch_id}` (ex.: marcar SENT).
- **Consentimento / canal**: `clients.marketing_opt_in`, `preferred_marketing_channel` expostos em `ClientCreate` / `ClientUpdate` / `ClientOut` e no formulário CRM do detalhe do cliente.
- **UI**: página `/campaigns`.

## Migração

- Revisão Alembic: `20260413_modules_56_59_insurer_catalog_intel.py` (após aplicar dependências da cadeia existente).

## Testes

- `tests/test_modules_56_59.py` (requer `DATABASE_URL`): fluxo seguradora → produto enriquecido → adequação → recomendação → feedback → campanha → segment refresh → ordenação de oportunidades.
