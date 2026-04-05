# Idioma e localização

## Política

- **Português do Brasil (pt-BR)** é a **única variante de português** usada em textos voltados a pessoas (interface, notas de versão, documentação de produto em português, comunicação no repositório em PT).
- **Outros idiomas** serão acrescentados depois, com **internacionalização (i18n)** na aplicação web (chaves de tradução, não strings fixas em componentes).
- **Código** (nomes de variáveis, funções, comentários técnicos inline): **inglês**, alinhado ao restante do monorepo.

## O que segue pt-BR

- Vocabulário e ortografia do **Brasil** (ex.: usuário, registro, contato, patrimônio, contêiner, por padrão).
- Evitar formas de **português europeu** nos mesmos contextos (ex.: utilizador, registo, contacto, património, contentor, por defeito).

## Documentação em inglês

Alguns documentos técnicos (por exemplo [`IMPLEMENTATION-SPEC.md`](./IMPLEMENTATION-SPEC.md)) permanecem em **inglês** por convenção de engenharia e alinhamento ao código. Quando houver texto em português em qualquer artefato, aplica-se a política **pt-BR** acima.

## Referência para agentes e contribuidores

Ao criar ou revisar **qualquer texto em português** no repositório (Markdown, strings de UI, notas de versão), siga **pt-BR** conforme este documento até existirem locales adicionais configurados no produto.

## Notas de versão (stakeholders)

O arquivo `apps/web/src/content/RELEASE_NOTES.md` é exibido na aplicação a **stakeholders**. **Não** incluir referências a caminhos do repositório, nomes de documentos internos (`docs/…`) nem detalhes de engenharia; a política de idioma para a equipe continua descrita **neste** `LANGUAGE.md`.
