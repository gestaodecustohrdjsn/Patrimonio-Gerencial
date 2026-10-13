-- Patrimônio+ | Teste da Migration 007
-- Executar APÓS a migration 007.
-- Não deixa patrimônio gravado: termina com ROLLBACK.

BEGIN;

DO $$
DECLARE
  v_centro uuid;
  v_id uuid;
  v_id_interna text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'tipo_aquisicao'
      AND e.enumlabel = 'CONTRATO_GESTAO'
  ) THEN
    RAISE EXCEPTION 'CONTRATO_GESTAO não existe no enum tipo_aquisicao';
  END IF;

  SELECT id INTO v_centro
  FROM centros_custo
  WHERE ativo = true
  ORDER BY nome
  LIMIT 1;

  IF v_centro IS NULL THEN
    RAISE EXCEPTION 'Nenhum centro de custo ativo disponível para o teste';
  END IF;

  INSERT INTO patrimonios (
    id_interna,
    descricao,
    data_aquisicao,
    centro_custo_id,
    tipo_id,
    tipo_aquisicao
  )
  VALUES (
    NULL,
    'TESTE CONTRATO DE GESTAO',
    current_date,
    v_centro,
    2,
    'CONTRATO_GESTAO'
  )
  RETURNING id, id_interna INTO v_id, v_id_interna;

  IF v_id_interna IS NULL OR btrim(v_id_interna) = '' THEN
    RAISE EXCEPTION 'A ID interna automática não foi gerada';
  END IF;

  RAISE NOTICE 'Contrato de Gestão aceito. ID automática: %', v_id_interna;
END $$;

ROLLBACK;

SELECT 'MIGRATION_007_TEST_OK' AS resultado;
