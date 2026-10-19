# Patrimônio+ — Usuários e Permissões v1 (branch de implementação)

## Estado
**EM DESENVOLVIMENTO — NÃO PUBLICAR / NÃO EXECUTAR EM PRODUÇÃO.**

Fundação preparada:
- Migration `015_usuarios_permissoes.sql` (34 permissões, 4 perfis, 136 padrões).
- Motor `api/src/permissions.js` com regra de exceção individual e proteção de privilégios exclusivos.
- Teste unitário de regras `api/tests/permissions.test.js` (ainda não executado em CI).
- Rotas iniciais de gestão de usuários e senha temporária no backend.
- Conversão das verificações legadas explícitas de perfil em permissões na API.
- Login obtém permissões efetivas no endpoint `/api/me`.

## Pendências BLOQUEANTES antes de usar
1. Finalizar e validar tela de troca de senha inicial; gravação foi bloqueada durante a preparação.
2. Implementar interface administrativa de usuários e editor das permissões individuais.
3. Revisar TODAS as rotas GET e POST para autorização e regras de leitura do Histórico Geral.
4. Garantir operações administrativas atômicas (transações) e proteção concorrente do último administrador.
5. Revisar segurança e política de redefinição de senha; rotas legadas `setup-password`.
6. Revisar persistência do histórico (sem senha ou token), migração de perfil AUXILIAR e compatibilidade.
7. Verificar schema real Neon; a migration NÃO foi executada no banco.
8. Executar testes SQL, unitários, integração e regressão dos fluxos existentes.
9. Atualizar cache frontend, versão e documentação SOMENTE após conclusão e homologação.
10. Publicar API e frontend de forma coordenada. Não liberar funcionalidades parcialmente.

## Checklist aprovado, ainda não homologado
- Criar usuário com senha temporária; trocar no primeiro acesso.
- Impedir qualquer rota operacional antes da troca da senha.
- Permissão herdada e exceções individuais de permissão e bloqueio.
- CONSULTA sempre leitura; operações exclusivas ADMIN.
- Desativação, revogação de sessões e último administrador protegido.
- Auditabilidade, limites e proteção de dados sensíveis.
- Regressão da importação, manutenções, etiquetas e relatórios.

**Não marcar nenhum dos itens acima como aprovado sem execução efetiva.**
