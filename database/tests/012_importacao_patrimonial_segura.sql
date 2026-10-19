-- Patrimônio+ | Teste da Importação Patrimonial Segura v1.7.0
-- Executa lote real dentro de BEGIN/ROLLBACK e não deixa dados gravados.

BEGIN;

DO $importacao_segura_test$
DECLARE
  v_usuario_id uuid;
  v_catalogo_id uuid;
  v_centro_id uuid;
  v_antes integer;
  v_resultado jsonb;
  v_importacao_id uuid;
  v_id_a text;
  v_id_b text;
  v_id_dup text;
BEGIN
  SELECT id INTO v_usuario_id
  FROM usuarios
  WHERE ativo=true AND perfil IN ('ADMIN','AUXILIAR')
  ORDER BY id
  LIMIT 1;

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum usuário ADMIN/AUXILIAR ativo encontrado para o teste';
  END IF;

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

  IF v_catalogo_id IS NULL OR v_centro_id IS NULL THEN
    RAISE EXCEPTION 'Faltam item de Catálogo ou Centro de Custo ativo para o teste';
  END IF;

  v_id_a := 'TEST-170-A-' || left(gen_random_uuid()::text,8);
  v_id_b := 'TEST-170-B-' || left(gen_random_uuid()::text,8);
  v_id_dup := 'TEST-170-D-' || left(gen_random_uuid()::text,8);

  SELECT count(*) INTO v_antes FROM patrimonios;

  SELECT importar_patrimonios_lote_api(
    'TESTE_IMPORTACAO_SEGURA_170.csv',
    jsonb_build_array(
      jsonb_build_object(
        'linha',2,
        'id_ses',v_id_a,
        'descricao_complementar','Teste importação segura A',
        'descricao_padrao_id',v_catalogo_id,
        'data_aquisicao',current_date::text,
        'valor_aquisicao',123.45,
        'nota_fiscal_numero','NF-TESTE-A',
        'centro_custo_id',v_centro_id,
        'marca_modelo','MODELO TESTE A',
        'tipo_aquisicao','COMPRA',
        'status','ATIVO',
        'estado_conservacao','BEM_CONSERVADO'
      ),
      jsonb_build_object(
        'linha',3,
        'id_ses',v_id_b,
        'descricao_complementar','Teste importação segura B',
        'descricao_padrao_id',v_catalogo_id,
        'data_aquisicao',current_date::text,
        'valor_aquisicao',null,
        'nota_fiscal_numero',null,
        'centro_custo_id',v_centro_id,
        'marca_modelo','MODELO TESTE B',
        'tipo_aquisicao','CONTRATO_GESTAO',
        'status','ATIVO',
        'estado_conservacao','BEM_CONSERVADO'
      )
    ),
    v_usuario_id
  ) INTO v_resultado;

  IF coalesce((v_resultado->>'ok')::boolean,false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Importador não retornou ok=true';
  END IF;

  IF (v_resultado->>'total_importado')::integer <> 2 THEN
    RAISE EXCEPTION 'Quantidade importada incorreta: %', v_resultado;
  END IF;

  IF (SELECT count(*) FROM patrimonios) <> v_antes + 2 THEN
    RAISE EXCEPTION 'Os dois patrimônios de teste não foram inseridos';
  END IF;

  v_importacao_id := (v_resultado->>'importacao_id')::uuid;

  IF NOT EXISTS(
    SELECT 1 FROM importacoes_patrimoniais
    WHERE id=v_importacao_id AND total_importado=2
  ) THEN
    RAISE EXCEPTION 'Cabeçalho da importação não foi registrado';
  END IF;

  IF (SELECT count(*) FROM importacao_patrimonial_itens WHERE importacao_id=v_importacao_id) <> 2 THEN
    RAISE EXCEPTION 'Itens da importação não foram registrados';
  END IF;

  IF NOT EXISTS(
    SELECT 1 FROM historico_alteracoes
    WHERE tabela='importacoes_patrimoniais'
      AND registro_id=v_importacao_id
      AND operacao='IMPORTACAO_PATRIMONIAL_CONCLUIDA'
  ) THEN
    RAISE EXCEPTION 'Log global da importação não foi registrado';
  END IF;

  BEGIN
    PERFORM importar_patrimonios_lote_api(
      'TESTE_DUPLICIDADE_170.csv',
      jsonb_build_array(
        jsonb_build_object(
          'linha',2,'id_ses',v_id_dup,'descricao_complementar','Duplicado A',
          'descricao_padrao_id',v_catalogo_id,'data_aquisicao',current_date::text,
          'centro_custo_id',v_centro_id,'tipo_aquisicao','COMPRA',
          'status','ATIVO','estado_conservacao','BEM_CONSERVADO'
        ),
        jsonb_build_object(
          'linha',3,'id_ses',v_id_dup,'descricao_complementar','Duplicado B',
          'descricao_padrao_id',v_catalogo_id,'data_aquisicao',current_date::text,
          'centro_custo_id',v_centro_id,'tipo_aquisicao','COMPRA',
          'status','ATIVO','estado_conservacao','BEM_CONSERVADO'
        )
      ),
      v_usuario_id
    );
    RAISE EXCEPTION 'FALHA_TESTE: lote com ID SES duplicada foi aceito';
  EXCEPTION WHEN OTHERS THEN
    IF position('duplicada' in lower(SQLERRM))=0 THEN
      RAISE;
    END IF;
  END;
END;
$importacao_segura_test$;

ROLLBACK;

SELECT 'TESTE_IMPORTACAO_PATRIMONIAL_SEGURA_170_OK' AS resultado;
