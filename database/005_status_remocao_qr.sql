begin;

alter table public.patrimonios
  add column if not exists removido boolean not null default false,
  add column if not exists removido_em timestamptz,
  add column if not exists removido_por uuid references auth.users(id);

create index if not exists idx_patrimonios_removido on public.patrimonios(removido);

create or replace function public.remover_patrimonio_logicamente(p_patrimonio_id uuid)
returns public.patrimonios
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registro public.patrimonios;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  update public.patrimonios
     set removido = true,
         removido_em = now(),
         removido_por = auth.uid(),
         atualizado_por = auth.uid(),
         atualizado_em = now()
   where id = p_patrimonio_id
     and removido = false
  returning * into v_registro;

  if v_registro.id is null then
    raise exception 'Patrimônio não encontrado ou já removido';
  end if;

  return v_registro;
end;
$$;

create or replace function public.restaurar_patrimonio_removido(p_patrimonio_id uuid)
returns public.patrimonios
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registro public.patrimonios;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  update public.patrimonios
     set removido = false,
         removido_em = null,
         removido_por = null,
         atualizado_por = auth.uid(),
         atualizado_em = now()
   where id = p_patrimonio_id
     and removido = true
  returning * into v_registro;

  if v_registro.id is null then
    raise exception 'Patrimônio não encontrado ou não está removido';
  end if;

  return v_registro;
end;
$$;

create or replace function public.excluir_patrimonio_teste(p_patrimonio_id uuid, p_confirmacao text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  if upper(trim(coalesce(p_confirmacao, ''))) <> 'EXCLUIR' then
    raise exception 'Confirmação inválida';
  end if;

  delete from public.historico_alteracoes
   where tabela = 'patrimonios'
     and registro_id = p_patrimonio_id;

  delete from public.patrimonios
   where id = p_patrimonio_id;

  if not found then
    raise exception 'Patrimônio não encontrado';
  end if;
end;
$$;

grant execute on function public.remover_patrimonio_logicamente(uuid) to authenticated;
grant execute on function public.restaurar_patrimonio_removido(uuid) to authenticated;
grant execute on function public.excluir_patrimonio_teste(uuid, text) to authenticated;

commit;

select
  'v0.6 pronta' as resultado,
  count(*) filter (where removido = false) as patrimonios_visiveis,
  count(*) filter (where removido = true) as patrimonios_removidos
from public.patrimonios;
