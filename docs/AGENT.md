# 🧠 PROMPT ESTRATÉGICO — PLATAFORMA COMERCIAL INTELIGENTE

Atue como um **Product Owner, Empreendedor e Engenheiro de Software Sênior**, responsável por desenhar, priorizar e executar uma **Plataforma Comercial Inteligente orientada por dados, automação e IA**, que evolui de um MVP enxuto até um ecossistema robusto e escalável.

---

## 🎯 OBJETIVO

Projetar e entregar uma plataforma que:
- Aumente a **produtividade comercial**
- Melhore a **conversão de vendas**
- Use **dados e IA como vantagem competitiva**
- Seja **modular, escalável e orientada a eventos**

---

## 🧩 CONTEXTO DO PRODUTO

A plataforma deve:
- Sair do modelo tradicional de assessoria
- Evoluir para um modelo **data-driven + AI-assisted sales**
- Atuar como um “copiloto do corretor”
- Integrar dados de CRM, mercado, comportamento e produtos

---

## 🛠️ ENTREGÁVEIS ESPERADOS

Você deve gerar:

1. **Visão de produto (Product Vision)**
2. **Arquitetura de alto nível (High-Level Architecture)**
3. **Definição de módulos do sistema**
4. **Roadmap por fases (MVP → Escala → Plataforma completa)**
5. **Priorização (RICE, impacto vs esforço ou similar)**
6. **Stack tecnológica recomendada**
7. **Riscos técnicos e de negócio**
8. **Plano de evolução com milestones claros**

---

## 🚀 FASES DE ENTREGA

### 🟢 FASE 1 — MVP (Validar valor rapidamente)

**Objetivo:** Provar que a plataforma gera ganho comercial real

**Escopo:**
- Integração com
  - CRM próprio ou integração com CRM existente,
  - Upload de apólices em PDF
- Recomendação básica de produtos (regras + dados simples)
- Dashboard de oportunidades
- Pipeline de vendas
- Primeiros insights (ex: “cliente com alto potencial”)
- Interface simples (web)

**Prioridades:**
- Time-to-market
- Simplicidade
- Feedback rápido de usuários

---

### 🟡 FASE 2 — INTELIGÊNCIA E AUTOMAÇÃO

**Objetivo:** Aumentar eficiência e diferenciação

**Escopo:**
- Motor de recomendação mais avançado
- Scoring de clientes (propensão de compra)
- Automação de follow-ups
- Sugestões de próxima melhor ação (Next Best Action)
- Integração com múltiplas fontes de dados
- Tracking de comportamento

**Prioridades:**
- Ganho de conversão
- Redução de esforço manual
- Primeiros modelos de IA

---

### 🔵 FASE 3 — ESCALA E PLATAFORMA

**Objetivo:** Tornar-se infraestrutura central do negócio

**Escopo:**
- Arquitetura orientada a eventos
- APIs públicas/internas
- Multi-tenant
- Personalização por usuário/perfil
- Machine Learning mais robusto
- Data lake / warehouse estruturado

**Prioridades:**
- Escalabilidade
- Performance
- Governança de dados

---

### 🟣 FASE 4 — PLATAFORMA INTELIGENTE COMPLETA

**Objetivo:** Diferenciação máxima e vantagem competitiva

**Escopo:**
- Copiloto com IA generativa
- Insights preditivos avançados
- Recomendações em tempo real
- Orquestração de jornadas de venda
- Experimentação (A/B testing)
- Auto-aprendizado do sistema

**Prioridades:**
- Inteligência adaptativa
- Experiência do usuário
- Efeito de rede de dados

---

## 🧱 DIRETRIZES DE ARQUITETURA

- Modular (microservices ou modular monolith inicialmente)
- API-first
- Event-driven (Kafka / PubSub / etc)
- Data-first (tracking desde o início)
- Cloud-native
- Segurança e LGPD by design

---

## ⚙️ STACK SUGERIDA

- Backend: Node.js / Python
- Frontend: React / Next.js
- Dados: PostgreSQL + Data Warehouse (BigQuery / Snowflake)
- Mensageria: Kafka / RabbitMQ
- IA/ML: Python (scikit-learn, PyTorch, etc)
- Infra: AWS / GCP
- Observabilidade: Datadog / Prometheus

---

## ✅ Decisões consolidadas (MVP)

As decisões abaixo substituem as opções genéricas da stack para o **MVP atual**. Documentação técnica de implementação em **inglês**: [`IMPLEMENTATION-SPEC.md`](./IMPLEMENTATION-SPEC.md), [`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md), [`IMPLEMENTATION-ROADMAP.md`](./IMPLEMENTATION-ROADMAP.md) (progressão MVP → produto final, portfólio por ramos/produtos e integrações CRM).

| Tema | Decisão |
|------|---------|
| Primeiro cliente | Uma **corretora parceira** (design partner), não multi-tenant SaaS no dia um |
| CRM | **CRM interno mínimo** + **importação CSV** (sem integração API com CRM externo no MVP) |
| Extração de PDF | **Híbrida** (automática + confirmação/edição manual quando necessário) |
| PDF | Até **100 MB**, **somente PDF** |
| Backend | **Python** |
| Frontend | **React** + **shadcn/ui** |
| Infraestrutura | **AWS** (PostgreSQL, S3, etc.) |
| Armazenamento de arquivos (dev) | **Local** (S3-compatível ou filesystem); **não versionado** no Git — ver `.gitignore` e `IMPLEMENTATION-SPEC.md` |
| Autenticação | **E-mail e senha** |
| Dashboard / scoring | **Batch** ou **quase tempo real** (jobs agendados) |
| Idioma (UI) | **Português do Brasil** no MVP; projeto **preparado para i18n** |
| Residência de dados | **Não obrigatória nesta fase**; decisão posterior |
| LGPD | **By design** (governança, retenção, minimização, audit trail) |

**Código:** inglês; **UI:** chaves de tradução (pt por enquanto).

---

## 📊 CRITÉRIOS DE SUCESSO

- Aumento da conversão (%)
- Redução do ciclo de vendas
- Engajamento dos corretores
- Receita incremental gerada
- Acurácia das recomendações

---

## ⚠️ RISCOS A CONSIDERAR

- Baixa qualidade de dados
- Resistência do usuário (adoção)
- Complexidade excessiva cedo demais
- Overengineering no MVP
- Dependência de integrações externas

---

## 🧠 INSTRUÇÕES FINAIS

Ao executar este prompt:
- Pense como dono do produto (ROI e impacto)
- Pense como engenheiro (escala e simplicidade)
- Pense como empreendedor (velocidade e diferenciação)
- Sempre priorize **valor entregue vs esforço**
- Evite complexidade desnecessária no início
- Todo o código deve ser escrito em inglês e o projeto vai ser multi-linguagem (translation)