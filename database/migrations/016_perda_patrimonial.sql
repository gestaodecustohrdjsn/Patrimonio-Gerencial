-- Patrimônio+ | 016: perda patrimonial formal e termo de perda
BEGIN;

ALTER TABLE patrimonios
  ADD COLUMN IF NOT EXISTS perdido boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS perdido_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_patrimonios_perdido
  ON patrimonios(perdido, perdido_em DESC);

CREATE TABLE IF NOT EXISTS perdas_patrimonio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patrimonio_id uuid NOT NULL UNIQUE REFERENCES patrimonios(id) ON DELETE RESTRICT,
  centro_custo_id uuid REFERENCES centros_custo(id) ON DELETE SET NULL,
  centro_custo_nome text NOT NULL,
  motivo text NOT NULL CHECK (motivo IN ('ROUBO_FURTO','DANO_IRREPARAVEL','EXTRAVIO','OUTRO')),
  motivo_detalhe text,
  data_ocorrencia date NOT NULL DEFAULT current_date,
  responsavel_patrimonio text NOT NULL,
  diretor_administrativo text NOT NULL,
  coordenador_setor text NOT NULL,
  observacoes text,
  patrimonio_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  template_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  registrado_por uuid NOT NULL REFERENCES usuarios(id),
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_perdas_patrimonio_data
  ON perdas_patrimonio(data_ocorrencia DESC, criado_em DESC);

INSERT INTO permissoes(codigo,modulo,descricao,exclusiva_admin)
VALUES ('patrimonios.registrar_perda','Patrimônios','Registrar perda patrimonial',false)
ON CONFLICT(codigo) DO UPDATE
SET modulo=EXCLUDED.modulo, descricao=EXCLUDED.descricao, exclusiva_admin=EXCLUDED.exclusiva_admin;

INSERT INTO perfis_permissoes(perfil,permissao_codigo,permitido) VALUES
  ('ADMIN','patrimonios.registrar_perda',true),
  ('GESTOR','patrimonios.registrar_perda',true),
  ('OPERADOR','patrimonios.registrar_perda',false),
  ('CONSULTA','patrimonios.registrar_perda',false)
ON CONFLICT(perfil,permissao_codigo) DO UPDATE SET permitido=EXCLUDED.permitido;

INSERT INTO configuracoes_sistema(chave,valor)
VALUES (
  'TERMO_PERDA_PATRIMONIAL',
  jsonb_build_object(
    'instituicao','Hospital Regional Dr. José de Simone Netto',
    'unidade','',
    'titulo','Termo de Registro de Perda Patrimonial',
    'versao','1.0',
    'validado_qualidade',false,
    'texto_abertura','Por meio deste termo, registra-se formalmente a perda do bem patrimonial identificado abaixo, para fins de controle, rastreabilidade e baixa operacional no acervo.',
    'texto_fechamento','Os signatários declaram ciência das informações registradas e confirmam a ocorrência descrita neste documento.',
    'rodape','Documento gerado pelo Patrimônio+.',
    'assinatura_responsavel_patrimonio','Responsável pelo Setor de Patrimônio',
    'assinatura_diretor_administrativo','Diretor Administrativo',
    'assinatura_coordenador_setor','Coordenador do Centro de Custo / Setor',
    'logo_data_url',null,
    'logo_nome',null
  )
)
ON CONFLICT(chave) DO NOTHING;

CREATE OR REPLACE FUNCTION registrar_perda_patrimonial_api(
  p_patrimonio_id uuid,
  p_motivo text,
  p_motivo_detalhe text,
  p_data_ocorrencia date,
  p_responsavel_patrimonio text,
  p_diretor_administrativo text,
  p_coordenador_setor text,
  p_observacoes text,
  p_usuario_id uuid,
  p_patrimonio_snapshot jsonb,
  p_template_snapshot jsonb
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_patrimonio patrimonios%ROWTYPE;
  v_perda_id uuid;
  v_centro_nome text;
BEGIN
  IF p_motivo NOT IN ('ROUBO_FURTO','DANO_IRREPARAVEL','EXTRAVIO','OUTRO') THEN
    RAISE EXCEPTION 'VALIDATION:Motivo de perda inválido';
  END IF;
  IF btrim(coalesce(p_responsavel_patrimonio,''))='' OR
     btrim(coalesce(p_diretor_administrativo,''))='' OR
     btrim(coalesce(p_coordenador_setor,''))='' THEN
    RAISE EXCEPTION 'VALIDATION:Informe os três responsáveis pelo termo de perda';
  END IF;
  IF p_motivo='OUTRO' AND btrim(coalesce(p_motivo_detalhe,''))='' THEN
    RAISE EXCEPTION 'VALIDATION:Descreva o motivo da perda';
  END IF;

  SELECT * INTO v_patrimonio
  FROM patrimonios
  WHERE id=p_patrimonio_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VALIDATION:Patrimônio não encontrado';
  END IF;
  IF v_patrimonio.perdido THEN
    RAISE EXCEPTION 'VALIDATION:Este patrimônio já possui perda registrada';
  END IF;
  IF v_patrimonio.removido THEN
    RAISE EXCEPTION 'VALIDATION:Patrimônio removido não pode ser marcado como perdido';
  END IF;

  SELECT nome INTO v_centro_nome
  FROM centros_custo
  WHERE id=v_patrimonio.centro_custo_id;

  INSERT INTO perdas_patrimonio(
    patrimonio_id,centro_custo_id,centro_custo_nome,motivo,motivo_detalhe,data_ocorrencia,
    responsavel_patrimonio,diretor_administrativo,coordenador_setor,observacoes,
    patrimonio_snapshot,template_snapshot,registrado_por
  ) VALUES (
    p_patrimonio_id,v_patrimonio.centro_custo_id,coalesce(v_centro_nome,'Centro de custo não identificado'),
    p_motivo,nullif(btrim(coalesce(p_motivo_detalhe,'')),''),
    coalesce(p_data_ocorrencia,current_date),
    btrim(p_responsavel_patrimonio),btrim(p_diretor_administrativo),btrim(p_coordenador_setor),
    nullif(btrim(coalesce(p_observacoes,'')),''),
    coalesce(p_patrimonio_snapshot,'{}'::jsonb),coalesce(p_template_snapshot,'{}'::jsonb),p_usuario_id
  ) RETURNING id INTO v_perda_id;

  UPDATE patrimonios
  SET perdido=true,perdido_em=now(),atualizado_por=p_usuario_id,atualizado_em=now()
  WHERE id=p_patrimonio_id;

  INSERT INTO historico_alteracoes(tabela,registro_id,operacao,dados_novos,usuario_id)
  VALUES(
    'patrimonios',p_patrimonio_id,'PERDA_PATRIMONIAL',
    jsonb_build_object(
      'perda_id',v_perda_id,
      'motivo',p_motivo,
      'motivo_detalhe',nullif(btrim(coalesce(p_motivo_detalhe,'')),''),
      'data_ocorrencia',coalesce(p_data_ocorrencia,current_date),
      'centro_custo_id',v_patrimonio.centro_custo_id,
      'centro_custo_nome',v_centro_nome,
      'responsavel_patrimonio',btrim(p_responsavel_patrimonio),
      'diretor_administrativo',btrim(p_diretor_administrativo),
      'coordenador_setor',btrim(p_coordenador_setor)
    ),
    p_usuario_id
  );

  RETURN v_perda_id;
END;
$$;

COMMIT;

SELECT
  'PERDA_PATRIMONIAL_016_OK' AS resultado,
  (SELECT count(*) FROM permissoes WHERE codigo='patrimonios.registrar_perda') AS permissao,
  (SELECT count(*) FROM configuracoes_sistema WHERE chave='TERMO_PERDA_PATRIMONIAL') AS template;
