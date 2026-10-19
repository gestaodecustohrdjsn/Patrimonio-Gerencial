# Patrimônio+ 1.7.0 / API 3.5.0 — Importação Patrimonial Segura

## Ordem de publicação
1. Aplicar a migration 010 de correção de encoding do Catálogo, se ainda não aplicada.
2. Executar o teste 011.
3. Aplicar `database/migrations/011_importacao_patrimonial_segura.sql`.
4. Executar `database/tests/012_importacao_patrimonial_segura.sql`.
5. Publicar a API 3.5.0.
6. Confirmar `/health` com versão 3.5.0.
7. Abrir frontend 1.7.0 e usar Ctrl+F5.

## Importante para PowerShell
Sempre copiar SQL UTF-8 com:
`Get-Content <arquivo> -Raw -Encoding UTF8 | Set-Clipboard`

## 1. Simulação com arquivo real
Usar o arquivo patrimonial oficial de 2.062 linhas.

1. Abrir Importação.
2. Selecionar o CSV.
3. Confirmar o mapeamento automático:
   - DESCRIÇÃO -> Item do Catálogo;
   - DESCRIÇÃO AUXILIAR -> Descrição complementar;
   - TIPO AQUISIÇÃO -> Aquisição;
   - CENTRO DE CUSTO -> Centro de custo;
   - COD C.C. -> Código do centro;
   - ID SES -> ID SES;
   - DATA DE AQUISIÇÃO -> Data;
   - VALOR DO MATERIAL -> Valor do material/aquisição;
   - VALOR SIGEM -> Valor de referência no arquivo;
   - MARCA / MODELO -> Marca/Modelo;
   - CLASSIFICAÇÃO -> Classificação do arquivo;
   - STATUS -> Status.
4. Clicar em **Simular importação**.
5. Confirmar que nenhum patrimônio novo aparece em Patrimônios.
6. Confirmar que a simulação retorna 2.062 linhas.

## 2. Catálogo
1. Todas as linhas cuja DESCRIÇÃO existe no Catálogo devem ser reconhecidas.
2. O Tipo final deve vir do Catálogo, nunca da coluna CLASSIFICAÇÃO antiga.
3. Divergência de CLASSIFICAÇÃO deve virar apenas aviso.
4. Item não encontrado no Catálogo deve bloquear a importação.

Com a base oficial atual, a expectativa para o arquivo de 2.062 linhas é que todas as descrições sejam encontradas no Catálogo. Se alguma não for, NÃO importar até revisar.

## 3. Centros de custo
1. Centro deve ser localizado por código, nome ou ambos.
2. Se código e nome apontarem para centros diferentes, deve ocorrer erro.
3. Centro não encontrado deve bloquear o lote.
4. Centro inativo não deve ser aceito.

## 4. Valores
1. Se VALOR DO MATERIAL estiver preenchido e válido, ele é o valor de aquisição.
2. Se estiver vazio, usar valor de referência do Catálogo.
3. Se ambos estiverem vazios, permitir a linha com aviso e valor nulo.
4. Divergência entre VALOR SIGEM do arquivo e valor atual do Catálogo deve virar aviso, não erro.

## 5. ID SES duplicada
1. ID repetida dentro do arquivo deve gerar um grupo de revisão.
2. Nenhuma ID deve ser removida automaticamente.
3. Para um grupo apenas do arquivo:
   - escolher qual linha mantém a ID; ou
   - importar todas as linhas sem ID SES.
4. Se a ID já existir no banco:
   - nenhuma linha nova pode mantê-la;
   - somente a opção de importar o grupo sem ID SES deve estar disponível.
5. Enquanto houver grupo sem decisão, o botão final deve permanecer bloqueado.

## 6. Aplicação transacional
1. Após resolver as pendências, confirmar o lote.
2. O servidor deve repetir toda a simulação.
3. O PostgreSQL deve executar o lote por `importar_patrimonios_lote_api`.
4. Se uma única linha falhar, nenhum patrimônio daquele lote deve permanecer.
5. Se concluir, todos os patrimônios devem aparecer juntos.

## 7. Auditoria
Após um lote concluído:
1. Deve aparecer no Histórico de importações.
2. Deve existir registro em `importacoes_patrimoniais`.
3. Deve existir uma linha em `importacao_patrimonial_itens` para cada patrimônio.
4. A Visão Geral deve mostrar o evento **Importou lote patrimonial**.

## 8. Teste de banco
O arquivo `database/tests/012_importacao_patrimonial_segura.sql`:
- importa 2 patrimônios temporários;
- valida cabeçalho, itens e log;
- testa que ID SES duplicada é rejeitada;
- termina com ROLLBACK.

Resultado esperado:
`TESTE_IMPORTACAO_PATRIMONIAL_SEGURA_170_OK`

## 9. Regressão rápida
Confirmar:
- cadastro manual;
- edição;
- movimentação;
- manutenção;
- Catálogo;
- Centros de custo;
- Etiquetas;
- Relatórios;
- QR público;
- perfil CONSULTA sem acesso à Importação.

## Versões
- Frontend: 1.7.0
- API: 3.5.0
