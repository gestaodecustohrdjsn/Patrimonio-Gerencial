-- Patrimônio+ | Teste de codificação do Catálogo v1.6.1
-- Somente leitura.

DO $catalogo_encoding_test$
BEGIN
  IF (SELECT count(*) FROM descricoes_padrao) <> 821 THEN
    RAISE EXCEPTION 'Esperados 821 itens no Catálogo';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM descricoes_padrao
    WHERE descricao='Aspirador Ultrassônico/ Bisturi Ultrassônico'
  ) THEN
    RAISE EXCEPTION 'Aspirador Ultrassônico/Bisturi Ultrassônico não está em UTF-8 correto';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM descricoes_padrao
    WHERE descricao='Bisturi Elétrico (até 150 W)'
  ) THEN
    RAISE EXCEPTION 'Bisturi Elétrico (até 150 W) não está em UTF-8 correto';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM descricoes_padrao
    WHERE descricao='Bisturi Elétrico - HRPP'
      AND origem_catalogo='PROPRIO'
  ) THEN
    RAISE EXCEPTION 'Item próprio de controle não está em UTF-8 correto';
  END IF;
END;
$catalogo_encoding_test$;

SELECT 'TESTE_CATALOGO_ENCODING_161_OK' AS resultado;
