# Patrimônio+ v0.2

Versão conectada ao Supabase com autenticação, sessão persistente, dashboard real, centros de custo, pesquisa SIGEM sob demanda e cadastro de patrimônio.

## Configuração

1. Abra `js/config.js`.
2. Preencha `SUPABASE_URL` com a Project URL.
3. Preencha `SUPABASE_ANON_KEY` com a Publishable Key.
4. Nunca use a Secret Key no frontend.
5. Abra o projeto por um servidor HTTP ou publique no GitHub Pages.

## SIGEM

Os 814 itens não são baixados ao abrir o sistema. O dashboard busca apenas a contagem. No cadastro, a pesquisa consulta o Supabase após duas letras e retorna no máximo 20 opções.
