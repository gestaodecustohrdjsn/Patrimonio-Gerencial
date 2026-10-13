# API 3.3.1 — Correção de atualização parcial

## O que muda
- Corrige `PATCH /api/patrimonios/{id}` para preservar campos não enviados.
- Evita apagar centros permitidos em atualizações que não tratam mobilidade.
- Alinha a versão do pacote e `/health` para `3.3.1`.
- Alinha `PASSWORD_ITERATIONS` para `310000`.

## Publicação
1. Confirme que a migration 007 já foi executada no Neon.
2. Na pasta `api`, rode `npm install` (ou `npm ci` quando houver lockfile).
3. Rode `npm run check`.
4. Rode `npx wrangler deploy`.
5. Confirme `/health` com `"version":"3.3.1"`.
6. Teste login, listagem, inativação/reativação, edição e mobilidade antes de importar o lote real.

Não altere `DATABASE_URL`, `SETUP_TOKEN` nem outros secrets existentes.
