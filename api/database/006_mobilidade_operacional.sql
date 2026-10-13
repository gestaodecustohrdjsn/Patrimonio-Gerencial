-- Patrimônio+ | Mobilidade, histórico operacional e responsáveis v1
-- Executar no Neon antes da API 3.3.

begin;

alter table patrimonios
  add column if not exists mobilidade text not null default 'FIXO';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'patrimonios_mobilidade_check'
  ) then
    alter table patrimonios
      add constraint patrimonios_mobilidade_check
      check (mobilidade in ('FIXO','MOVEL'));
  end if;
end $$;

create table if not exists patrimonio_centros_permitidos (
  patrimonio_id uuid not null references patrimonios(id) on delete cascade,
  centro_custo_id uuid not null references centros_custo(id),
  criado_por uuid references usuarios(id),
  criado_em timestamptz not null default now(),
  primary key (patrimonio_id, centro_custo_id)
);

create index if not exists idx_patrimonio_centros_permitidos_centro
  on patrimonio_centros_permitidos(centro_custo_id);

alter table movimentacoes add column if not exists solicitante text;
alter table movimentacoes add column if not exists movimentado_por text;
alter table movimentacoes add column if not exists recebido_por text;

alter table manutencoes_patrimonio add column if not exists solicitante text;
alter table manutencoes_patrimonio add column if not exists encaminhado_por text;
alter table manutencoes_patrimonio add column if not exists recebido_manutencao_por text;
alter table manutencoes_patrimonio add column if not exists responsavel_manutencao text;
alter table manutencoes_patrimonio add column if not exists entregue_centro_por text;
alter table manutencoes_patrimonio add column if not exists recebido_centro_por text;
alter table manutencoes_patrimonio add column if not exists observacao_conclusao text;

create or replace function registrar_historico_patrimonio()
returns trigger
language plpgsql
as $$
declare
  v_operacao text;
begin
  if tg_op = 'INSERT' then
    insert into historico_alteracoes (
      tabela, registro_id, operacao, dados_anteriores, dados_novos, usuario_id
    ) values (
      'patrimonios', new.id, 'CADASTRO', null, to_jsonb(new),
      coalesce(new.criado_por, app_usuario_atual())
    );
    return new;
  end if;

  if old.removido = false and new.removido = true then
    v_operacao := 'REMOCAO_LOGICA';
  elsif old.removido = true and new.removido = false then
    v_operacao := 'RESTAURACAO';
  elsif old.centro_custo_id is distinct from new.centro_custo_id then
    v_operacao := 'MOVIMENTACAO';
  elsif old.status = 'ATIVO' and new.status = 'INATIVO' then
    v_operacao := 'INATIVACAO';
  elsif old.status = 'INATIVO' and new.status = 'ATIVO' then
    v_operacao := 'REATIVACAO';
  elsif old.mobilidade is distinct from new.mobilidade then
    v_operacao := 'MOBILIDADE_ALTERADA';
  else
    v_operacao := 'EDICAO_CADASTRAL';
  end if;

  insert into historico_alteracoes (
    tabela, registro_id, operacao, dados_anteriores, dados_novos, usuario_id
  ) values (
    'patrimonios', new.id, v_operacao, to_jsonb(old), to_jsonb(new),
    coalesce(new.atualizado_por, app_usuario_atual())
  );

  return new;
end;
$$;

create or replace function sincronizar_centros_permitidos_api(
  p_patrimonio_id uuid,
  p_centros uuid[],
  p_usuario_id uuid
)
returns void
language plpgsql
as $$
declare
  v_id uuid;
  v_nome text;
  v_atual uuid;
begin
  p_centros := coalesce(p_centros, array[]::uuid[]);

  select centro_custo_id into v_atual
  from patrimonios where id=p_patrimonio_id;

  p_centros := array(
    select distinct x
    from unnest(p_centros) x
    where x is not null and x is distinct from v_atual
  );

  for v_id, v_nome in
    select pcp.centro_custo_id, c.nome
    from patrimonio_centros_permitidos pcp
    join centros_custo c on c.id=pcp.centro_custo_id
    where pcp.patrimonio_id=p_patrimonio_id
      and not (pcp.centro_custo_id = any(p_centros))
  loop
    delete from patrimonio_centros_permitidos
    where patrimonio_id=p_patrimonio_id and centro_custo_id=v_id;

    insert into historico_alteracoes(tabela,registro_id,operacao,dados_novos,usuario_id)
    values('patrimonios',p_patrimonio_id,'CENTRO_PERMITIDO_REMOVIDO',
      jsonb_build_object('centro_custo_id',v_id,'centro_nome',v_nome),p_usuario_id);
  end loop;

  for v_id in select unnest(p_centros)
  loop
    if not exists(
      select 1 from patrimonio_centros_permitidos
      where patrimonio_id=p_patrimonio_id and centro_custo_id=v_id
    ) then
      select nome into v_nome from centros_custo where id=v_id and ativo=true;
      if v_nome is null then
        raise exception 'Centro de custo permitido inválido ou inativo';
      end if;

      insert into patrimonio_centros_permitidos(patrimonio_id,centro_custo_id,criado_por)
      values(p_patrimonio_id,v_id,p_usuario_id);

      insert into historico_alteracoes(tabela,registro_id,operacao,dados_novos,usuario_id)
      values('patrimonios',p_patrimonio_id,'CENTRO_PERMITIDO_ADICIONADO',
        jsonb_build_object('centro_custo_id',v_id,'centro_nome',v_nome),p_usuario_id);
    end if;
  end loop;
end;
$$;

create or replace function movimentar_patrimonio_operacional_api(
  p_patrimonio_id uuid,
  p_destino_centro_custo_id uuid,
  p_observacao text,
  p_usuario_id uuid,
  p_solicitante text,
  p_movimentado_por text,
  p_recebido_por text,
  p_mobilidade text,
  p_centros_permitidos uuid[]
)
returns void
language plpgsql
as $$
declare
  v_origem uuid;
  v_origem_nome text;
  v_destino_nome text;
  v_mov_id uuid;
  v_hist_id bigint;
begin
  if p_mobilidade not in ('FIXO','MOVEL') then
    raise exception 'Mobilidade inválida';
  end if;

  select p.centro_custo_id, c.nome
    into v_origem, v_origem_nome
  from patrimonios p join centros_custo c on c.id=p.centro_custo_id
  where p.id=p_patrimonio_id and p.removido=false
  for update;

  if v_origem is null then raise exception 'Patrimônio não encontrado ou removido'; end if;
  if v_origem=p_destino_centro_custo_id then raise exception 'O patrimônio já está neste centro de custo'; end if;

  select nome into v_destino_nome
  from centros_custo
  where id=p_destino_centro_custo_id and ativo=true;

  if v_destino_nome is null then raise exception 'Centro de custo de destino inválido ou inativo'; end if;

  insert into movimentacoes(
    patrimonio_id,origem_centro_custo_id,destino_centro_custo_id,observacao,usuario_id,
    solicitante,movimentado_por,recebido_por
  ) values(
    p_patrimonio_id,v_origem,p_destino_centro_custo_id,nullif(btrim(p_observacao),''),
    p_usuario_id,nullif(btrim(p_solicitante),''),nullif(btrim(p_movimentado_por),''),
    nullif(btrim(p_recebido_por),'')
  ) returning id into v_mov_id;

  update patrimonios
  set centro_custo_id=p_destino_centro_custo_id,
      mobilidade=p_mobilidade,
      atualizado_por=p_usuario_id
  where id=p_patrimonio_id;

  perform sincronizar_centros_permitidos_api(
    p_patrimonio_id,
    case when p_mobilidade='MOVEL' then coalesce(p_centros_permitidos,array[]::uuid[]) else array[]::uuid[] end,
    p_usuario_id
  );

  select id into v_hist_id
  from historico_alteracoes
  where tabela='patrimonios' and registro_id=p_patrimonio_id and operacao='MOVIMENTACAO'
  order by id desc limit 1;

  if v_hist_id is not null then
    update historico_alteracoes
    set dados_novos = coalesce(dados_novos,'{}'::jsonb) ||
      jsonb_build_object('movimentacao',jsonb_build_object(
        'movimentacao_id',v_mov_id,
        'origem_id',v_origem,'origem_nome',v_origem_nome,
        'destino_id',p_destino_centro_custo_id,'destino_nome',v_destino_nome,
        'solicitante',nullif(btrim(p_solicitante),''),
        'movimentado_por',nullif(btrim(p_movimentado_por),''),
        'recebido_por',nullif(btrim(p_recebido_por),''),
        'observacao',nullif(btrim(p_observacao),'')
      ))
    where id=v_hist_id;
  end if;
end;
$$;

commit;

select 'MOBILIDADE_OPERACIONAL_V1_OK' as resultado;
