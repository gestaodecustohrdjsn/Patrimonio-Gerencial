-- Patrimônio+ | Verificação pós-marco-zero
-- SOMENTE LEITURA.

SELECT 'patrimonios' AS objeto,count(*)::bigint AS registros FROM patrimonios
UNION ALL SELECT 'movimentacoes',count(*) FROM movimentacoes
UNION ALL SELECT 'manutencoes_patrimonio',count(*) FROM manutencoes_patrimonio
UNION ALL SELECT 'patrimonio_centros_permitidos',count(*) FROM patrimonio_centros_permitidos
UNION ALL SELECT 'importacoes_patrimoniais',count(*) FROM importacoes_patrimoniais
UNION ALL SELECT 'importacao_patrimonial_itens',count(*) FROM importacao_patrimonial_itens
UNION ALL SELECT 'historico_alteracoes',count(*) FROM historico_alteracoes
UNION ALL SELECT 'catalogo_sigem_atualizacoes',count(*) FROM catalogo_sigem_atualizacoes
UNION ALL SELECT 'catalogo_sigem_atualizacao_itens',count(*) FROM catalogo_sigem_atualizacao_itens
UNION ALL SELECT 'catalogo_preservado',count(*) FROM descricoes_padrao
UNION ALL SELECT 'centros_preservados',count(*) FROM centros_custo
UNION ALL SELECT 'usuarios_preservados',count(*) FROM usuarios
UNION ALL SELECT 'aliases_preservados',count(*) FROM catalogo_sigem_aliases
ORDER BY objeto;
