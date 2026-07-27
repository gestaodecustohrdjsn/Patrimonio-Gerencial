# Patrimônio+ v0.4 — atualização

## Supabase

1. Não execute novamente o arquivo da v0.3.
2. Abra `database/004_catalogo_hrpp.sql`.
3. Cole o conteúdo no SQL Editor e clique em **Run**.
4. O resultado esperado é uma linha com `cadastrar_item_catalogo_hrpp`.

Esse SQL não altera tabelas nem apaga registros. Ele apenas cria uma função segura para itens internos do HRPP.

## GitHub Pages

1. Apague os arquivos da versão publicada, preservando somente o histórico do Git.
2. Envie o conteúdo desta pasta para a raiz do repositório.
3. Confirme que `index.html`, `css/` e `js/` ficaram na raiz.
4. Faça o commit e aguarde o Pages atualizar.
5. Abra o sistema com `Ctrl + F5`.

## Testes

1. Entre com o usuário já criado.
2. Confirme que o dashboard não mostra a contagem do SIGEM.
3. Confirme que o valor total começa oculto.
4. Abra um novo patrimônio e veja os centros apenas pelo nome.
5. Cadastre um bem sem valor de aquisição e sem estado de conservação.
6. Confirme no Table Editor que o valor usado foi o valor de referência e o estado foi `BEM_CONSERVADO`.
7. Pesquise um item inexistente, cadastre-o como item HRPP e reutilize-o em outro patrimônio.
