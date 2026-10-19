-- Patrimônio+ | RESET PATRIMONIAL antes da primeira carga oficial
-- ATENÇÃO: este script apaga definitivamente os patrimônios atuais e seus dados operacionais.
-- PRESERVA: Catálogo, Centros de Custo, usuários, autenticação, configurações e histórico administrativo.
-- Use somente após criar um backup/branch do banco no Neon.

BEGIN;

-- 1) Remove apenas histórico operacional patrimonial/importações.
DELETE FROM historico_alteracoes
WHERE tabela IN (
  'patrimonios',
  'importacoes_patrimoniais',
  'importacao_patrimonial_itens',
  'movimentacoes',
  'manutencoes_patrimonio'
);

-- 2) Zera o núcleo patrimonial e dependências conhecidas.
-- RESTART IDENTITY reinicia identidades/sequências pertencentes às tabelas truncadas.
TRUNCATE TABLE
  importacao_patrimonial_itens,
  importacoes_patrimoniais,
  patrimonio_centros_permitidos,
  manutencoes_patrimonio,
  movimentacoes,
  patrimonios
RESTART IDENTITY CASCADE;

-- 3) Compatibilidade com estruturas antigas de importação, caso ainda existam no banco.
DO $reset_legado$
BEGIN
  IF to_regclass('public.importacao_linhas') IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE public.importacao_linhas RESTART IDENTITY CASCADE';
  END IF;

  IF to_regclass('public.importacoes') IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE public.importacoes RESTART IDENTITY CASCADE';
  END IF;
END;
$reset_legado$;

-- 4) Reinicia explicitamente eventual sequência pertencente à ID interna.
DO $reset_id_interna$
DECLARE
  v_seq text;
BEGIN
  v_seq := pg_get_serial_sequence('public.patrimonios','id_interna');

  IF v_seq IS NOT NULL THEN
    EXECUTE format('ALTER SEQUENCE %s RESTART WITH 1',v_seq);
  END IF;
END;
$reset_id_interna$;

-- 5) Travas de segurança: o reset não pode tocar na estrutura mestre.
DO $reset_validacao$
BEGIN
  IF (SELECT count(*) FROM patrimonios) <> 0 THEN
    RAISE EXCEPTION 'Reset inválido: ainda existem patrimônios';
  END IF;

  IF (SELECT count(*) FROM movimentacoes) <> 0 THEN
    RAISE EXCEPTION 'Reset inválido: ainda existem movimentações';
  END IF;

  IF (SELECT count(*) FROM manutencoes_patrimonio) <> 0 THEN
    RAISE EXCEPTION 'Reset inválido: ainda existem manutenções';
  END IF;

  IF (SELECT count(*) FROM patrimonio_centros_permitidos) <> 0 THEN
    RAISE EXCEPTION 'Reset inválido: ainda existem centros permitidos';
  END IF;

  IF (SELECT count(*) FROM importacoes_patrimoniais) <> 0 THEN
    RAISE EXCEPTION 'Reset inválido: ainda existem importações patrimoniais';
  END IF;

  IF (SELECT count(*) FROM importacao_patrimonial_itens) <> 0 THEN
    RAISE EXCEPTION 'Reset inválido: ainda existem itens de importação';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM historico_alteracoes
    WHERE tabela IN (
      'patrimonios',
      'importacoes_patrimoniais',
      'importacao_patrimonial_itens',
      'movimentacoes',
      'manutencoes_patrimonio'
    )
  ) THEN
    RAISE EXCEPTION 'Reset inválido: ainda existe histórico operacional patrimonial';
  END IF;

  IF (SELECT count(*) FROM descricoes_padrao) <> 821 THEN
    RAISE EXCEPTION 'Proteção acionada: o Catálogo deveria continuar com 821 itens';
  END IF;

  IF (SELECT count(*) FROM centros_custo) = 0 THEN
    RAISE EXCEPTION 'Proteção acionada: Centros de Custo foram afetados';
  END IF;

  IF (SELECT count(*) FROM usuarios) = 0 THEN
    RAISE EXCEPTION 'Proteção acionada: usuários foram afetados';
  END IF;
END;
$reset_validacao$;

COMMIT;

select
  'RESET_PATRIMONIAL_PRE_CARGA_OFICIAL_OK' as resultado,
  (select count(*)::int from patrimonios) as patrimonios,
  (select count(*)::int from importacoes_patrimoniais) as importacoes,
  (select count(*)::int from descricoes_padrao) as catalogo_preservado,
  (select count(*)::int from centros_custo) as centros_preservados,
  (select count(*)::int from usuarios) as usuarios_preservados;
