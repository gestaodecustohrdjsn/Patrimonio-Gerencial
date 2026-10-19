-- Patrimônio+ | Configurações estruturadas de documentos v1.8.0

BEGIN;

CREATE TABLE IF NOT EXISTS configuracoes_sistema (
  id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  chave text PRIMARY KEY,
  valor jsonb NOT NULL DEFAULT '{}'::jsonb,
  atualizado_por uuid REFERENCES usuarios(id),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_configuracoes_sistema_atualizado_em
  ON configuracoes_sistema(atualizado_em DESC);

INSERT INTO configuracoes_sistema(chave,valor)
VALUES (
  'RELACAO_PATRIMONIAL',
  jsonb_build_object(
    'instituicao','Hospital Regional Dr. José de Simone Netto',
    'unidade','',
    'titulo','Relação Patrimonial por Centro de Custo',
    'rodape','Centro atual dos bens no momento da emissão.',
    'assinatura_1','Responsável pelo setor',
    'assinatura_2','Patrimônio',
    'mostrar_data',true,
    'mostrar_quantidade',true,
    'mostrar_filtros',true,
    'logo_data_url',null,
    'logo_nome',null,
    'colunas',jsonb_build_object(
      'id_interna',true,
      'id_ses',true,
      'descricao',true,
      'tipo',true,
      'estado',true,
      'mobilidade',true,
      'status',true,
      'manutencao',true,
      'marca_modelo',false,
      'data_aquisicao',false,
      'valor_aquisicao',false
    )
  )
)
ON CONFLICT (chave) DO NOTHING;

COMMIT;

SELECT
  'CONFIGURACOES_DOCUMENTOS_180_OK' AS resultado,
  count(*)::int AS configuracoes
FROM configuracoes_sistema;
