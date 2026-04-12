# Checklist — Perfil enriquecido ([`PRODUCT.md`](./PRODUCT.md) §5.3)

## Blocos de dados (schema + API + UI)

| Bloco | Campos `PRODUCT.md` | Schema/API | Formulário web | Resumo na ficha |
| ----- | ------------------- | ---------- | -------------- | ----------------- |
| **A** Pessoal/familiar | Estado civil, filhos, idades, dependentes financeiros, responsável pela renda, cônjuge/parceiro, fase de vida | OK | OK | OK |
| **B** Profissional/financeiro | Todos | OK | OK | OK |
| **C** Patrimônio/residência | Imóvel, tipo, uso, valor, localização, condomínio/casa, alto valor | OK | OK | OK |
| **D** Mobilidade | Veículo, qtd, tipo, ano, uso, condutor, garagem, cidade | OK | OK | OK |
| **E–H** | Conforme §5.3 | OK | OK | OK |

## Requisitos funcionais

| # | Requisito | Estado |
|---|-----------|--------|
| 1 | Preenchimento progressivo por blocos | Parcial — UI por secções; salvamento único (PATCH agregado) |
| 2 | Campos obrigatórios mínimos configuráveis | Pendente (fase posterior) |
| 3 | Score de completude (0–100) | OK — média por bloco |
| 4 | Alertas de dados faltantes / inconsistência | Parcial — catálogo ampliado em `domain/client_profile.py`; mapeamento PT em `common.json` |
| 5 | Atualização manual | OK |
| 6 | Coleta assistida / wizard | Pendente |
| 7 | Uso por recomendação, semáforo, campanhas | Parcial — já integrado onde modelado nas fases 6/9 |
| 8 | Governança (consentimento, trilhas, visibilidade) | Pendente — ver plano Phase 10 |

## Import em massa

| Item | Estado |
|------|--------|
| Coluna `profile_json` no template | Ver [`PHASE-5.md`](./PHASE-5.md) |

## Manutenção

- Ao adicionar campo no Pydantic `schemas/client_profile.py`, atualizar: merge (automático), **web** (estado + load + save + formulário + resumo), **i18n** `crm.profile.*`, e opcionalmente **alertas** + testes de API.
