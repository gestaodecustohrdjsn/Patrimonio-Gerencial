-- Patrimônio+ | Teste das configurações de documentos v1.8.0
-- Não deixa alterações persistentes.

BEGIN;

DO $config_doc_test$
DECLARE
  v_id uuid;
  v_original jsonb;
BEGIN
  SELECT id,valor INTO v_id,v_original
  FROM configuracoes_sistema
  WHERE chave='RELACAO_PATRIMONIAL';

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Configuração RELACAO_PATRIMONIAL não encontrada';
  END IF;

  IF coalesce(v_original->>'titulo','')='' THEN
    RAISE EXCEPTION 'Título padrão não foi definido';
  END IF;

  IF jsonb_typeof(v_original->'colunas') <> 'object' THEN
    RAISE EXCEPTION 'Configuração de colunas inválida';
  END IF;

  IF coalesce((v_original#>>'{colunas,id_interna}')::boolean,false) IS NOT TRUE THEN
    RAISE EXCEPTION 'ID interna deveria vir habilitada por padrão';
  END IF;

  UPDATE configuracoes_sistema
  SET valor=jsonb_set(v_original,'{unidade}','"TESTE 1.8.0"'::jsonb,true),
      atualizado_em=now()
  WHERE chave='RELACAO_PATRIMONIAL';

  IF NOT EXISTS(
    SELECT 1
    FROM configuracoes_sistema
    WHERE id=v_id
      AND chave='RELACAO_PATRIMONIAL'
      AND valor->>'unidade'='TESTE 1.8.0'
  ) THEN
    RAISE EXCEPTION 'Atualização da configuração não funcionou';
  END IF;
END;
$config_doc_test$;

ROLLBACK;

SELECT 'TESTE_CONFIGURACOES_DOCUMENTOS_180_OK' AS resultado;
