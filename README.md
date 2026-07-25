# Patrimônio+ — versão 0.1

Base inicial do sistema de gestão patrimonial.

## O que já funciona no modo demonstração

- navegação responsiva;
- dashboard;
- tabela de patrimônios;
- busca global;
- cadastro individual;
- geração visual da ID `TMMYYYYNNNN`;
- validação de ID SES duplicado;
- centros de custo iniciais;
- exportação CSV;
- botão Voltar consistente no formulário;
- armazenamento local no navegador.

> O modo demonstração serve para validar a interface. Ele não substitui o PostgreSQL.

## O que já está pronto no banco

O arquivo `sql/schema.sql` cria:

- tipos de patrimônio;
- centros de custo;
- descrições padrão/SIGEM;
- fornecedores;
- patrimônios;
- sequência segura de IDs;
- histórico de alterações;
- estrutura de importação;
- de-para de centros de custo;
- índices;
- políticas iniciais de segurança.

## Como testar agora

1. Extraia a pasta.
2. Abra `index.html` no navegador.
3. Cadastre alguns patrimônios.
4. Pesquise por ID, descrição, centro ou marca.
5. Exporte o CSV.

Para evitar limitações ao abrir arquivos locais, você também pode usar a extensão **Live Server** do VS Code.

## Como publicar no GitHub Pages

1. Crie um repositório no GitHub.
2. Envie todo o conteúdo desta pasta para a raiz do repositório.
3. No GitHub, entre em **Settings → Pages**.
4. Em **Build and deployment**, escolha **Deploy from a branch**.
5. Escolha a branch `main` e a pasta `/root`.
6. Salve.

## Como preparar o Supabase

1. Crie um projeto no Supabase.
2. Abra **SQL Editor**.
3. Execute `sql/schema.sql`.
4. Cadastre pelo menos:
   - centros de custo;
   - descrições padrão/SIGEM.
5. Em **Authentication**, crie o primeiro usuário.
6. Copie `js/config.example.js` para `js/config.js`.
7. Preencha a URL e a chave pública `anon`.
8. Troque `USE_DEMO_MODE` para `false`.

A integração real com o Supabase será o próximo incremento. A chave `anon` pode ficar no frontend apenas quando as políticas RLS estiverem corretamente configuradas. Nunca coloque a `service_role` no GitHub Pages.

## Regra da ID

Formato:

`TMMYYYYNNNN`

Exemplo:

`20520260004`

A função PostgreSQL usa uma operação atômica em `controle_sequencias`, evitando IDs duplicadas quando houver cadastros simultâneos.

## Próximo incremento

- conexão real com Supabase;
- login;
- cadastro administrativo de centros;
- cadastro administrativo de descrições SIGEM;
- persistência PostgreSQL;
- perfis de acesso.
