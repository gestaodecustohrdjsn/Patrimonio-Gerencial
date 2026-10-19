-- Patrimônio+ | Prévia do reset patrimonial antes da carga oficial
-- SOMENTE LEITURA. Não altera nenhum dado.

select 'patrimonios' as objeto, count(*)::bigint as registros from patrimonios
union all
select 'movimentacoes', count(*)::bigint from movimentacoes
union all
select 'manutencoes_patrimonio', count(*)::bigint from manutencoes_patrimonio
union all
select 'patrimonio_centros_permitidos', count(*)::bigint from patrimonio_centros_permitidos
union all
select 'importacoes_patrimoniais', count(*)::bigint from importacoes_patrimoniais
union all
select 'importacao_patrimonial_itens', count(*)::bigint from importacao_patrimonial_itens
union all
select 'historico_patrimonial',
  count(*)::bigint
from historico_alteracoes
where tabela in (
  'patrimonios',
  'importacoes_patrimoniais',
  'importacao_patrimonial_itens',
  'movimentacoes',
  'manutencoes_patrimonio'
)
union all
select 'catalogo_preservado', count(*)::bigint from descricoes_padrao
union all
select 'centros_custo_preservados', count(*)::bigint from centros_custo
union all
select 'usuarios_preservados', count(*)::bigint from usuarios
order by objeto;

-- Como a ID interna é gerada hoje.
select
  c.column_name,
  c.data_type,
  c.column_default,
  c.is_identity,
  c.identity_generation,
  pg_get_serial_sequence('public.patrimonios','id_interna') as sequencia_associada
from information_schema.columns c
where c.table_schema='public'
  and c.table_name='patrimonios'
  and c.column_name='id_interna';

-- Triggers existentes em patrimonios. Útil para confirmar a geração da ID interna.
select
  t.tgname as trigger,
  pg_get_triggerdef(t.oid,true) as definicao
from pg_trigger t
where t.tgrelid='public.patrimonios'::regclass
  and not t.tgisinternal
order by t.tgname;
