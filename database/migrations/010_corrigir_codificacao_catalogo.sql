-- Patrimônio+ | Correção de codificação do Catálogo v1.6.1
-- Corrige textos UTF-8 que foram interpretados como Windows-1252 ao copiar SQL no PowerShell.
-- Não altera UUID, Tipo, origem, valor ou vínculos.

BEGIN;

CREATE OR REPLACE FUNCTION corrigir_mojibake_catalogo_161(p_text text)
RETURNS text
LANGUAGE plpgsql
AS $encoding_fix$
DECLARE
  v_text text := p_text;
  v_candidate text;
  v_iteration integer;
BEGIN
  IF v_text IS NULL OR v_text = '' THEN
    RETURN v_text;
  END IF;

  FOR v_iteration IN 1..3 LOOP
    BEGIN
      v_candidate := convert_from(convert_to(v_text, 'WIN1252'), 'UTF8');
    EXCEPTION WHEN OTHERS THEN
      EXIT;
    END;

    IF v_candidate IS NOT DISTINCT FROM v_text THEN
      EXIT;
    END IF;

    v_text := v_candidate;
  END LOOP;

  RETURN v_text;
END;
$encoding_fix$;

UPDATE descricoes_padrao
SET descricao = corrigir_mojibake_catalogo_161(descricao),
    atualizado_em = now()
WHERE descricao IS DISTINCT FROM corrigir_mojibake_catalogo_161(descricao);

UPDATE catalogo_sigem_aliases
SET alias_original = corrigir_mojibake_catalogo_161(alias_original),
    atualizado_em = now()
WHERE alias_original IS DISTINCT FROM corrigir_mojibake_catalogo_161(alias_original);

DO $catalogo_encoding_check$
BEGIN
  IF (SELECT count(*) FROM descricoes_padrao) <> 821 THEN
    RAISE EXCEPTION 'Correção de codificação alterou a quantidade do Catálogo';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM descricoes_padrao
    WHERE descricao='Aspirador Ultrassônico/ Bisturi Ultrassônico'
      AND origem_catalogo='SIGEM'
  ) THEN
    RAISE EXCEPTION 'Descrição UTF-8 de controle 1 não foi corrigida';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM descricoes_padrao
    WHERE descricao='Bisturi Elétrico (a partir de 151 W)'
      AND origem_catalogo='SIGEM'
  ) THEN
    RAISE EXCEPTION 'Descrição UTF-8 de controle 2 não foi corrigida';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM descricoes_padrao
    WHERE descricao='Bisturi Elétrico - HRPP'
      AND origem_catalogo='PROPRIO'
  ) THEN
    RAISE EXCEPTION 'Descrição UTF-8 do Catálogo Próprio não foi corrigida';
  END IF;
END;
$catalogo_encoding_check$;

DROP FUNCTION corrigir_mojibake_catalogo_161(text);

COMMIT;

SELECT
  'CATALOGO_ENCODING_161_OK' AS resultado,
  count(*)::int AS total,
  count(*) FILTER (WHERE origem_catalogo='SIGEM')::int AS sigem,
  count(*) FILTER (WHERE origem_catalogo='PROPRIO')::int AS proprio
FROM descricoes_padrao;
