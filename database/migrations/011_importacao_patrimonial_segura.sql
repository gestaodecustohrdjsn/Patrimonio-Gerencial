-- Patrimônio+ | Importação Patrimonial Segura v1.7.0
-- Lote transacional: ou todos os patrimônios são gravados, ou nenhum é.

BEGIN;

CREATE TABLE IF NOT EXISTS importacoes_patrimoniais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_arquivo text NOT NULL,
  total_linhas integer NOT NULL CHECK (total_linhas > 0),
  total_importado integer NOT NULL DEFAULT 0 CHECK (total_importado >= 0),
  usuario_id uuid REFERENCES usuarios(id),
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_importacoes_patrimoniais_criado_em
  ON importacoes_patrimoniais(criado_em DESC);

CREATE TABLE IF NOT EXISTS importacao_patrimonial_itens (
  id bigserial PRIMARY KEY,
  importacao_id uuid NOT NULL REFERENCES importacoes_patrimoniais(id) ON DELETE CASCADE,
  linha_arquivo integer NOT NULL,
  patrimonio_id uuid NOT NULL REFERENCES patrimonios(id) ON DELETE RESTRICT,
  item_catalogo_id uuid NOT NULL REFERENCES descricoes_padrao(id) ON DELETE RESTRICT,
  centro_custo_id uuid NOT NULL REFERENCES centros_custo(id) ON DELETE RESTRICT,
  id_ses_original text,
  dados_importados jsonb NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(importacao_id, linha_arquivo)
);

CREATE INDEX IF NOT EXISTS idx_importacao_patrimonial_itens_patrimonio
  ON importacao_patrimonial_itens(patrimonio_id);

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

  IF EXISTS(
    SELECT 1
    FROM (
      SELECT lower(btrim(x.id_ses)) AS chave, count(*) AS quantidade
      FROM jsonb_to_recordset(p_linhas) AS x(id_ses text)
      WHERE nullif(btrim(x.id_ses),'') IS NOT NULL
      GROUP BY lower(btrim(x.id_ses))
      HAVING count(*) > 1
    ) d
  ) THEN
    RAISE EXCEPTION 'O lote final ainda contém ID SES duplicada';
  END IF;

  IF EXISTS(
    SELECT 1
    FROM jsonb_to_recordset(p_linhas) AS x(id_ses text)
    JOIN patrimonios p
      ON lower(btrim(p.id_ses))=lower(btrim(x.id_ses))
    WHERE nullif(btrim(x.id_ses),'') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'O lote final contém ID SES já existente no banco';
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

    IF v_tipo_aquisicao NOT IN ('COMPRA','DOACAO','LOCACAO','CONTRATO_GESTAO') THEN
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

SELECT 'IMPORTACAO_PATRIMONIAL_SEGURA_170_OK' AS resultado;
