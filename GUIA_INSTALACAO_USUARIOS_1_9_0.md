# Patrimônio+ — Usuários e Permissões (branch de testes)
Versões previstas: frontend 1.9.0 e API 3.7.0.
Branch: feat/usuarios-permissoes-v1.
**IMPORTANTE: NÃO PUBLICAR API/FRONTEND EM PRODUÇÃO ANTES DA HOMOLOGAÇÃO.**
O SQL altera a tabela de autenticação: faça backup/snapshot do Neon antes de executá-lo.

## 1 — PowerShell / GitHub
Primeira instalação em pasta própria (não executar se já houver clone):
```powershell
cd "$HOME\Documents"
git clone https://github.com/gestaodecustohrdjsn/Patrimonio-Gerencial.git
cd .\Patrimonio-Gerencial
git fetch origin
git switch --track origin/feat/usuarios-permissoes-v1
```
Se já tiver a pasta do repositório, use `cd "SEU_CAMINHO"`, depois:
```powershell
git status
git fetch origin
git switch --track origin/feat/usuarios-permissoes-v1
git pull --ff-only
```
Caso a branch local já exista, use `git switch feat/usuarios-permissoes-v1` antes do `git pull --ff-only`.
Não execute `git push`: as alterações desta versão já estão no GitHub.

## 2 — Conferência sem mudança no banco
```powershell
cd .\api
npm install
npm run check
npm test
cd ..
```
Esperado: zero erros. Se falhar, **não execute SQL/deploy**.

## 3 — Diagnóstico do Neon (somente leitura; pode executar antes do deploy)
A partir da raiz do repositório, copie a prévia sem alteração no banco:
```powershell
Get-Content ".\\database\\tests\\015_pre_migracao_usuarios.sql" -Raw -Encoding UTF8 | Set-Clipboard
```
No Neon, cole no SQL Editor, confirme o banco correto e execute. Confira:
- colunas da tabela `usuarios`, inclusive `criado_em`;
- nenhum e-mail duplicado após normalização;
- ao menos 1 conta `ADMIN` ativa;
- perfis legados presentes e conhecidos.
Se houver divergências, **não execute a migration ainda**.

## 4 — Neon (somente depois de backup e validação de schema)
Abra o SQL Editor do Neon e verifique estar no banco e branch CORRETOS.
No PowerShell, a partir da raiz do repositório:
```powershell
Get-Content ".\database\migrations\015_usuarios_permissoes.sql" -Raw -Encoding UTF8 | Set-Clipboard
```
Cole no SQL Editor do Neon e execute. Copie a verificação:
```powershell
Get-Content ".\database\tests\015_usuarios_permissoes.sql" -Raw -Encoding UTF8 | Set-Clipboard
```
Execute o teste SQL e confira 34 permissões e quatro perfis de 34 regras cada.
**Nunca execute novamente scripts de marco zero, limpeza, truncate ou reset.**

## 5 — Publicação após homologação
A API 3.7.0 exige a migration 015 ANTES do deploy.
O frontend 1.9.0 precisa da API 3.7.0. Não publique um componente isoladamente.
Para deploy do Cloudflare, após validar schema, testes, ambiente, secrets, backup e versão:
```powershell
cd .\api
npx wrangler whoami
npx wrangler deploy
```
Confira o endpoint /health e o login. Depois publique o frontend pela estratégia atual do projeto.
Em ambientes de teste, use um banco Neon separado da produção.

## 6 — Testes obrigatórios
- ADMIN entra e vê Usuários e Permissões.
- ADMIN cadastra OPERADOR temporário, OPERADOR é obrigado a alterar senha no primeiro acesso.
- CONSULTA não altera bens nem recebe exceção individual.
- GESTOR/OPERADOR herdam permissões, aceitam exceções e recebem 403 em ações não autorizadas.
- Ao alterar o perfil, exceções anteriores são removidas.
- Administrador não se desativa nem altera suas próprias permissões.
- Último ADMIN ativo permanece protegido, inclusive sob concorrência.
- Sessões são revogadas após redefinição e alterações de privilégios.
- Histórico Geral não pode ser consultado por perfis sem permissão.
- Histórico administrativo registra alterações sem senha em texto puro.
- Importação, movimentação, manutenção, etiquetas, relatórios e QR seguem funcionando.

## Limites atuais de validação
Validação sintática JavaScript feita na branch. Teste do Neon, fluxos reais e Cloudflare ainda não executados.
Não marcar o módulo como homologado antes dos testes acima.
