-- Patrimônio+ | Diagnóstico do Tipo no catálogo SIGEM
-- Somente leitura. Não altera nenhum dado.

-- Resumo por Tipo
select
  tipo_id,
  count(*)::int as quantidade
from descricoes_padrao
group by tipo_id
order by tipo_id nulls first;

-- Itens sem Tipo válido (o resultado ideal é zero linhas)
select
  id,
  descricao,
  tipo_id,
  ativo
from descricoes_padrao
where tipo_id is null
   or tipo_id not in (1,2,3)
order by descricao;

-- Quantidade total de itens sem Tipo válido (resultado ideal = 0)
select count(*)::int as itens_sem_tipo_valido
from descricoes_padrao
where tipo_id is null
   or tipo_id not in (1,2,3);
