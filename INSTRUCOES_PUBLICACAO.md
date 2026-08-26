# Atualização para o frontend portátil 1.1

## O que esta versão corrige
- Não usa Supabase em runtime.
- O login chama `POST /api/auth/login`.
- Todos os módulos estão em `js/runtime-v11/`, um caminho novo.
- Isso impede que arquivos JavaScript antigos do GitHub Pages/cache sejam reutilizados.

## Publicação recomendada no GitHub

A forma MAIS segura é apagar o conteúdo antigo do repositório (exceto `.git`) e enviar apenas:

- `index.html`
- `VERSAO.txt`
- `assets/`
- `css/`
- `js/`

Se preferir sobrescrever, também funciona porque o novo `index.html` referencia somente `js/runtime-v11/`.

## Depois do commit
1. Aguarde o GitHub Pages concluir o deploy.
2. Abra:
   `https://gestaodecustohrdjsn.github.io/Patrimonio-Gerencial/`
3. Faça `Ctrl + F5`.
4. Na tela de login deve aparecer:
   `Infraestrutura: API Patrimônio+ · build 1.1`
5. O Console NÃO deve tentar acessar nenhum domínio `supabase.co`.

## Login
Use:
- e-mail: `gestaodecustohrdjsn@gmail.com`
- a senha que você definiu via API.

## Se não aparecer “build 1.1”
O GitHub Pages ainda está servindo a versão anterior. Confira Actions/Pages e aguarde o deploy.
