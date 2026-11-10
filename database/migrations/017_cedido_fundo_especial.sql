-- Patrimônio+ | Renomeia aquisição Doação para Cedido Fundo Especial
-- Todos os patrimônios existentes com DOACAO passam automaticamente para
-- CEDIDO_FUNDO_ESPECIAL porque a alteração é feita no próprio enum PostgreSQL.

BEGIN;

DO $rename_tipo_aquisicao$
DECLARE
  v_old_exists boolean;
  v_new_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid=t.oid
    WHERE t.typname='tipo_aquisicao' AND e.enumlabel='DOACAO'
  ) INTO v_old_exists;

  SELECT EXISTS(
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid=t.oid
    WHERE t.typname='tipo_aquisicao' AND e.enumlabel='CEDIDO_FUNDO_ESPECIAL'
  ) INTO v_new_exists;

  IF v_old_exists AND NOT v_new_exists THEN
    ALTER TYPE tipo_aquisicao RENAME VALUE 'DOACAO' TO 'CEDIDO_FUNDO_ESPECIAL';
  ELSIF v_old_exists AND v_new_exists THEN
    RAISE EXCEPTION 'O enum tipo_aquisicao contém DOACAO e CEDIDO_FUNDO_ESPECIAL simultaneamente. Revisão manual necessária.';
  ELSIF NOT v_old_exists AND NOT v_new_exists THEN
    RAISE EXCEPTION 'Nem DOACAO nem CEDIDO_FUNDO_ESPECIAL existem no enum tipo_aquisicao.';
  END IF;
END;
$rename_tipo_aquisicao$;

CREATE OR REPLACE FUNCTION importar_patrimonios_lote_api(
  p_nome_arquivo text,
  p_linhas jsonb,
  p_usuario_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $importacao_segura$
DECLARE
  v_importacao_id uuid;
  v_row jsonb;
  v_total integer;
  v_importados integer := 0;
  v_linha integer;
  v_catalogo_id uuid;
  v_centro_id uuid;
  v_catalogo record;
  v_centro record;
  v_patrimonio_id uuid;
  v_id_ses text;
  v_descricao text;
  v_data date;
  v_valor numeric;
  v_tipo_aquisicao text;
  v_status text;
  v_estado text;
  v_marca text;
  v_nota text;
BEGIN
  IF coalesce(btrim(p_nome_arquivo),'')='' THEN
    RAISE EXCEPTION 'Nome do arquivo é obrigatório';
  END IF;

  IF jsonb_typeof(p_linhas) <> 'array' THEN
    RAISE EXCEPTION 'Lote de importação inválido';
  END IF;

  v_total := jsonb_array_length(p_linhas);
  IF v_total < 1 OR v_total > 5000 THEN
    RAISE EXCEPTION 'Quantidade de linhas inválida: %', v_total;
  END IF;

  IF p_usuario_id IS NULL OR NOT EXISTS(
    SELECT 1 FROM usuarios
    WHERE id=p_usuario_id AND ativo=true AND perfil IN ('ADMIN','AUXILIAR')
  ) THEN
    RAISE EXCEPTION 'Usuário sem permissão para importar patrimônios';
  END IF;

  INSERT INTO importacoes_patrimoniais(
    nome_arquivo,total_linhas,total_importado,usuario_id
  ) VALUES (
    btrim(p_nome_arquivo),v_total,0,p_usuario_id
  )
  RETURNING id INTO v_importacao_id;

  FOR v_row IN
    SELECT value FROM jsonb_array_elements(p_linhas)
  LOOP
    v_linha := nullif(v_row->>'linha','')::integer;
    v_catalogo_id := nullif(v_row->>'descricao_padrao_id','')::uuid;
    v_centro_id := nullif(v_row->>'centro_custo_id','')::uuid;
    v_id_ses := nullif(btrim(coalesce(v_row->>'id_ses','')),'');
    v_descricao := btrim(coalesce(v_row->>'descricao_complementar',''));
    v_tipo_aquisicao := upper(btrim(coalesce(v_row->>'tipo_aquisicao','')));
    -- Compatibilidade com arquivos/clients antigos: o valor legado é convertido,
    -- mas somente CEDIDO_FUNDO_ESPECIAL é persistido no enum.
    IF v_tipo_aquisicao = 'DOACAO' THEN
      v_tipo_aquisicao := 'CEDIDO_FUNDO_ESPECIAL';
    END IF;
    v_status := upper(btrim(coalesce(v_row->>'status','ATIVO')));
    v_estado := upper(btrim(coalesce(v_row->>'estado_conservacao','BEM_CONSERVADO')));
    v_marca := nullif(btrim(coalesce(v_row->>'marca_modelo','')),'');
    v_nota := nullif(btrim(coalesce(v_row->>'nota_fiscal_numero','')),'');

    IF v_linha IS NULL OR v_linha < 2 THEN
      RAISE EXCEPTION 'Linha de origem inválida no lote';
    END IF;

    SELECT id,descricao,tipo_id,valor_padrao,ativo
      INTO v_catalogo
    FROM descricoes_padrao
    WHERE id=v_catalogo_id
    FOR SHARE;

    IF v_catalogo.id IS NULL OR v_catalogo.ativo IS NOT TRUE THEN
      RAISE EXCEPTION 'Linha %: item do Catálogo inexistente ou inativo', v_linha;
    END IF;

    SELECT id,nome,codigo,ativo
      INTO v_centro
    FROM centros_custo
    WHERE id=v_centro_id
    FOR SHARE;

    IF v_centro.id IS NULL OR v_centro.ativo IS NOT TRUE THEN
      RAISE EXCEPTION 'Linha %: centro de custo inexistente ou inativo', v_linha;
    END IF;

    IF v_tipo_aquisicao NOT IN ('COMPRA','CEDIDO_FUNDO_ESPECIAL','LOCACAO','CONTRATO_GESTAO') THEN
      RAISE EXCEPTION 'Linha %: tipo de aquisição inválido', v_linha;
    END IF;

    IF v_status NOT IN ('ATIVO','INATIVO') THEN
      RAISE EXCEPTION 'Linha %: status inválido', v_linha;
    END IF;

    IF v_estado NOT IN ('PRODUTO_NOVO','BEM_CONSERVADO','DESGASTADO','INUTILIZAVEL') THEN
      RAISE EXCEPTION 'Linha %: estado de conservação inválido', v_linha;
    END IF;

    BEGIN
      v_data := coalesce(nullif(v_row->>'data_aquisicao','')::date,current_date);
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Linha %: data de aquisição inválida', v_linha;
    END;

    BEGIN
      v_valor := nullif(v_row->>'valor_aquisicao','')::numeric;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Linha %: valor de aquisição inválido', v_linha;
    END;

    IF v_valor IS NOT NULL AND v_valor < 0 THEN
      RAISE EXCEPTION 'Linha %: valor de aquisição negativo', v_linha;
    END IF;

    IF v_descricao='' THEN
      v_descricao := v_catalogo.descricao;
    END IF;

    INSERT INTO patrimonios(
      id_interna,id_ses,descricao,descricao_padrao_id,data_aquisicao,
      valor_aquisicao,nota_fiscal_numero,centro_custo_id,tipo_id,
      marca_modelo,status,tipo_aquisicao,estado_conservacao,mobilidade,
      criado_por,atualizado_por
    ) VALUES (
      null,v_id_ses,v_descricao,v_catalogo.id,v_data,
      coalesce(v_valor,v_catalogo.valor_padrao),v_nota,v_centro.id,v_catalogo.tipo_id,
      v_marca,v_status::status_patrimonio,v_tipo_aquisicao::tipo_aquisicao,
      v_estado::estado_conservacao,'FIXO',p_usuario_id,p_usuario_id
    )
    RETURNING id INTO v_patrimonio_id;

    INSERT INTO importacao_patrimonial_itens(
      importacao_id,linha_arquivo,patrimonio_id,item_catalogo_id,
      centro_custo_id,id_ses_original,dados_importados
    ) VALUES (
      v_importacao_id,v_linha,v_patrimonio_id,v_catalogo.id,
      v_centro.id,v_id_ses,v_row
    );

    v_importados := v_importados + 1;
  END LOOP;

  IF v_importados <> v_total THEN
    RAISE EXCEPTION 'Quantidade importada divergente: % de %', v_importados, v_total;
  END IF;

  UPDATE importacoes_patrimoniais
  SET total_importado=v_importados
  WHERE id=v_importacao_id;

  INSERT INTO historico_alteracoes(
    tabela,registro_id,operacao,dados_novos,usuario_id
  ) VALUES (
    'importacoes_patrimoniais',
    v_importacao_id,
    'IMPORTACAO_PATRIMONIAL_CONCLUIDA',
    jsonb_build_object(
      'nome_arquivo',btrim(p_nome_arquivo),
      'total_linhas',v_total,
      'total_importado',v_importados
    ),
    p_usuario_id
  );

  RETURN jsonb_build_object(
    'ok',true,
    'importacao_id',v_importacao_id,
    'nome_arquivo',btrim(p_nome_arquivo),
    'total_linhas',v_total,
    'total_importado',v_importados
  );
END;
$importacao_segura$;


COMMIT;

SELECT
  'CEDIDO_FUNDO_ESPECIAL_017_OK' AS resultado,
  count(*) FILTER (WHERE tipo_aquisicao='CEDIDO_FUNDO_ESPECIAL'::tipo_aquisicao)::int AS patrimonios_cedidos_fundo_especial
FROM patrimonios;
