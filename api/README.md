# Patrimônio+ API 3.5.0 — portátil

Esta API não depende de Supabase Auth nem Neon Auth. A autenticação pertence ao próprio Patrimônio+ e fica armazenada em PostgreSQL padrão.

## Arquitetura
O frontend roda no GitHub Pages, esta API roda no Cloudflare Workers e o PostgreSQL atual está no Neon. A dependência específica do Neon fica isolada em `src/db.js`.

## Banco
As migrations históricas necessárias para a API 3.3 estão em `database/004_auth_portavel.sql`, `database/005_manutencoes.sql` e `database/006_mobilidade_operacional.sql`. A migration 007 do projeto adiciona `CONTRATO_GESTAO` e corrige a exclusão de lote de teste.

## Publicação
1. `npm install`
2. `npm run check`
3. `npx wrangler deploy`
4. Confirme `/health` com `version: 3.5.0`.

Os secrets `DATABASE_URL` e `SETUP_TOKEN` devem permanecer configurados no Worker e não devem ser colocados no repositório.

## Segurança
- PBKDF2-HMAC-SHA256 com salt individual e 310.000 iterações para novas definições de senha.
- Tokens de sessão aleatórios; apenas o SHA-256 do token fica armazenado.
- Sessões expiram em 12 horas por padrão.
- 5 tentativas erradas bloqueiam o login por 15 minutos.
- Exclusão definitiva exige perfil ADMIN.


## Tipo ↔ SIGEM
Quando um patrimônio possui item SIGEM vinculado, a API compara o `tipo_id` informado com o `tipo_id` do catálogo.
Uma divergência só é aceita quando o cliente envia `confirmar_tipo_divergente: true`, permitindo auditoria explícita da exceção.


## Gestão de catálogo e centros
A API 3.5.0 adiciona:
- administração da classificação dos itens SIGEM;
- sincronização dos patrimônios vinculados que ainda seguem a classificação anterior;
- cadastro, edição, ativação e inativação de centros de custo;
- exclusão definitiva de centro somente quando não houver patrimônios, movimentações ou permissões vinculadas.


## Histórico global
A API 3.5.0 adiciona `GET /api/historico` para a Visão Geral.
O endpoint retorna os eventos recentes já registrados em `historico_alteracoes`, com usuário, entidade e detalhes resumidos para exibição no dashboard.


## Atualizador inteligente do Catálogo SIGEM
A API 3.5.0 adiciona o fluxo de atualização controlada do catálogo:
- aliases/de-paras persistentes;
- histórico resumido e detalhado das atualizações;
- aplicação transacional do plano revisado;
- inclusão de novos itens e duplicados autorizados;
- confirmação de itens semelhantes;
- reativação e inativação controladas.

A migration `008_catalogo_sigem_atualizacoes.sql` deve ser aplicada antes da publicação da API 3.5.0.


## Catálogo Geral 1.6.0

A API 3.5.0 substitui o conceito operacional de "Catálogo SIGEM" por um Catálogo único.

Cada item passa a informar:
- descrição;
- Tipo;
- valor de referência;
- origem: SIGEM ou Catálogo Próprio;
- fonte do valor;
- status ativo/inativo.

Regras principais:
- a atualização automática continua sendo específica da fonte SIGEM;
- itens próprios não podem ser alterados pela atualização SIGEM;
- itens próprios podem ser cadastrados, editados, ativados/inativados e, quando nunca utilizados, excluídos;
- novos patrimônios herdam o Tipo do item selecionado no Catálogo;
- alterações de Tipo sincronizam patrimônios vinculados que ainda seguem a classificação anterior;
- cadastro de patrimônio pela API é restrito a ADMIN e AUXILIAR.

A migration `009_catalogo_geral_base_oficial.sql` aplica a base oficial conferida em 16/10/2026:
- 821 itens;
- 814 SIGEM;
- 7 Catálogo Próprio — HRPP;
- 582 Equipamento Médico;
- 199 Mobiliário;
- 40 Equipamento de Informática.


## Importação Patrimonial Segura 1.7.0

A API 3.5.0 adiciona:
- simulação server-side antes de qualquer gravação;
- resolução de item pelo Catálogo e Centro de Custo;
- Tipo sempre herdado do Catálogo;
- validação de aquisição, data, status, conservação e valores;
- detecção de ID SES repetida no arquivo e já existente no banco;
- aplicação final por função PostgreSQL transacional;
- auditoria por lote e por patrimônio importado;
- histórico de importações;
- evento resumido no log global.

A migration `011_importacao_patrimonial_segura.sql` deve ser aplicada antes da publicação da API 3.5.0.
