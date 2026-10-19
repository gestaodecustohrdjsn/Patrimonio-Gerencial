-- Patrimônio+ | MARCO ZERO OPERACIONAL OFICIAL
-- Remove dados e históricos de teste antes da primeira carga real.
-- PRESERVA dados mestres e funcionais:
--   Catálogo, Centros de Custo, usuários, sessões/autenticação, aliases/de-paras.
-- APAGA:
--   patrimônios, movimentações, manutenções, permissões de mobilidade,
--   importações anteriores, histórico geral e histórico de atualizações SIGEM de teste.
--
-- Use somente após revisar a prévia e, idealmente, criar uma branch de segurança no Neon.

BEGIN;

CREATE TEMP TABLE tmp_marco_zero_preservacao (
  catalogo bigint,
  centros bigint,
  usuarios bigint,
  aliases bigint
) ON COMMIT DROP;

INSERT INTO tmp_marco_zero_preservacao(catalogo,centros,usuarios,aliases)
SELECT
  (SELECT count(*) FROM descricoes_padrao),
  (SELECT count(*) FROM centros_custo),
  (SELECT count(*) FROM usuarios),
  (SELECT count(*) FROM catalogo_sigem_aliases);

-- Histórico de atualizações SIGEM é histórico, não dado mestre.
TRUNCATE TABLE catalogo_sigem_atualizacao_itens RESTART IDENTITY;
TRUNCATE TABLE catalogo_sigem_atualizacoes RESTART IDENTITY;

-- Auditoria/importações patrimoniais anteriores.
TRUNCATE TABLE importacao_patrimonial_itens RESTART IDENTITY;
TRUNCATE TABLE importacoes_patrimoniais RESTART IDENTITY;

-- Operação patrimonial.
TRUNCATE TABLE patrimonio_centros_permitidos RESTART IDENTITY;
TRUNCATE TABLE manutencoes_patrimonio RESTART IDENTITY;
TRUNCATE TABLE movimentacoes RESTART IDENTITY;
TRUNCATE TABLE patrimonios RESTART IDENTITY CASCADE;

-- Limpa TODO o histórico geral de testes, inclusive cadastro/edição/exclusão.
TRUNCATE TABLE historico_alteracoes RESTART IDENTITY;

-- Compatibilidade com estruturas antigas de importação, caso existam.
DO $legado$
BEGIN
  IF to_regclass('public.importacao_linhas') IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE public.importacao_linhas RESTART IDENTITY CASCADE';
  END IF;

  IF to_regclass('public.importacoes') IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE public.importacoes RESTART IDENTITY CASCADE';
  END IF;
END;
$legado$;

-- Valida que o operacional ficou realmente zerado e que os mestres não mudaram.
DO $validacao$
DECLARE
  v_catalogo bigint;
  v_centros bigint;
  v_usuarios bigint;
  v_aliases bigint;
BEGIN
  SELECT catalogo,centros,usuarios,aliases
  INTO v_catalogo,v_centros,v_usuarios,v_aliases
  FROM tmp_marco_zero_preservacao;

  IF (SELECT count(*) FROM patrimonios) <> 0 THEN
    RAISE EXCEPTION 'Ainda existem patrimônios após o marco zero';
  END IF;

  IF (SELECT count(*) FROM movimentacoes) <> 0 THEN
    RAISE EXCEPTION 'Ainda existem movimentações após o marco zero';
  END IF;

  IF (SELECT count(*) FROM manutencoes_patrimonio) <> 0 THEN
    RAISE EXCEPTION 'Ainda existem manutenções após o marco zero';
  END IF;

  IF (SELECT count(*) FROM patrimonio_centros_permitidos) <> 0 THEN
    RAISE EXCEPTION 'Ainda existem centros permitidos após o marco zero';
  END IF;

  IF (SELECT count(*) FROM importacoes_patrimoniais) <> 0
     OR (SELECT count(*) FROM importacao_patrimonial_itens) <> 0 THEN
    RAISE EXCEPTION 'Ainda existem dados de importação após o marco zero';
  END IF;

  IF (SELECT count(*) FROM historico_alteracoes) <> 0 THEN
    RAISE EXCEPTION 'O histórico geral não foi totalmente limpo';
  END IF;

  IF (SELECT count(*) FROM catalogo_sigem_atualizacoes) <> 0
     OR (SELECT count(*) FROM catalogo_sigem_atualizacao_itens) <> 0 THEN
    RAISE EXCEPTION 'O histórico de atualizações SIGEM não foi totalmente limpo';
  END IF;

  IF (SELECT count(*) FROM descricoes_padrao) <> v_catalogo THEN
    RAISE EXCEPTION 'Proteção acionada: quantidade do Catálogo mudou';
  END IF;

  IF (SELECT count(*) FROM centros_custo) <> v_centros THEN
    RAISE EXCEPTION 'Proteção acionada: quantidade de Centros de Custo mudou';
  END IF;

  IF (SELECT count(*) FROM usuarios) <> v_usuarios THEN
    RAISE EXCEPTION 'Proteção acionada: quantidade de usuários mudou';
  END IF;

  IF (SELECT count(*) FROM catalogo_sigem_aliases) <> v_aliases THEN
    RAISE EXCEPTION 'Proteção acionada: aliases/de-paras do Catálogo mudaram';
  END IF;
END;
$validacao$;

COMMIT;

SELECT
  'MARCO_ZERO_OPERACIONAL_OFICIAL_OK' AS resultado,
  (SELECT count(*)::int FROM patrimonios) AS patrimonios,
  (SELECT count(*)::int FROM historico_alteracoes) AS historico,
  (SELECT count(*)::int FROM importacoes_patrimoniais) AS importacoes,
  (SELECT count(*)::int FROM descricoes_padrao) AS catalogo,
  (SELECT count(*)::int FROM centros_custo) AS centros,
  (SELECT count(*)::int FROM usuarios) AS usuarios,
  (SELECT count(*)::int FROM catalogo_sigem_aliases) AS aliases;
