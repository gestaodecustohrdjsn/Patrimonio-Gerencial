# Patrimônio+ 1.7.1 / API 3.5.1 — ID SES duplicada controlada

## Regra oficial
- **ID interna:** exclusiva do Patrimônio+ e nunca pode se repetir.
- **ID SES:** pode se repetir, mas a repetição exige revisão/confirmação consciente.

## Ordem de publicação
1. Aplicar `database/migrations/012_id_ses_duplicada_controlada.sql`.
2. Executar `database/tests/013_id_ses_duplicada_controlada.sql`.
3. O teste deve retornar `TESTE_ID_SES_DUPLICADA_CONTROLADA_171_OK`.
4. Publicar API 3.5.1.
5. Confirmar `/health` com versão 3.5.1.
6. Atualizar frontend 1.7.1 / Ctrl+F5.

Use no PowerShell:
`Get-Content <arquivo> -Raw -Encoding UTF8 | Set-Clipboard`

## 1. Importação — grupo repetido somente no arquivo
Simular um CSV onde duas ou mais linhas possuem a mesma ID SES.

O grupo deve permitir:
- **Manter esta ID SES em todos**;
- **Manter apenas nos patrimônios selecionados**;
- **Remover esta ID SES de todos deste grupo**.

Nenhuma escolha deve ser aplicada automaticamente.

## 2. Manter em todos
1. Escolher `Manter esta ID SES em todos`.
2. Confirmar o lote.
3. Todos os patrimônios do grupo devem preservar a mesma ID SES.
4. Cada um deve receber ID interna própria e distinta.

## 3. Manter apenas nos selecionados
1. Escolher `Manter apenas nos patrimônios selecionados`.
2. Marcar um ou mais patrimônios.
3. Sem nenhuma seleção, o lote deve continuar bloqueado.
4. Os selecionados mantêm a ID SES.
5. Os não selecionados entram sem ID SES.

## 4. Remover de todos
1. Escolher `Remover esta ID SES de todos deste grupo`.
2. Todas as linhas daquele grupo devem ser importadas com ID SES vazia.
3. IDs internas continuam sendo geradas normalmente.

## 5. ID SES já existente no banco
1. Simular uma linha cuja ID SES já esteja em outro patrimônio.
2. A tela deve avisar que a identificação já existe.
3. Ainda deve ser permitido:
   - manter a mesma ID SES;
   - selecionar quais linhas novas mantêm;
   - remover das novas linhas.
4. Se mantida, o servidor exige a confirmação explícita do grupo.

## 6. Cadastro manual
1. Criar patrimônio com ID SES já usada.
2. O frontend deve pedir confirmação.
3. Confirmando, o cadastro deve funcionar.
4. Cancelando, nada deve ser salvo.
5. Editar um patrimônio e trocar para ID SES já existente deve seguir a mesma regra.
6. Editar outros campos sem mudar a ID SES repetida não deve ficar pedindo confirmação novamente.

## 7. Banco
O teste 013:
- confirma que não há UNIQUE exclusiva em `id_ses`;
- importa dois patrimônios com a mesma ID SES;
- confirma que ambos coexistem;
- confirma que as duas IDs internas são diferentes e não nulas;
- verifica que não existe ID interna duplicada;
- termina com ROLLBACK.

## Regressão
Confirmar:
- simulação da importação;
- aplicação transacional;
- histórico de importações;
- cadastro manual;
- edição manual;
- pesquisa por ID SES;
- QR Code e ficha usando ID interna normalmente.

## Versões esperadas
- Frontend: 1.7.1
- API: 3.5.1
