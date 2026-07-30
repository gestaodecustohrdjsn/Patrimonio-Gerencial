# Atualização para Patrimônio+ v0.8

Esta versão consolida a interface e ajusta a etiqueta. **Não há SQL novo.**

## Supabase

Não execute nenhum script. O banco da v0.7 já possui as regras necessárias:

- somente Tipo, Descrição, Aquisição e Centro de Custo obrigatórios;
- SIGEM e valores opcionais;
- data atual, Bem Conservado e Ativo como padrões;
- consulta pública por token.

## GitHub Pages

1. Faça uma cópia do seu `js/config.js` atual.
2. Substitua os arquivos publicados pelo conteúdo desta pasta.
3. Recoloque sua URL e sua chave pública no `js/config.js`, caso necessário.
4. Faça o commit e aguarde o GitHub Pages publicar.
5. Abra o sistema com `Ctrl + F5`.

## Alterações principais

- QR Code da etiqueta 5% menor e centralizado.
- ID interna elevada para centralização no retângulo preto.
- exportação PNG em resolução 3× para impressão mais nítida;
- botão de impressão também pode ser usado para **Salvar como PDF** no navegador;
- formulário de patrimônio com espaçamento e alinhamento refinados;
- consulta pública com destaque visual melhor para a ID interna.

## Testes

1. Abra uma ficha e gere a etiqueta.
2. Confirme a margem ao redor do QR e o alinhamento da ID.
3. Baixe o PNG e abra em tamanho real.
4. Use `Imprimir / Salvar PDF` e escolha “Salvar como PDF”.
5. Abra o QR em janela anônima e confirme que a consulta continua pública.
