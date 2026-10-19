-- Patrimônio+ | Diagnóstico completo antes do marco zero oficial
-- SOMENTE LEITURA. Não altera nenhum dado.

CREATE TEMP TABLE tmp_contagem_tabelas (
  tabela text primary key,
  registros bigint
) ON COMMIT DROP;

DO $contagem$
DECLARE
  r record;
  v_count bigint;
BEGIN
  FOR r IN
    SELECT schemaname, relname
    FROM pg_stat_user_tables
    WHERE schemaname='public'
    ORDER BY relname
  LOOP
    EXECUTE format('SELECT count(*) FROM %I.%I',r.schemaname,r.relname) INTO v_count;
    INSERT INTO tmp_contagem_tabelas(tabela,registros)
    VALUES(r.relname,v_count)
    ON CONFLICT (tabela) DO UPDATE SET registros=excluded.registros;
  END LOOP;
END;
$contagem$;

SELECT tabela,registros
FROM tmp_contagem_tabelas
WHERE registros>0
ORDER BY tabela;

-- Função que realmente gera a ID interna.
SELECT
  p.oid::regprocedure AS assinatura,
  pg_get_functiondef(p.oid) AS definicao
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.proname='gerar_id_interna'
ORDER BY p.oid::regprocedure::text;
