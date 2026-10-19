-- Patrimônio+ | MARCO ZERO OPERACIONAL OFICIAL
-- Remove dados e históricos de teste antes da primeira carga real.
-- PRESERVA dados mestres e funcionais:
--   Catálogo, Centros de Custo, usuários, sessões/autenticação, tipos e aliases/de-paras.
-- APAGA:
--   patrimônios, movimentações, manutenções, permissões de mobilidade,
--   importações anteriores, histórico geral, histórico de atualização SIGEM de teste
--   e o CONTROLE DE SEQUÊNCIAS responsável pela próxima ID interna.
--
-- Use somente após criar uma branch de segurança no Neon.

BEGIN;

DO $marco_zero$
DECLARE
  v_catalogo bigint;
  v_centros bigint;
  v_usuarios bigint;
  v_aliases bigint;
BEGIN
  SELECT count(*) INTO v_catalogo FROM descricoes_padrao;
  SELECT count(*) INTO v_centros FROM centros_custo;
  SELECT count(*) INTO v_usuarios FROM usuarios;
  SELECT count(*) INTO v_aliases FROM catalogo_sigem_aliases;

  IF v_catalogo <> 821 THEN
    RAISE EXCEPTION 'Proteção acionada: Catálogo deveria ter 821 itens, mas possui %',v_catalogo;
  END IF;

  IF v_centros = 0 THEN
    RAISE EXCEPTION 'Proteção acionada: não há Centros de Custo para preservar';
  END IF;

  IF v_usuarios = 0 THEN
    RAISE EXCEPTION 'Proteção acionada: não há usuário para preservar';
  END IF;

  -- Histórico de atualizações SIGEM de teste.
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

  -- Marco zero da numeração interna.
  -- A função gerar_id_interna() usa esta tabela para incrementar ultimo_numero
  -- por Tipo/Ano/Mês. Limpá-la faz a primeira ID oficial começar em 0001.
  TRUNCATE TABLE controle_sequencias RESTART IDENTITY;

  -- Limpa TODO o histórico geral de testes, inclusive cadastro/edição/exclusão.
  TRUNCATE TABLE historico_alteracoes RESTART IDENTITY;

  -- Compatibilidade com estruturas antigas de importação, se ainda existirem.
  IF to_regclass('public.importacao_linhas') IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE public.importacao_linhas RESTART IDENTITY CASCADE';
  END IF;

  IF to_regclass('public.importacoes') IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE public.importacoes RESTART IDENTITY CASCADE';
  END IF;

  -- Confere o operacional zerado.
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

  IF (SELECT count(*) FROM controle_sequencias) <> 0 THEN
    RAISE EXCEPTION 'O controle de sequências da ID interna não foi zerado';
  END IF;

  -- Confere que os dados mestres permaneceram intactos.
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
$marco_zero$;

COMMIT;

SELECT
  'MARCO_ZERO_OPERACIONAL_OFICIAL_OK' AS resultado,
  (SELECT count(*)::int FROM patrimonios) AS patrimonios,
  (SELECT count(*)::int FROM historico_alteracoes) AS historico,
  (SELECT count(*)::int FROM importacoes_patrimoniais) AS importacoes,
  (SELECT count(*)::int FROM controle_sequencias) AS controle_sequencias,
  (SELECT count(*)::int FROM descricoes_padrao) AS catalogo,
  (SELECT count(*)::int FROM centros_custo) AS centros,
  (SELECT count(*)::int FROM usuarios) AS usuarios,
  (SELECT count(*)::int FROM catalogo_sigem_aliases) AS aliases;
