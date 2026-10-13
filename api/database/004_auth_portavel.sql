-- Patrimônio+ | Autenticação própria e portátil
-- Execute uma única vez no PostgreSQL atual.

begin;

alter table usuarios add column if not exists password_hash text;
alter table usuarios add column if not exists password_salt text;
alter table usuarios add column if not exists password_iterations integer;
alter table usuarios add column if not exists falhas_login integer not null default 0;
alter table usuarios add column if not exists bloqueado_ate timestamptz;

create table if not exists sessoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  token_hash text not null unique,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  revogado_em timestamptz,
  ultimo_uso_em timestamptz not null default now()
);

create index if not exists idx_sessoes_token_ativo
  on sessoes(token_hash, expira_em)
  where revogado_em is null;

create or replace function movimentar_patrimonio_api(
  p_patrimonio_id uuid,
  p_destino_centro_custo_id uuid,
  p_observacao text,
  p_usuario_id uuid
)
returns void
language plpgsql
as $$
declare
  v_origem uuid;
begin
  select centro_custo_id into v_origem
  from patrimonios
  where id = p_patrimonio_id and removido = false
  for update;

  if v_origem is null then raise exception 'Patrimônio não encontrado ou removido'; end if;
  if v_origem = p_destino_centro_custo_id then raise exception 'O patrimônio já está neste centro de custo'; end if;
  if not exists(select 1 from centros_custo where id=p_destino_centro_custo_id and ativo) then
    raise exception 'Centro de custo inválido ou inativo';
  end if;

  insert into movimentacoes(patrimonio_id, origem_centro_custo_id, destino_centro_custo_id, observacao, usuario_id)
  values(p_patrimonio_id, v_origem, p_destino_centro_custo_id, nullif(btrim(p_observacao), ''), p_usuario_id);

  update patrimonios
  set centro_custo_id=p_destino_centro_custo_id,
      atualizado_por=p_usuario_id
  where id=p_patrimonio_id;
end;
$$;

create or replace function remover_patrimonio_api(p_patrimonio_id uuid, p_usuario_id uuid)
returns void language plpgsql as $$
begin
  update patrimonios
  set removido=true, removido_em=now(), removido_por=p_usuario_id, atualizado_por=p_usuario_id
  where id=p_patrimonio_id and removido=false;
  if not found then raise exception 'Patrimônio não encontrado ou já removido'; end if;
end;
$$;

create or replace function restaurar_patrimonio_api(p_patrimonio_id uuid, p_usuario_id uuid)
returns void language plpgsql as $$
begin
  update patrimonios
  set removido=false, removido_em=null, removido_por=null, atualizado_por=p_usuario_id
  where id=p_patrimonio_id and removido=true;
  if not found then raise exception 'Patrimônio não encontrado ou não removido'; end if;
end;
$$;

create or replace function excluir_patrimonio_definitivo_api(p_patrimonio_id uuid)
returns void language plpgsql as $$
begin
  delete from historico_alteracoes where tabela='patrimonios' and registro_id=p_patrimonio_id;
  delete from movimentacoes where patrimonio_id=p_patrimonio_id;
  update importacao_linhas set patrimonio_id=null where patrimonio_id=p_patrimonio_id;
  delete from patrimonios where id=p_patrimonio_id;
  if not found then raise exception 'Patrimônio não encontrado'; end if;
end;
$$;

commit;

select 'AUTH_PORTAVEL_OK' as resultado;
