# Patrimônio+ 1.5.8 / API 3.3.5 — Atualizador inteligente do Catálogo SIGEM

## Ordem de publicação
1. Aplicar no Neon: `database/migrations/008_catalogo_sigem_atualizacoes.sql`.
2. Executar no Neon: `database/tests/009_catalogo_sigem_atualizacoes.sql`.
3. O teste deve retornar `TESTE_ATUALIZADOR_SIGEM_OK` e não deixa dados gravados.
4. Publicar a API 3.3.5 no Cloudflare.
5. Confirmar `/health` com `version: 3.3.5`.
6. Atualizar o frontend 1.5.8 / Ctrl+F5.

## 1. Arquivo e mapeamento
1. Abrir Catálogo SIGEM > Atualizar catálogo.
2. Carregar CSV UTF-8.
3. Repetir depois com CSV Windows-1252, se disponível.
4. Confirmar leitura de acentos.
5. Conferir detecção automática de:
   - descrição/nome;
   - tipo/classificação;
   - valor, quando existir.
6. Confirmar que a opção "catálogo completo" começa desmarcada.

## 2. Correspondências exatas
1. Usar um arquivo contendo nomes já existentes.
2. Confirmar que aparecem como correspondência exata.
3. A ação padrão deve ser "Não adicionar novamente".
4. Alterar uma linha para "Adicionar mesmo assim" apenas em ambiente de teste e confirmar que exige Tipo.

## 3. De-para / nomes semelhantes
1. Alterar no CSV o nome de um item existente de forma pequena.
2. Confirmar que o sistema sugere até 3 candidatos com percentual.
3. Marcar "É o mesmo item".
4. Confirmar o Tipo final.
5. Aplicar.
6. Confirmar:
   - o UUID do item existente é preservado;
   - o nome oficial passa a ser o novo nome;
   - o nome anterior fica salvo como alias.
7. Em uma nova atualização usando o nome antigo, confirmar que a correspondência ocorre via de-para automaticamente.

## 4. Novos itens
1. Inserir um nome inexistente no CSV.
2. Confirmar que aparece como Novo.
3. Se o Tipo estiver vazio, o sistema deve impedir a confirmação até escolher 1/2/3.
4. Confirmar e verificar o novo item no catálogo.

## 5. Duplicados no próprio arquivo
1. Repetir o mesmo nome duas vezes no CSV.
2. A segunda ocorrência deve aparecer como duplicada.
3. A ação padrão deve ser "Não adicionar".
4. A opção "Adicionar mesmo assim" deve exigir Tipo.

## 6. Catálogo completo / ausentes
1. Marcar que o arquivo representa o catálogo completo.
2. Remover propositalmente um item ativo do CSV.
3. Confirmar que ele aparece em "Itens ausentes".
4. A ação padrão deve ser "Manter ativo".
5. Selecionar "Inativar" somente quando desejado.
6. Confirmar que nada é inativado automaticamente.

## 7. Aplicação transacional
1. Antes de confirmar, conferir a Prévia final.
2. Confirmar que não é possível aplicar enquanto existirem pendências.
3. Aplicar um plano válido.
4. Confirmar toast de sucesso.
5. Confirmar que a atualização aparece no Histórico de atualizações.

## 8. Histórico
1. Abrir "Detalhes" em uma atualização.
2. Conferir ações, nomes, item final, Tipo e similaridade.
3. Voltar à Visão Geral.
4. Confirmar evento "Atualizou Catálogo SIGEM" no histórico global, com resumo.

## 9. Regressão
Confirmar rapidamente:
- login;
- cadastro de patrimônio com SIGEM;
- edição de Tipo divergente;
- Centros de custo;
- Relatórios;
- Etiquetas;
- Importação patrimonial;
- QR público.

## Versões esperadas
- Frontend: 1.5.8
- API /health: 3.3.5
