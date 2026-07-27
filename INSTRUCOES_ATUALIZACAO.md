# Atualização para a v0.6

## 1. Supabase

1. Abra o **SQL Editor**.
2. Confirme que a consulta será executada como `postgres`.
3. Abra `database/005_status_remocao_qr.sql`.
4. Copie todo o conteúdo e execute.
5. O resultado esperado contém `v0.6 pronta`.

O script preserva os patrimônios existentes e acrescenta apenas os campos e funções necessários para remoção segura.

## 2. GitHub Pages

1. Só publique depois de o SQL terminar sem erro.
2. Substitua os arquivos da versão atual pelo conteúdo desta pasta.
3. Preserve `js/config.js` com a Project URL e a chave pública atuais.
4. Confirme que `index.html` está na raiz e que existe `assets/layout-etiqueta-patrimonio.png`.
5. Faça o commit, aguarde o Pages e abra com `Ctrl + F5`.

## 3. Testes

1. Use a busca superior com ID interna, SES, descrição, item SIGEM/HRPP, marca ou centro.
2. Abra uma ficha e teste **Inativar** e **Ativar**; confira a linha do tempo.
3. Clique em **Remover** e depois em **Ver removidos** na listagem.
4. Restaure o registro.
5. Para um bem exclusivamente de teste, remova-o e use **Excluir definitivamente**; digite `EXCLUIR`.
6. Gere a etiqueta, confira QR e ID, baixe o PNG e teste a impressão.
7. No novo cadastro, selecione primeiro o Tipo e use o botão `+` para adicionar um item HRPP.

## Observação sobre o QR Code

O endereço usa `#/p/ID_INTERNA`, formato compatível com GitHub Pages. Caso o usuário não esteja autenticado, o sistema mostra o login e abre a ficha após a autenticação.
