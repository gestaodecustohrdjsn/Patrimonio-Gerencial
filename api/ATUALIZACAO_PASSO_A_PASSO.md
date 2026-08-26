# Atualização da API v3

1. Neon SQL Editor: execute `database/004_auth_portavel.sql`.
2. Na pasta da API: `npm install`.
3. Crie o segredo de configuração inicial: `npx wrangler secret put SETUP_TOKEN`.
4. Use uma frase aleatória longa como SETUP_TOKEN e guarde-a apenas até definir a senha inicial.
5. Deploy: `npx wrangler deploy`.
6. Abra `/health` e confirme `version: 3.0.0`.
7. Defina a senha do administrador usando o exemplo do `README.md`.
8. Teste login no frontend após publicá-lo.

O antigo Neon Auth pode permanecer criado, mas não é necessário para a aplicação. Isso é proposital para reduzir dependência de fornecedor.
