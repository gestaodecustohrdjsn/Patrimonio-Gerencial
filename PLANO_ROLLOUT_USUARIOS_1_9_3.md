# Patrimônio+ — Plano de publicação controlada 1.9.3 / API 3.7.0

**NÃO EXECUTAR TODOS OS PASSOS DE UMA VEZ.** O sistema de produção continua na versão antiga até confirmação dos testes finais.

## Estado do pacote
- Frontend 1.9.3, API 3.7.0 na branch feat/usuarios-permissoes-v1.
- Migration 015 aprovada em branch Neon de homologação.
- Teste unitário do motor de permissões executado localmente; validação completa do novo editor ainda pendente.
- Ambiente Cloudflare de produção e GitHub Pages NÃO foram alterados por este pacote.

## 1. Atualização local (PowerShell na raiz do repo)
```powershell
git status -sb
git -c maintenance.auto=false -c gc.auto=0 pull --ff-only
cd .\api
npm run check
npm test
cd ..
```
Não adicione .dev.vars, config.js local, package-lock nem credenciais em commits.
O GitHub já recebeu commits; não executar push de alterações locais nesta etapa.

## 2. Homologação funcional da nova UI na branch do Neon
Mantenha localmente `api/.dev.vars` apontando APENAS para a branch de testes do Neon.
```powershell
cd .\api
npx wrangler dev --local --port 8787
```
Em outra janela, na raiz:
```powershell
py -m http.server 5500
```
Teste:
- Login ADMIN e OPERADOR sem F5; nome e perfil aparecem no rodapé.
- Nova listagem, busca, filtros por perfis, indicadores e cadastro recolhível.
- Nova ficha em abas Dados e acesso / Permissões.
- Valores herdados condizem com as regras de perfil, e exceções mudam permissões efetivas.
- Bloquear e restaurar `patrimonios.movimentar` sem movimentar um bem.
- Alteração de perfil limpa exceções; sessões antigas são revogadas.
- Bloqueio de edição do próprio ADMIN e proteção do último administrador.
- CONSULTA não recebe escrita.
- Senha temporária obriga alteração no primeiro acesso; nova senha permite reentrada.
- Validação de outros módulos (etiquetas, catálogo, histórico, relatórios) sem modificar produção.

## 3. Pré-requisitos obrigatórios para produção
1. Capturar backup/snapshot ATUAL da branch Neon production. O backup da homologação não substitui backup recente pré-deploy.
2. Executar diagnóstico `database/tests/015_pre_migracao_usuarios.sql` na branch production e verificar dados novamente.
3. Validar que a aplicação de produção e o usuário ADMIN estão ativos.
4. Testar rollback e garantir acesso a credenciais Cloudflare existentes.
5. Confirmar que frontend e API serão publicados de maneira coordenada.
6. Fazer janela de implantação com interrupção controlada do uso e acesso para validação.

## 4. SQL na production (SÓ APÓS homologação e confirmação explícita)
Selecionar branch **production** no Neon SQL Editor. PowerShell, raiz:
```powershell
Get-Content ".\database\migrations\015_usuarios_permissoes.sql" -Raw -Encoding UTF8 | Set-Clipboard
```
Cole, execute, confira `PERMISSOES_015_OK`, 34 permissões, 136 regras, ao menos 1 ADMIN ativo.
Depois verifique:
```powershell
Get-Content ".\database\tests\015_usuarios_permissoes.sql" -Raw -Encoding UTF8 | Set-Clipboard
```
A migration é transacional e não requer reset ou limpeza de patrimônios.

## 5. Cloudflare Worker API de produção (SÓ DEPOIS da migration production)
ATENÇÃO: `api/wrangler.toml` aponta para o Worker `patrimonio-api` de produção.
`npx wrangler deploy` altera a API publicada! NÃO EXECUTE sem autorização de implantação.
Depois de revisar o diff, o secret DATABASE_URL existente (NÃO substituir), backup e checagens:
```powershell
cd .\api
npm run check
npm test
npx wrangler whoami
npx wrangler deploy
```
Validar `/health` retornando API 3.7.0 e números esperados.
Em falha, restaurar imediatamente o Worker anterior e o banco conforme diagnóstico e plano de rollback; cuidado: uma migração aplicada pode exigir compatibilidade temporária entre versões.

## 6. Frontend GitHub Pages (SÓ DEPOIS da validação da API)
As alterações estão em branch separada e ainda NÃO estão no Pages.
Conferir qual branch publica o Pages. Integrar `feat/usuarios-permissoes-v1` na branch de publicação através de PR revisado; não sobrescrever `js/runtime-v153/config.js` com localhost.
Validar URL pública em janela anônima, novo login, menu de usuário e ações permitidas/bloqueadas.

## Segurança e boas práticas
- NUNCA versionar .dev.vars, DATABASE_URL, cookies, tokens ou senha.
- NUNCA executar scripts de marco zero, truncamento, limpeza em massa.
- Sem `git reset --hard` ou `git clean -fd` para resolver divergências locais.
- Erros em ambiente de produção: interromper rollout e coletar logs sem expor segredos.

## Situação
Aguardando validação manual da UI 1.9.3 e autorização para a janela de publicação em production.
