# Notas de versão — Plataforma comercial inteligente

**Última atualização deste sumário:** 26 de abril de 2026

Este documento é um **sumário executivo** das entregas do sistema, organizadas por versão. Cada versão está relacionada às **grandes áreas funcionais** da plataforma: jornada comercial do corretor, perfil orientado a seguros, carteira e recomendações, relacionamento e pós-venda, inteligência sobre oportunidades e — nas entregas mais recentes — **documentos e extração**, além de **administração** (organização/usuários) e evolução contínua do CRM e do catálogo.

---

## v0.9.0 — Documentos, extração e evolução do CRM

**Foco:** habilitar gestão de documentos e leitura assistida, enquanto consolida administração e paridade lead/cliente no CRM.

- **Documentos (PDF):** versionamento, extração assíncrona e suporte a exclusão de documentos e versões.
- **Extração híbrida:** serviço de **OCR** e fallback priorizando **pypdf** quando aplicável.
- **CRM (leads e clientes):** evolução de formulários e dados pessoais; melhorias de paridade entre telas de lead/cliente e alinhamento de UX.
- **Interações:** roteamento correto das interações do dia para cliente, lead ou oportunidade.
- **Administração:** gestão de usuários e edição de organização; navegação agrupando itens administrativos (seguradoras e campanhas).
- **Catálogo:** consolidação de cadastro e edição de seguradoras e produtos (base para recomendação e carteira).
- **Áreas de produto:** documentos e extração; CRM e operação comercial; administração e catálogo.

---

## v0.8.0 — Recomendação consultiva com explicabilidade

**Foco:** tornar a venda mais assertiva com sugestões fundamentadas e auditáveis.

- Motor de **regras de negócio** que combina dados da **carteira** (linhas de negócio e produtos detidos), **perfil para seguros** e catálogo.
- **Sugestões de produtos** com indicação **de quais regras** levaram a cada sugestão (transparência para o corretor e para a gestão).
- Pré-visualização nas fichas de **cliente** e **oportunidade**; histórico de execuções quando gravado na ficha.
- **Áreas de produto:** recomendação consultiva; reforço do perfil enriquecido e da carteira como insumos da venda.

---

## v0.7.0 — Importação em massa de clientes

**Foco:** acelerar a entrada de dados sem CRM externo na primeira fase.

- Importação de **CSV** e **Excel (.xlsx)** com validação, pré-visualização e confirmação transacional.
- Suporte a **linhas de negócio**, **produtos detidos**, **corretor responsável**, **tipo pessoa/empresa**, **marketing** e campos avançados (perfil e segurados via JSON, quando aplicável).
- Registro de **origem dos dados** (importação) para rastreio na carteira.
- **Áreas de produto:** cadastro e consolidação da base; preparação para recomendações e análise de carteira.

---

## v0.6.0 — Leads, empresa, segurados e histórico

**Foco:** fechar o ciclo desde o prospect até a ficha única do cliente.

- **Leads** com estados, corretor opcional e conversão em **cliente** com criação opcional de **oportunidade**.
- Cliente **pessoa física** ou **empresa** (dados societários).
- **Segurados** associados ao cliente (titular, dependente, outros).
- **Histórico de alterações** relevantes na ficha (auditoria operacional do CRM).
- Listagem de usuários da organização para atribuição de responsáveis.
- **Áreas de produto:** gestão de leads e clientes; visão única com produtos e partes relacionadas.

---

## v0.5.0 — Interações, agenda e memória comercial

**Foco:** disciplina operacional e adoção pelo corretor.

- Registro de **interações** (chamada, WhatsApp, e-mail, reunião, proposta, nota, pós-venda, campanha, etc.) ligadas a cliente e, opcionalmente, a oportunidade.
- **Linha do tempo** nas fichas; sincronização da **última interação** na oportunidade.
- **Painel inicial:** oportunidades com **próxima ação em atraso** e interações do dia.
- **Áreas de produto:** histórico de relacionamento; suporte ao funil e ao acompanhamento comercial.

---

## v0.4.0 — Perfil enriquecido para seguros (primeira onda)

**Foco:** dados estruturados que sustentam recomendação e priorização futura.

- Modelo de **perfil orientado a seguros** (família, patrimônio, mobilidade, profissão e finanças, saúde, empresa, animal de estimação, preferências de contato).
- **Pontuação de completude** e **alertas** de lacunas na ficha do cliente.
- **API e persistência** para todos os blocos; **formulário na web** em expansão (prioridade: blocos mais usados na venda consultiva).
- **Áreas de produto:** perfil enriquecido; base para argumentação e para evolução do semáforo de adequação.

---

## v0.3.0 — Carteira, oportunidades e catálogo inicial

**Foco:** pipeline e “o que o cliente já tem”.

- **Oportunidades** com estágios, valores, próxima ação e prazo; transições de pipeline.
- **Linhas de negócio** por cliente e **produtos detidos** ligados ao catálogo (automóvel, ramos elementares, vida, etc.).
- **Origem do registro** na carteira (CRM interno vs importação, extensível a extração futura).
- **Áreas de produto:** funil comercial; carteira como base de upsell e cross-sell.

---

## v0.2.0 — Seguradoras, campanhas e adequação (MVP)

**Foco:** insumos de catálogo, relacionamento e revisão da carteira.

- **Cadastro de seguradoras** e enriquecimento de **produtos** (coberturas, argumentos).
- **Campanhas** com segmentação e geração de toques (base para régua de relacionamento; envio por canais externos evolui em fases seguintes).
- **Avaliação de adequação** da carteira e **fila de revisão** para o comercial priorizar ajustes.
- **Áreas de produto:** catálogo; pós-venda e campanhas; primeiro passo do semáforo de adequação.

---

## v0.1.0 — Acesso, organização e núcleo CRM

**Foco:** base técnica e primeiro uso pela corretora parceira.

- **Cadastro e login** com sessão segura; usuários pertencentes a uma **organização** (corretora).
- **Clientes** — criação, listagem e ficha com contato e notas.
- **Áreas de produto:** gestão de usuários e acesso (MVP); cadastro central de clientes.

---

## Próximas entregas previstas (roadmap resumido)

Sem datas fixas neste sumário; ordem típica de prioridade:

1. **Completar o perfil na interface** — todos os blocos editáveis pelo corretor, alinhados à venda consultiva.
2. **Documentos (PDF)** — carregamento com limites de tamanho e quota, armazenamento seguro.
3. **Extração híbrida** — leitura assistida de apólices e documentos com revisão humana.
4. **Pontuação e painéis** — semáforo e indicadores em escala para gestão e corretores.
5. **Conformidade e operação** — reforço de privacidade, retenção e pedidos de titulares (LGPD), preparação para go-live amplo.

---

## Como ler este documento

- As **versões** agrupam pacotes de funcionalidades entregues; números não implicam necessariamente tags de código públicas.
- O objetivo é **transparência para stakeholders** sobre o que já está disponível na aplicação e o que vem a seguir, **sem** expor documentação interna de engenharia.
