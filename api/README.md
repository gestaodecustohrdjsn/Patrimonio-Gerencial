# Patrimônio+ API 3.3.3 — portátil

Esta API não depende de Supabase Auth nem Neon Auth. A autenticação pertence ao próprio Patrimônio+ e fica armazenada em PostgreSQL padrão.

## Arquitetura
O frontend roda no GitHub Pages, esta API roda no Cloudflare Workers e o PostgreSQL atual está no Neon. A dependência específica do Neon fica isolada em `src/db.js`.

## Banco
As migrations históricas necessárias para a API 3.3 estão em `database/004_auth_portavel.sql`, `database/005_manutencoes.sql` e `database/006_mobilidade_operacional.sql`. A migration 007 do projeto adiciona `CONTRATO_GESTAO` e corrige a exclusão de lote de teste.

## Publicação
1. `npm install`
2. `npm run check`
3. `npx wrangler deploy`
4. Confirme `/health` com `version: 3.3.3`.

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
A API 3.3.3 adiciona:
- administração da classificação dos itens SIGEM;
- sincronização dos patrimônios vinculados que ainda seguem a classificação anterior;
- cadastro, edição, ativação e inativação de centros de custo;
- exclusão definitiva de centro somente quando não houver patrimônios, movimentações ou permissões vinculadas.
