# Patrimônio+ API v3 — portátil

Esta versão não depende de Supabase Auth nem Neon Auth.
A autenticação pertence ao próprio Patrimônio+ e fica armazenada em PostgreSQL padrão.

## Dependência de provedor
A única dependência atual do Neon está em `src/db.js`, porque o Cloudflare Worker precisa de um driver HTTP para alcançar o PostgreSQL Neon.
Se o banco mudar de provedor, substituímos essa camada; rotas, frontend, autenticação e regras não precisam ser reescritas.

## Instalação
1. Execute `database/004_auth_portavel.sql` no SQL Editor do PostgreSQL.
2. Na pasta da API, rode `npm install`.
3. O secret `DATABASE_URL` já pode permanecer no Cloudflare.
4. Crie um segredo de bootstrap: `npx wrangler secret put SETUP_TOKEN`.
5. Faça deploy: `npx wrangler deploy`.
6. Confirme `/health` com `version: 3.0.0`.

## Definir a senha inicial do administrador
Escolha uma senha forte com 10+ caracteres. No PowerShell:

```powershell
$headers = @{ "X-Setup-Token" = "SEU_SETUP_TOKEN"; "Content-Type" = "application/json" }
$body = @{ email = "gestaodecustohrdjsn@gmail.com"; password = "SUA_SENHA" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "https://patrimonio-api.patrimonio-gerencial.workers.dev/api/auth/setup-password" -Headers $headers -Body $body
```

Depois disso, o login do frontend usa e-mail + essa senha.

## Segurança implementada
- PBKDF2-HMAC-SHA256 com salt individual e 310.000 iterações.
- Tokens de sessão aleatórios; só o SHA-256 do token fica no banco.
- Sessões expiram em 12 horas por padrão.
- 5 tentativas erradas bloqueiam login por 15 minutos.
- Exclusão definitiva exige perfil ADMIN.
