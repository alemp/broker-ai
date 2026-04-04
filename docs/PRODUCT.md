# Plataforma Comercial Inteligente

**Documento estratégico e de escopo funcional do MVP**

> Para o alinhamento deste escopo com a implementação no repositório, ver [STRATEGIC-PRODUCT-ALIGNMENT.md](./STRATEGIC-PRODUCT-ALIGNMENT.md).

---

## 1. Sumário executivo

Temos a oportunidade de sair do modelo tradicional de assessoria, centrado apenas em distribuição e relacionamento comercial, para um modelo de assessoria aumentada por dados, automação e inteligência aplicada à venda.

O diferencial do produto não está em ser apenas mais um CRM. O diferencial está em combinar três capacidades que raramente aparecem juntas no mercado de assessorias:

1. **Organizar a jornada comercial do corretor** com disciplina operacional, funil, histórico e gestão da carteira.
2. **Transformar dados de perfil** em recomendação consultiva de seguros e coberturas, tornando a venda mais assertiva.
3. **Ativar um pós-venda inteligente** que converta relacionamento em retenção, upsell, cross-sell e recorrência.

Em termos estratégicos, esse produto é relevante para as assessorias e corretores porque ataca dores estruturais do segmento: baixa padronização comercial, dependência excessiva da experiência individual do corretor, dificuldade de escalar boas práticas, pouca inteligência sobre a carteira e fraca exploração do pós-venda. Ao estruturar essas frentes em uma mesma solução, a plataforma deixa de ser ferramenta de apoio e passa a operar como alavanca de adoção, produtividade e diferenciação competitiva.

A recomendação é não construir tudo do zero. O caminho mais eficiente é um modelo **acelerador**: usar plataformas consolidadas de mercado para CRM, automação de comunicação e analytics, e concentrar o desenvolvimento próprio no que gera vantagem competitiva real — ou seja, regras de negócio do seguro, motor de recomendação, semáforo de adequação, inteligência de carteira e camada de experiência específica da assessoria. Plataformas como HubSpot, Pipedrive, Salesforce, RD Station, Power BI, Looker Studio e WhatsApp Business Platform já oferecem, em diferentes profundidades, CRM, pipeline, automação, dashboards, integração e recursos de IA que podem acelerar o lançamento do MVP.

---

## 2. Visão estratégica do produto

### 2.1 O problema que o produto resolve

Hoje, grande parte das assessorias e corretoras opera com algumas limitações recorrentes:

- Gestão comercial fragmentada, muitas vezes em planilhas, mensagens e memória individual.
- Pouca previsibilidade do funil e baixa padronização de acompanhamento.
- Venda ainda muito reativa, baseada em oportunidade pontual e não em necessidade real do cliente.
- Baixa exploração da base já vendida.
- Dificuldade em transformar conhecimento técnico de seguros em escala comercial.
- Pós-venda pouco estruturado e pouco monetizado.

O produto proposto corrige isso ao estruturar o ciclo completo, da entrada do lead até a evolução da carteira.

### 2.2 A tese de valor

A tese central é: **quanto mais a assessoria souber sobre o perfil do cliente, mais ela conseguirá vender com relevância, retenção e rentabilidade.**

Essa plataforma permite que a assessoria opere em um novo patamar:

- Do corretor artesanal para o corretor assistido por inteligência, com melhor recomendação e argumentação.
- Da carteira passiva para a carteira monitorada, com oportunidades de correção, ampliação e renovação.
- Do relacionamento genérico para a comunicação contextual, com campanhas mais aderentes ao momento de vida, patrimônio e perfil do cliente.
- Da gestão intuitiva para a gestão orientada por dados, com visibilidade real de conversão, produtividade e valor potencial da base.

### 2.3 O diferencial competitivo do produto

O produto deve ser posicionado como uma **plataforma de inteligência comercial para seguros**, e não apenas como CRM.

Seu diferencial prático se apoia em cinco pilares:

#### Pilar 1 — Perfil enriquecido orientado a seguros

A maioria dos CRMs trabalha com cadastro comercial genérico. O diferencial aqui é estruturar atributos que realmente importam para identificar necessidade de plano de saúde, residencial, automóvel, vida, garantia e pet.

#### Pilar 2 — Recomendação consultiva

A plataforma deverá sugerir produtos, coberturas e argumentos com base no perfil do proponente ou segurado, cruzando regras comerciais e técnicas.

#### Pilar 3 — Semáforo de adequação da venda

A carteira deixa de ser apenas histórico de apólices e passa a ser também base de revisão comercial. Isso cria um mecanismo sistemático de upsell, cross-sell e correção de cobertura.

#### Pilar 4 — Régua de relacionamento inteligente

Não se limita a aniversário ou Natal. Ela pode ativar comunicação com contexto, preferências, momentos de vida e gatilhos comerciais.

#### Pilar 5 — Modelo de acelerador

A estratégia tecnológica reduz tempo, custo e risco, ao aproveitar softwares já maduros onde o mercado já resolveu bem o problema, e investir desenvolvimento apenas onde nasce o diferencial do projeto.

---

## 3. Objetivos estratégicos e de negócio

O MVP deverá perseguir os seguintes objetivos:

- Centralizar leads, clientes, oportunidades, apólices e interações.
- Dar visibilidade do funil comercial por corretor, equipe, produto e região.
- Elevar a qualidade da venda por meio de recomendação e inteligência aplicada.
- Ampliar taxa de conversão, ticket médio e retenção.
- Transformar a base atual em fonte recorrente de novas oportunidades.
- Criar base de dados estruturada para evoluções futuras de IA.
- Gerar adoção rápida por parte dos corretores, com baixa complexidade operacional.

---

## 4. Princípios de desenho do MVP

O produto deve nascer sob seis princípios:

1. **Foco em adoção** — sistema sem uso não gera resultado.
2. **Foco em receita** — entregas que aumentem fechamento e monetização da carteira.
3. **Simplicidade operacional**, sobretudo para o corretor.
4. **Escalabilidade funcional**, permitindo crescimento por módulos.
5. **Explicabilidade das recomendações**, evitando caixa-preta.
6. **Arquitetura plugável**, preparada para integração futura.

---

## 5. Escopo funcional detalhado

### 5.1 Módulo de gestão de usuários e perfis

#### Objetivo

Controlar acesso e visibilidade por papel operacional.

#### Perfis mínimos

1. Administrador da assessoria.
2. Gestor comercial.
3. Corretor.
4. Usuário de suporte ou operação (opcional em fase seguinte).

#### Requisitos funcionais

O sistema deverá permitir:

1. Cadastro, edição e inativação de usuários.
2. Associação do usuário a regional, carteira, equipe ou supervisor.
3. Controle de acesso por perfil.
4. Definição de permissões por módulo.
5. Recuperação de senha.
6. Registro de logs de acesso e ações críticas.

#### Recomendação de mercado

Esse bloco pode ser absorvido pela camada de identidade e permissões do CRM ou da aplicação principal, sem necessidade de inovação própria.

---

### 5.2 Módulo de cadastro de leads, clientes e segurados

#### Objetivo

Concentrar os dados comerciais e cadastrais em uma visão única.

#### Entidades principais

1. Lead.
2. Oportunidade.
3. Cliente.
4. Segurado.
5. Empresa, quando aplicável.

#### Requisitos funcionais

O sistema deverá permitir:

1. Cadastro manual de leads.
2. Importação em lote por planilha.
3. Enriquecimento progressivo dos dados.
4. Conversão de lead em cliente ou oportunidade.
5. Associação a corretor responsável.
6. Histórico de atualização de dados.
7. Consolidação de visão única quando o mesmo cliente possuir múltiplos produtos.

#### Observação estratégica

Neste ponto, o objetivo não é criar cadastro “bonito”, mas criar cadastro **útil** para recomendação, priorização e relacionamento.

---

### 5.3 Módulo de perfil enriquecido do cliente

#### Objetivo

Capturar atributos estruturados que viabilizem recomendação comercial real.

#### Bloco A — Perfil pessoal e familiar

1. Estado civil.
2. Quantidade de filhos.
3. Idade dos filhos.
4. Dependentes financeiros.
5. Responsável principal pela renda familiar.
6. Existência de cônjuge ou parceiro.
7. Fase de vida (jovem solteiro, casal com filhos, aposentado, empresário, entre outros).

#### Bloco B — Perfil profissional e financeiro

1. Profissão.
2. Vínculo profissional (CLT, autônomo, empresário, servidor, liberal).
3. Renda aproximada.
4. Estabilidade de renda.
5. Faixa patrimonial, quando informada.
6. Participação societária, quando houver.

#### Bloco C — Patrimônio e residência

1. Possui imóvel.
2. Tipo de imóvel (próprio, financiado, alugado).
3. Uso do imóvel (moradia, aluguel, veraneio).
4. Valor aproximado do imóvel.
5. Localização.
6. Condomínio ou casa.
7. Presença de itens de alto valor.

#### Bloco D — Mobilidade e automóvel

1. Possui veículo.
2. Quantidade de veículos.
3. Tipo do veículo.
4. Ano/modelo.
5. Uso predominante (pessoal, profissional, aplicativo, frota).
6. Principal condutor.
7. Garagem.
8. Cidade de circulação.

#### Bloco E — Saúde

1. Possui plano de saúde.
2. Tipo de plano (individual, familiar, empresarial).
3. Quantidade de vidas.
4. Faixa etária dos dependentes.
5. Satisfação com o plano atual.
6. Interesse em upgrade, portabilidade ou redução de custo.

#### Bloco F — Empresarial e garantia

1. Possui empresa.
2. Segmento.
3. Faturamento estimado.
4. Número de funcionários.
5. Participa de licitações.
6. Possui contratos com exigência de garantia.
7. Tem necessidade de performance bond, judicial, contratual ou similar.

#### Bloco G — Pet

1. Possui pet.
2. Tipo de animal.
3. Raça.
4. Idade.
5. Quantidade.
6. Frequência de uso de clínica ou veterinário.

#### Bloco H — Comportamento e preferências

1. Canal preferencial de contato.
2. Melhor horário para contato.
3. Time de futebol, quando informado e autorizado.
4. Datas relevantes.
5. Preferências de comunicação.
6. Eventos de vida (mudança, casamento, nascimento de filho, compra de imóvel, abertura de empresa).

#### Requisitos funcionais

O sistema deverá permitir:

1. Preenchimento progressivo por blocos.
2. Campos obrigatórios mínimos e campos evolutivos.
3. Score de completude do perfil.
4. Alertas de dados faltantes críticos.
5. Atualização manual e futura coleta assistida.
6. Uso dessas variáveis pelo motor de recomendação, semáforo e campanhas.

#### Observação de governança

Como haverá tratamento de dados potencialmente sensíveis ou estratégicos, o produto deve prever base legal, consentimento, trilhas de acesso e segregação de visibilidade.

---

### 5.4 Módulo de funil comercial e oportunidades

#### Objetivo

Padronizar a jornada comercial do corretor e criar previsibilidade.

#### Etapas sugeridas

1. Lead recebido.
2. Lead qualificado.
3. Contato inicial realizado.
4. Diagnóstico de necessidade.
5. Proposta em elaboração.
6. Proposta apresentada.
7. Negociação.
8. Fechado ganho.
9. Fechado perdido.
10. Em pós-venda ou relacionamento.

#### Requisitos funcionais

O sistema deverá permitir:

1. Criação de oportunidade a partir do lead ou cliente.
2. Movimentação no funil.
3. Registro de produto de interesse.
4. Registro de seguradora considerada.
5. Valor estimado.
6. Data prevista de fechamento.
7. Próxima ação obrigatória em estágios ativos.
8. Motivo de perda.
9. Visão kanban, lista e filtros.
10. Dashboards por corretor, produto, seguradora e região.

#### Regras de negócio

1. Oportunidade aberta deve possuir dono claro.
2. Oportunidade em negociação deve possuir próxima ação.
3. Perda exige motivo.
4. Ganho deve alimentar a base de apólices e o pós-venda.

#### Acelerador recomendado

CRMs de mercado já entregam pipeline, atividades, automações, gestão de negócios e dashboards. HubSpot se posiciona como plataforma unificada de marketing, vendas, atendimento e CRM com camada de IA, enquanto Pipedrive enfatiza pipeline visual, automação e IA aplicada a produtividade comercial. Salesforce Sales Cloud também oferece automação de vendas e recursos de IA via Einstein.

---

### 5.5 Módulo de interações, agenda e histórico

#### Objetivo

Registrar a cadência comercial e preservar memória de relacionamento.

#### Tipos de interação

1. Ligação.
2. WhatsApp.
3. E-mail.
4. Reunião.
5. Visita.
6. Envio de proposta.
7. Retorno do cliente.
8. Observação livre.
9. Tratativa de pós-venda.
10. Acionamento por campanha.

#### Requisitos funcionais

O sistema deverá permitir:

1. Registro manual ou automático das interações.
2. Associação da interação ao lead, oportunidade ou cliente.
3. Classificação por tipo.
4. Agenda de próxima ação.
5. Alertas de atraso.
6. Visão cronológica do histórico.
7. Painel do dia do corretor.

#### Comentário estratégico

Esse módulo é decisivo para adoção. O corretor precisa perceber valor imediato, e não burocracia adicional.

---

### 5.6 Módulo de catálogo de seguradoras, produtos e coberturas

#### Objetivo

Criar a base de conhecimento operacional do ecossistema de seguros da assessoria.

#### Estrutura mínima

1. Seguradora parceira.
2. Linha de produto.
3. Produto.
4. Cobertura principal.
5. Coberturas adicionais.
6. Exclusões ou observações relevantes.
7. Perfil indicado.
8. Argumentos comerciais.
9. Documentos ou materiais de apoio.
10. Status (ativo ou inativo).

#### Requisitos funcionais

O sistema deverá permitir:

1. Cadastro e manutenção do catálogo.
2. Associação entre produto e perfil recomendado.
3. Consulta por linha de seguro.
4. Busca textual simples.
5. Uso do catálogo no motor de recomendação.
6. Anexação de materiais de apoio.

#### Comentário de arquitetura

Essa base pode começar simples, com taxonomia bem definida e governança editorial. Ela é o coração do recomendador.

---

### 5.7 Módulo de recomendação consultiva

#### Objetivo

Traduzir dados do cliente em oportunidades comerciais prioritárias, com justificativa e narrativa de venda.

#### Saídas esperadas

O sistema deverá ser capaz de sugerir:

1. Produtos aderentes ao perfil.
2. Coberturas relevantes.
3. Lacunas de proteção.
4. Prioridade comercial da recomendação.
5. Argumentos de venda.
6. Objeções previsíveis.
7. Próxima melhor ação.

#### Exemplo de lógica

Cliente com filhos, imóvel financiado, renda estável, veículo e ausência de seguro de vida e residencial. O sistema deverá apontar prioridade alta para vida e residencial, indicar racional de proteção familiar e patrimonial e sugerir narrativa de abordagem.

#### Requisitos funcionais

O sistema deverá permitir:

1. Geração de recomendação a partir da ficha do cliente.
2. Geração de recomendação no contexto da oportunidade.
3. Exibição clara do “por quê” da recomendação.
4. Registro se o corretor aceitou, ignorou ou descartou a sugestão.
5. Histórico das recomendações emitidas.
6. Ranking das oportunidades por propensão e valor estimado.

#### O que pode ser feito com IA

A recomendação deve nascer em duas camadas:

- **Camada 1 — Regras parametrizadas:** matriz de decisão com pesos por perfil, patrimônio, dependentes, produto atual e lacunas.
- **Camada 2 — IA generativa aplicada:** geração de argumentos de venda, síntese de perfil, abordagem consultiva, resumo da reunião, mensagem personalizada e sugestão de objeção versus resposta.

Ferramentas de mercado já incorporam IA em CRM e produtividade comercial, mas o diferencial do projeto estará na lógica específica de seguros e no uso do seu próprio catálogo e regras. HubSpot posiciona Breeze como sua camada de IA dentro da customer platform; Pipedrive divulga IA e automação para apoiar conversão e retenção; Salesforce evoluiu Einstein de preditivo para recursos generativos e agentes.

---

### 5.8 Módulo de análise da adequação da venda (semáforo)

#### Objetivo

Transformar a carteira vendida em base ativa de revisão e monetização.

#### Lógica do semáforo

| Cor      | Significado |
| -------- | ----------- |
| **Verde** | Cobertura adequada ao perfil e à necessidade identificada. |
| **Amarelo** | Cobertura parcialmente adequada ou com oportunidade complementar. |
| **Vermelho** | Cobertura inadequada ou ausência de proteção relevante frente ao perfil do cliente. |

#### Exemplos de aplicação

1. Cliente com imóvel sem seguro residencial: vermelho.
2. Cliente com filhos e sem vida: vermelho.
3. Cliente com veículo segurado, mas sem coberturas importantes para seu perfil de uso: amarelo.
4. Empresa que participa de licitações sem garantia: vermelho.

#### Requisitos funcionais

O sistema deverá permitir:

1. Registro das apólices e coberturas contratadas.
2. Aplicação de regras de adequação.
3. Classificação visual por produto e cliente.
4. Explicação do motivo da classificação.
5. Geração de fila de oportunidades de revisão.
6. Criação de tarefa ou campanha a partir do resultado.

#### Valor estratégico

Esse módulo é um dos maiores diferenciais do produto, pois converte inteligência técnica em receita incremental.

---

### 5.9 Módulo de pós-venda e régua de comunicação

#### Objetivo

Estruturar o relacionamento como fonte de retenção, engajamento e venda adicional.

#### Comunicações básicas

1. Aniversário.
2. Renovação.
3. Vencimento.
4. Natal.
5. Ano Novo.
6. Datas de relacionamento padrão.

#### Comunicações contextuais

1. Mensagens por momento de vida.
2. Alertas por mudança de perfil.
3. Sugestões preventivas.
4. Mensagens por preferências declaradas.
5. Comunicação vinculada a eventos sazonais, desde que adequada ao contexto e consentimento.

#### Requisitos funcionais

O sistema deverá permitir:

1. Cadastro de campanhas e jornadas.
2. Segmentação por perfil, produto, situação e semáforo.
3. Disparo programado.
4. Templates dinâmicos.
5. Registro de envio, entrega e resposta.
6. Acionamento do corretor quando houver interesse.
7. Controle de consentimento e canal preferido.

#### Aceleradores de mercado

Plataformas como RD Station e HubSpot já combinam automação, segmentação, campanhas e integração entre marketing e vendas. O WhatsApp Business Platform, por sua vez, oferece APIs para conversas de marketing, vendas e suporte, além de CTAs, listas dinâmicas e mídia rica, o que o torna uma peça importante para a régua conversacional.

---

### 5.10 Módulo de dashboards e gestão executiva

#### Objetivo

Dar visibilidade ao desempenho operacional, comercial e à qualidade da carteira.

#### Indicadores sugeridos

1. Leads por origem.
2. Taxa de conversão por etapa.
3. Produtividade por corretor.
4. Tempo médio por estágio.
5. Fechamento por produto e seguradora.
6. Carteira por semáforo.
7. Oportunidades de upsell e cross-sell.
8. Ações de pós-venda executadas.
9. Score de completude da base.
10. Uso da plataforma por corretor.

#### Requisitos funcionais

O sistema deverá permitir:

1. Dashboards gerenciais.
2. Visão individual do corretor.
3. Filtros por período, região, produto e carteira.
4. Exportação de dados.
5. Acompanhamento de adoção do sistema.

#### Aceleradores de mercado

Power BI se apresenta como plataforma unificada, escalável, para self-service BI e BI corporativo. Looker Studio oferece dashboards e relatórios web com conectores nativos e compartilhamento simples. Em um MVP, ambos podem atender bem a camada analítica, a depender da estratégia de dados e do ambiente tecnológico do projeto.

---

### 5.11 Módulo de assistente inteligente (roadmap evolutivo)

#### Objetivo

Criar uma camada de copiloto para corretores, operação e, futuramente, segurados.

#### Casos prioritários internos

1. Responder dúvidas sobre produtos e coberturas.
2. Resumir perfil do cliente.
3. Sugerir próxima melhor ação.
4. Gerar abordagem comercial.
5. Resumir interações e reuniões.
6. Apoiar onboarding de novos corretores.
7. Consulta guiada ao catálogo.

#### Casos futuros externos

1. Atendimento básico ao segurado.
2. Triagem inicial de dúvidas.
3. Coleta de informações.
4. Direcionamento ao corretor.

#### Observação

Esse módulo deve entrar depois que o core do CRM, catálogo, recomendação e semáforo estiverem maduros.

---

## 6. Requisitos não funcionais

O produto deverá contemplar:

1. Interface simples e responsiva.
2. Boa experiência para uso diário por perfis não técnicos.
3. Segurança de acesso e trilhas de auditoria.
4. Estrutura preparada para integração.
5. Capacidade de importação e exportação.
6. Versionamento mínimo de regras de negócio.
7. Observabilidade e logs de execução.
8. Segregação de dados por perfil e carteira.
9. Aderência a políticas de tratamento de dados.

---

## 7. Modelo de acelerador recomendado

### 7.1 Princípio orientador

A recomendação é seguir o racional **buy, integrate and differentiate**:

1. Comprar o que já está resolvido pelo mercado.
2. Integrar as peças para formar uma jornada fluida.
3. Desenvolver apenas o que gera diferenciação real.

Isso reduz custo, risco e tempo de implantação.

### 7.2 O que comprar

#### CRM e pipeline

Opções viáveis:

1. HubSpot.
2. Pipedrive.
3. Salesforce Sales Cloud.
4. RD Station CRM, em cenários mais enxutos.

Esses produtos já oferecem pipeline, negócios, atividades, automações, visibilidade comercial e, em alguns casos, IA embarcada.

#### Automação e relacionamento

Opções viáveis:

1. HubSpot Marketing.
2. RD Station Marketing.
3. Motor de campanhas acoplado ao CRM, dependendo da escolha.

RD Station posiciona sua oferta com automação, segmentação e integração marketing–vendas. HubSpot trabalha marketing, vendas e service sobre a mesma base CRM.

#### Mensageria

Opção preferencial:

1. WhatsApp Business Platform por API oficial, via parceiro ou integração dedicada.

A plataforma oficial da Meta suporta conversas comerciais, marketing, suporte e fluxos interativos.

#### Analytics

Opções viáveis:

1. Power BI.
2. Looker Studio.

A escolha deve observar custos, familiaridade interna, governança e integrações disponíveis.

### 7.3 O que desenvolver

**Desenvolvimento proprietário recomendado:**

1. Modelo de perfil enriquecido orientado a seguros.
2. Motor de recomendação consultiva.
3. Semáforo de adequação.
4. Motor de priorização de oportunidades.
5. Catálogo especializado de produtos e regras.
6. Camada de experiência que consolide visão do corretor.
7. Assistente inteligente acoplado ao contexto do projeto, em fase posterior.

### 7.4 O que usar IA para potencializar

#### IA de curto prazo

1. Resumo do perfil do cliente.
2. Geração de argumentos de venda.
3. Sugestões de abordagem.
4. Resumo de reuniões e mensagens.
5. Geração de campanhas personalizadas.
6. Classificação de notas de interação.

#### IA de médio prazo

1. Score de propensão por produto.
2. Recomendação mais refinada.
3. Sugestão de próxima melhor ação.
4. Detecção de risco de churn.
5. Priorização da carteira.

#### IA de longo prazo

1. Copiloto do corretor.
2. Atendimento inteligente ao segurado.
3. Automação conversacional supervisionada.

---

## 8. Arquitetura funcional recomendada

| Camada | Conteúdo |
| ------ | -------- |
| **1 — Sistemas de base** | CRM, cadastro, pipeline, atividades e campanhas. |
| **2 — Integração** | APIs, conectores, orquestração de dados, mensageria e sincronização com BI. |
| **3 — Inteligência** | Catálogo, motor de regras, recomendador, semáforo, priorização, copiloto. |
| **4 — Analytics e gestão** | Dashboards gerenciais, visão do corretor, acompanhamento de adoção e performance. |

### Exemplo de arranjo pragmático

1. HubSpot ou Pipedrive como CRM operacional.
2. WhatsApp Business Platform para comunicação.
3. Power BI ou Looker Studio para indicadores.
4. Aplicação própria leve para catálogo, recomendação, semáforo e copiloto.
5. Camada de integração para sincronizar dados.

---

## 9. Roadmap sugerido

### Fase 1 — MVP operacional

1. CRM e funil.
2. Cadastro e perfil básico.
3. Interações e agenda.
4. Dashboards iniciais.

### Fase 2 — MVP inteligente

1. Perfil enriquecido.
2. Catálogo estruturado.
3. Recomendação baseada em regras.
4. Régua básica de comunicação.

### Fase 3 — Monetização da carteira

1. Semáforo de adequação.
2. Fila de upsell e cross-sell.
3. Campanhas por contexto.

### Fase 4 — Aceleração por IA

1. Argumentos de venda com IA.
2. Resumo e copiloto.
3. Priorização preditiva.

### Fase 5 — Expansão

1. Assistente interno mais robusto.
2. Eventuais integrações externas.
3. Produto escalável para outras assessorias.

---

## 10. Fatores críticos de sucesso

O projeto só será bem-sucedido se combinar tecnologia com disciplina de operação. Os fatores críticos são:

1. Desenho do MVP com baixo atrito para o corretor.
2. Regras de negócio de seguros bem definidas.
3. Cadastro realmente útil, sem excesso de campos obrigatórios no início.
4. Métricas de adoção desde o primeiro dia.
5. Comunicação clara de valor para a equipe.
6. Backlog incremental, evitando overengineering.

---

## 11. Conclusão

A recomendação estratégica é clara: o projeto deve lançar um produto que use o mercado como acelerador e preserve internamente o que realmente a diferencia.

Em vez de tentar criar um CRM do zero, a melhor rota é construir um ativo digital orientado a seguros sobre fundações já maduras. Isso permite entrar mais rápido em operação, capturar valor em ondas e concentrar investimento no que realmente muda o jogo: inteligência comercial, adequação de cobertura, monetização da carteira e experiência consultiva do corretor.

Se bem executado, esse produto não será apenas uma solução interna. Ele poderá evoluir para um modelo replicável para outras assessorias, abrindo uma avenida de posicionamento para o projeto como plataforma e não apenas como distribuidora.
