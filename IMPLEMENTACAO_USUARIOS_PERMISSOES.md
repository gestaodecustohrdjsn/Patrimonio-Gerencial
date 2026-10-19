# Patrimônio+ — Controle de usuários v1.9.0 (branch de homologação)

**ESTADO: CÓDIGO IMPLEMENTADO EM BRANCH, NÃO HOMOLOGADO, NÃO PUBLICADO EM PRODUÇÃO.**
Branch: `feat/usuarios-permissoes-v1`
API: `3.7.0`. Frontend: `1.9.0`.

## Implementado
- Banco: 34 permissões, 136 regras de perfil, herança e exceções, proteção do último ADMIN, bloqueio de exclusão física de usuários, histórico e e-mail normalizado único.
- API: autenticação legada preservada, permissões efetivas, troca obrigatória, gestão de usuários, redefinição e revogação de sessões; transações atômicas para operações administrativas essenciais.
- UI: acesso inicial para troca de senha, cadastro e gerenciamento de usuários e exceções; controles operacionais por permissão, consulta de Catálogo.
- Testes: suíte unitária de permissão e scripts SQL de diagnóstico pré/pós-migração.
- Guia: `GUIA_INSTALACAO_USUARIOS_1_9_0.md`.

## Pendências de homologação
1. Executar diagnóstico SOMENTE LEITURA `database/tests/015_pre_migracao_usuarios.sql` e verificar esquema real.
2. Validar sintaxe/execução Node localmente com `npm run check` e `npm test`.
3. Verificar integralmente os componentes operacionais e revisar permissões de todos os endpoints, inclusive rotas somente leitura e QR público.
4. Validar SQL no banco de homologação Neon, com backup/snapshot prévio.
5. Testar cadastro de quatro perfis, senha temporária, revogação de sessões, auditoria e regressão.
6. Validar interface em navegador, responsividade e cache.
7. Só então planejar rollout sincronizado API/Frontend e merge.
8. Não executar reset/marco zero, não limpar dados, não executar SQL da migration 015 em produção sem prévia.

**A aplicação principal segue na versão 1.8.1 / API 3.6.0.**
