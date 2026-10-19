-- Patrimônio+ | Teste de ID SES duplicada controlada v1.7.1
-- Insere dois patrimônios com a mesma ID SES dentro de BEGIN/ROLLBACK.

BEGIN;

DO $id_ses_duplicada_test$
DECLARE
  v_usuario_id uuid;
  v_catalogo_id uuid;
  v_centro_id uuid;
  v_id_ses text;
  v_resultado jsonb;
  v_total integer;
  v_ids_internas integer;
  v_nulas integer;
  v_attnum smallint;
BEGIN
  SELECT id INTO v_usuario_id
  FROM usuarios
  WHERE ativo=true AND perfil IN ('ADMIN','AUXILIAR')
  ORDER BY id
  LIMIT 1;

  SELECT id INTO v_catalogo_id
  FROM descricoes_padrao
  WHERE ativo=true
  ORDER BY descricao
  LIMIT 1;

  SELECT id INTO v_centro_id
  FROM centros_custo
  WHERE ativo=true
  ORDER BY nome
  LIMIT 1;

  IF v_usuario_id IS NULL OR v_catalogo_id IS NULL OR v_centro_id IS NULL THEN
    RAISE EXCEPTION 'Faltam usuário, item de Catálogo ou Centro de Custo para o teste';
  END IF;

  SELECT attnum INTO v_attnum
  FROM pg_attribute
  WHERE attrelid='patrimonios'::regclass
    AND attname='id_ses'
    AND NOT attisdropped;

  IF EXISTS(
    SELECT 1
    FROM pg_constraint
    WHERE conrelid='patrimonios'::regclass
      AND contype='u'
      AND conkey=ARRAY[v_attnum]::smallint[]
  ) THEN
    RAISE EXCEPTION 'Ainda existe constraint UNIQUE exclusiva para id_ses';
  END IF;

  IF EXISTS(
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid='patrimonios'::regclass
      AND i.indisunique
      AND i.indnkeyatts=1
      AND i.indkey[0]=v_attnum
  ) THEN
    RAISE EXCEPTION 'Ainda existe índice UNIQUE exclusivo para id_ses';
  END IF;

  v_id_ses := 'TEST-SES-DUP-' || left(gen_random_uuid()::text,8);

  SELECT importar_patrimonios_lote_api(
    'TESTE_ID_SES_DUPLICADA_171.csv',
    jsonb_build_array(
      jsonb_build_object(
        'linha',2,
        'id_ses',v_id_ses,
        'descricao_complementar','Teste SES duplicada A',
        'descricao_padrao_id',v_catalogo_id,
        'data_aquisicao',current_date::text,
        'valor_aquisicao',100,
        'centro_custo_id',v_centro_id,
        'tipo_aquisicao','COMPRA',
        'status','ATIVO',
        'estado_conservacao','BEM_CONSERVADO'
      ),
      jsonb_build_object(
        'linha',3,
        'id_ses',v_id_ses,
        'descricao_complementar','Teste SES duplicada B',
        'descricao_padrao_id',v_catalogo_id,
        'data_aquisicao',current_date::text,
        'valor_aquisicao',200,
        'centro_custo_id',v_centro_id,
        'tipo_aquisicao','COMPRA',
        'status','ATIVO',
        'estado_conservacao','BEM_CONSERVADO'
      )
    ),
    v_usuario_id
  ) INTO v_resultado;

  IF coalesce((v_resultado->>'ok')::boolean,false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Importador não aceitou a ID SES repetida';
  END IF;

  SELECT count(*),count(DISTINCT id_interna),count(*) FILTER (WHERE id_interna IS NULL)
    INTO v_total,v_ids_internas,v_nulas
  FROM patrimonios
  WHERE id_ses=v_id_ses;

  IF v_total <> 2 THEN
    RAISE EXCEPTION 'Esperados 2 patrimônios com a mesma ID SES, encontrados %',v_total;
  END IF;

  IF v_ids_internas <> 2 OR v_nulas <> 0 THEN
    RAISE EXCEPTION 'As IDs internas não foram geradas de forma exclusiva';
  END IF;

  IF EXISTS(
    SELECT id_interna
    FROM patrimonios
    WHERE id_interna IS NOT NULL
    GROUP BY id_interna
    HAVING count(*)>1
  ) THEN
    RAISE EXCEPTION 'Há ID interna duplicada no banco';
  END IF;
END;
$id_ses_duplicada_test$;

ROLLBACK;

SELECT 'TESTE_ID_SES_DUPLICADA_CONTROLADA_171_OK' AS resultado;
