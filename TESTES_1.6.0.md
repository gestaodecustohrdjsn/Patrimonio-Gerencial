# Patrimônio+ 1.6.0 / API 3.4.0 — Catálogo Geral

## Ordem de publicação
1. Garantir que a migration 008 do atualizador SIGEM já foi aplicada. Se houver dúvida, ela é idempotente e pode ser executada novamente.
2. Aplicar `database/migrations/009_catalogo_geral_base_oficial.sql`.
3. Executar `database/tests/010_catalogo_geral.sql`.
4. O teste deve retornar `TESTE_CATALOGO_GERAL_160_OK`.
5. Publicar a API 3.4.0.
6. Confirmar `/health` com versão 3.4.0.
7. Abrir o frontend 1.6.0 e usar Ctrl+F5.

## 1. Base oficial
Após a migration 009, confirmar:
- Total: 821
- Origem SIGEM: 814
- Catálogo Próprio: 7
- Equipamento Médico: 582
- Mobiliário: 199
- Informática: 40

O arquivo de referência versionado é:
`database/seeds/catalogo_oficial_2026-10-16.csv`.

## 2. Tela Catálogo
1. O menu deve mostrar apenas **Catálogo**.
2. Confirmar cards:
   - Total do Catálogo;
   - Origem SIGEM;
   - Catálogo Próprio;
   - distribuição por Tipo.
3. Pesquisar por nome.
4. Filtrar por origem SIGEM.
5. Filtrar por origem Catálogo Próprio.
6. Combinar filtro de origem + Tipo.
7. Confirmar colunas de origem, valor, fonte, patrimônios vinculados e status.

## 3. Cadastro de item próprio
1. Clicar em **+ Adicionar item**.
2. Testar descrição vazia: deve bloquear.
3. Testar Tipo vazio: deve bloquear.
4. Testar valor negativo ou inválido: deve bloquear.
5. Cadastrar um item de teste com:
   - descrição única;
   - Tipo válido;
   - valor;
   - fonte Cotação própria.
6. Confirmar origem automática **Catálogo Próprio — HRPP**.
7. Confirmar que o item aparece na pesquisa do cadastro de patrimônio.

## 4. Duplicidade
1. Tentar cadastrar novamente exatamente a mesma descrição.
2. A API deve responder que o item já existe.
3. O segundo item não deve ser criado.

## 5. Edição de item próprio
1. Editar descrição, Tipo, valor e fonte.
2. Confirmar atualização imediata na tabela.
3. Se houver patrimônio vinculado ainda usando o Tipo anterior, ele deve acompanhar a mudança.
4. Alterar o status para Inativo.
5. O item inativo deve deixar de aparecer para novos cadastros.
6. Reativar e confirmar o retorno à busca.

## 6. Proteção dos itens SIGEM
1. Alterar apenas o Tipo de um item SIGEM: deve funcionar.
2. Tentar enviar via API alteração manual de descrição ou valor em item SIGEM: deve ser bloqueado.
3. A interface não deve exibir botões de editar/excluir para itens SIGEM.
4. Itens SIGEM devem mostrar **Gerido pela base SIGEM**.

## 7. Exclusão segura de item próprio
1. Criar um item próprio de teste sem vínculo.
2. Excluir digitando exatamente a descrição: deve funcionar.
3. Criar outro item próprio e vinculá-lo a um patrimônio de teste.
4. Tentar excluir: deve ser bloqueado e orientar a inativação.
5. Não excluir patrimônio real para executar esse teste.

## 8. Cadastro de patrimônio usando Catálogo
1. Abrir Novo patrimônio.
2. Confirmar o rótulo **Item do Catálogo**.
3. Pesquisar um item SIGEM.
4. Confirmar Tipo automático e valor de referência.
5. Pesquisar um item próprio HRPP.
6. Confirmar Tipo automático e valor de referência próprio.
7. Deixar valor de aquisição vazio e salvar item de teste:
   - quando houver valor no Catálogo, ele deve ser usado como fallback;
   - quando o item próprio não tiver valor, o patrimônio pode permanecer sem valor.
8. Confirmar que listagem, ficha e QR usam o nome do Catálogo como nome principal.

## 9. Atualização SIGEM isolada
1. Abrir **Atualizar base SIGEM**.
2. Confirmar que o comparador usa apenas itens de origem SIGEM.
3. Marcar arquivo como catálogo completo e confirmar que os 7 itens próprios não aparecem como ausentes.
4. Confirmar que a API rejeita qualquer plano de atualização SIGEM que tente alterar um item de origem PROPRIO.
5. Em uma correspondência exata com valor SIGEM diferente, confirmar que o valor de referência do Catálogo é atualizado.
6. Novos itens vindos do updater devem nascer com:
   - origem SIGEM;
   - fonte do valor SIGEM.

## 10. Log global
Confirmar eventos:
- item adicionado ao Catálogo;
- item editado;
- item excluído;
- atualização da base SIGEM;
- alteração de classificação.

## 11. Permissões
### ADMIN
- pode gerenciar Catálogo;
- pode cadastrar patrimônio;
- pode importar.

### AUXILIAR
- pode cadastrar patrimônio;
- não pode gerenciar Catálogo.

### CONSULTA
- não deve ver botão Novo patrimônio;
- não deve ver Importação no menu;
- API deve responder 403 se tentar cadastrar patrimônio diretamente.

## 12. Regressão rápida
Confirmar:
- login;
- Patrimônios;
- Centros de custo;
- movimentação;
- manutenção;
- Etiquetas;
- Relatórios;
- QR público;
- histórico.

## Versões esperadas
- Frontend: 1.6.0
- API: 3.4.0
