# Patrimônio+ v1.0-portável

## Objetivo
Eliminar dependência direta do frontend com qualquer provedor de banco ou autenticação.

O navegador conhece apenas:

`API_BASE_URL`

Não existem credenciais de PostgreSQL, Supabase ou Neon no GitHub Pages.

## Arquitetura
GitHub Pages → API Patrimônio+ → PostgreSQL

A autenticação agora pertence ao próprio Patrimônio+ e usa a tabela `usuarios` + `sessoes`.

## Publicação
1. Primeiro atualize o banco com `004_auth_portavel.sql` presente no pacote da API.
2. Atualize e publique a API v3.
3. Defina a senha inicial do administrador pelo endpoint seguro de bootstrap.
4. Só então substitua o frontend no GitHub Pages por esta versão.

## Portabilidade
- Trocar domínio da API: alterar somente `js/config.js`.
- Trocar hospedagem da API: o frontend não muda, além da URL.
- Trocar PostgreSQL de provedor: a API concentra a conexão em `src/db.js`.
- Trocar sistema de autenticação no futuro: serviços do frontend continuam chamando a API, não o provedor.
