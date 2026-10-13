-- Patrimônio+ | Migration 007
-- Adiciona "Contrato de Gestão" às formas de aquisição
-- e corrige a exclusão de lotes de importação de teste.
--
-- Aplicar no Neon antes de usar CONTRATO_GESTAO no frontend/API.

-- 1) Novo valor do enum.
-- Em PostgreSQL, o novo valor deve ser incluído antes de registros passarem a utilizá-lo.
ALTER TYPE tipo_aquisicao ADD VALUE IF NOT EXISTS 'CONTRATO_GESTAO';

-- 2) Corrige a rotina de exclusão do lote de teste.
-- importacao_linhas.patrimonio_id referencia patrimonios(id), portanto a referência
-- precisa ser limpa antes de excluir os patrimônios do lote.
CREATE OR REPLACE FUNCTION excluir_lote_importacao_teste(
  p_importacao_id uuid,
  p_confirmacao text
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_quantidade integer := 0;
BEGIN
  IF upper(btrim(coalesce(p_confirmacao, ''))) <> 'EXCLUIR LOTE' THEN
    RAISE EXCEPTION 'Confirmação inválida';
  END IF;

  SELECT count(*)::integer
    INTO v_quantidade
  FROM patrimonios
  WHERE importacao_id = p_importacao_id;

  -- Solta a referência antes da exclusão física dos patrimônios.
  UPDATE importacao_linhas il
     SET patrimonio_id = NULL
  FROM patrimonios p
  WHERE il.patrimonio_id = p.id
    AND p.importacao_id = p_importacao_id;

  DELETE FROM historico_alteracoes h
  USING patrimonios p
  WHERE h.tabela = 'patrimonios'
    AND h.registro_id = p.id
    AND p.importacao_id = p_importacao_id;

  DELETE FROM movimentacoes m
  USING patrimonios p
  WHERE m.patrimonio_id = p.id
    AND p.importacao_id = p_importacao_id;

  DELETE FROM patrimonios
  WHERE importacao_id = p_importacao_id;

  UPDATE importacoes
     SET status = 'CANCELADA',
         quantidade_excluida = v_quantidade,
         quantidade_importada = 0,
         excluido_em = now()
   WHERE id = p_importacao_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote de importação não encontrado';
  END IF;

  RETURN v_quantidade;
END;
$$;
