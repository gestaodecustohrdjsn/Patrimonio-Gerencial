-- Patrimônio+ v0.4
-- Única atualização necessária no banco atual.
-- Não altera tabelas, colunas, constraints nem os dados já cadastrados.
-- Cria uma função segura para cadastrar/reutilizar itens próprios do HRPP.

begin;

create or replace function public.cadastrar_item_catalogo_hrpp(
  p_descricao text,
  p_valor_padrao numeric,
  p_tipo_id smallint
)
returns table (
  id uuid,
  descricao text,
  valor_padrao numeric,
  tipo_id smallint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_descricao text;
begin
  if auth.uid() is null then
    raise exception 'É necessário estar autenticado.';
  end if;

  v_descricao := btrim(regexp_replace(coalesce(p_descricao, ''), '\\s+-\\s+HRPP$', '', 'i'));

  if v_descricao = '' then
    raise exception 'Informe a descrição do item.';
  end if;

  if p_valor_padrao is null or p_valor_padrao < 0 then
    raise exception 'Informe um valor de referência válido.';
  end if;

  if not exists (
    select 1
    from public.tipos_patrimonio t
    where t.id = p_tipo_id and t.ativo = true
  ) then
    raise exception 'Tipo de patrimônio inválido ou inativo.';
  end if;

  v_descricao := v_descricao || ' - HRPP';

  return query
  insert into public.descricoes_padrao (
    codigo_sigem,
    descricao,
    tipo_id,
    valor_padrao,
    ativo,
    vigencia_inicio,
    vigencia_fim
  )
  values (
    null,
    v_descricao,
    p_tipo_id,
    p_valor_padrao,
    true,
    current_date,
    null
  )
  on conflict (descricao) do update
  set valor_padrao = excluded.valor_padrao,
      tipo_id = excluded.tipo_id,
      ativo = true,
      vigencia_fim = null
  returning
    descricoes_padrao.id,
    descricoes_padrao.descricao,
    descricoes_padrao.valor_padrao,
    descricoes_padrao.tipo_id;
end;
$$;

revoke all on function public.cadastrar_item_catalogo_hrpp(text, numeric, smallint) from public;
grant execute on function public.cadastrar_item_catalogo_hrpp(text, numeric, smallint) to authenticated;

commit;

-- Teste opcional: apenas confirma que a função existe.
select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'cadastrar_item_catalogo_hrpp';
