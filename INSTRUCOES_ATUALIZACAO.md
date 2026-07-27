# Atualização para Patrimônio+ v0.7

Aplique na ordem abaixo: primeiro Supabase, depois GitHub Pages.

## 1. Supabase

1. Abra o projeto no Supabase.
2. Entre em **SQL Editor** e crie uma nova consulta.
3. Confirme que o editor está executando como **postgres**.
4. Abra `database/006_consulta_publica_cadastro_flexivel.sql`.
5. Cole todo o conteúdo e clique em **Run**.
6. O resultado esperado começa com `v0.7 pronta`.

O script preserva os patrimônios e históricos existentes. Ele:

- torna SIGEM e valor opcionais;
- mantém data atual, Bem Conservado e Ativo como padrões;
- cria um token público aleatório para cada patrimônio;
- cria uma consulta pública limitada, sem liberar a tabela inteira;
- permite ao papel `anon` executar somente essa consulta.

Não execute novamente os scripts 003, 004 ou 005.

## 2. GitHub Pages

1. Faça backup do `js/config.js` atualmente publicado.
2. Substitua os arquivos do repositório pelo conteúdo desta pasta.
3. Confirme que `index.html` está na raiz do repositório.
4. Recoloque no novo `js/config.js` a URL e a chave pública do Supabase, caso necessário.
5. Faça o commit e aguarde o GitHub Pages publicar.
6. Abra o sistema com `Ctrl + F5`.

## 3. Testes

### Cadastro flexível

Cadastre um patrimônio preenchendo apenas:

- Tipo;
- Descrição;
- Aquisição;
- Centro de custo.

SIGEM e valor devem permanecer vazios. A data deve vir preenchida com hoje, o estado com **Bem Conservado** e o status com **Ativo**.

### Consulta pública

1. Abra a ficha administrativa do patrimônio.
2. Clique em **Etiqueta / QR**.
3. Escaneie o QR em uma janela anônima ou em outro celular.
4. A ficha pública deve abrir sem login e sem botões de edição.

### Segurança

A URL pública usa um UUID aleatório. A função pública devolve somente uma ficha por token e não concede leitura direta da tabela `patrimonios`.
