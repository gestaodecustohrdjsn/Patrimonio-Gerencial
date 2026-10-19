-- Patrimônio+ | Diagnóstico completo antes do marco zero oficial
-- SOMENTE LEITURA. Não altera nenhum dado.
-- Compatível com o SQL Editor do Neon sem depender de tabela temporária.

SELECT 'catalogo_sigem_aliases' AS tabela,count(*)::bigint AS registros FROM catalogo_sigem_aliases
UNION ALL SELECT 'catalogo_sigem_atualizacao_itens',count(*) FROM catalogo_sigem_atualizacao_itens
UNION ALL SELECT 'catalogo_sigem_atualizacoes',count(*) FROM catalogo_sigem_atualizacoes
UNION ALL SELECT 'centros_custo',count(*) FROM centros_custo
UNION ALL SELECT 'descricoes_padrao',count(*) FROM descricoes_padrao
UNION ALL SELECT 'historico_alteracoes',count(*) FROM historico_alteracoes
UNION ALL SELECT 'importacao_patrimonial_itens',count(*) FROM importacao_patrimonial_itens
UNION ALL SELECT 'importacoes_patrimoniais',count(*) FROM importacoes_patrimoniais
UNION ALL SELECT 'manutencoes_patrimonio',count(*) FROM manutencoes_patrimonio
UNION ALL SELECT 'movimentacoes',count(*) FROM movimentacoes
UNION ALL SELECT 'patrimonio_centros_permitidos',count(*) FROM patrimonio_centros_permitidos
UNION ALL SELECT 'patrimonios',count(*) FROM patrimonios
UNION ALL SELECT 'sessoes',count(*) FROM sessoes
UNION ALL SELECT 'usuarios',count(*) FROM usuarios
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
