-- Patrimônio+ v0.1
-- Execute no SQL Editor do Supabase.

create extension if not exists pgcrypto;

create type public.status_patrimonio as enum ('ATIVO', 'INATIVO');
create type public.tipo_aquisicao as enum ('COMPRA', 'DOACAO', 'LOCACAO');
create type public.estado_conservacao as enum ('PRODUTO_NOVO', 'BEM_CONSERVADO', 'DESGASTADO', 'INUTILIZAVEL');

create table public.tipos_patrimonio (
  id smallint primary key,
  codigo_id char(1) not null unique,
  nome text not null unique,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

insert into public.tipos_patrimonio (id, codigo_id, nome) values
  (1, '1', 'Equipamento Médico'),
  (2, '2', 'Mobiliário'),
  (3, '3', 'Equipamento de Informática')
on conflict do nothing;

create table public.centros_custo (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  sigla text,
  centro_pai_id uuid references public.centros_custo(id),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  inativado_em timestamptz,
  constraint centro_inativacao_coerente check (
    (ativo = true and inativado_em is null)
    or
    (ativo = false)
  )
);

create table public.descricoes_padrao (
  id uuid primary key default gen_random_uuid(),
  codigo_sigem text,
  descricao text not null,
  tipo_id smallint not null references public.tipos_patrimonio(id),
  valor_padrao numeric(14,2) not null check (valor_padrao >= 0),
  ativo boolean not null default true,
  vigencia_inicio date not null default current_date,
  vigencia_fim date,
  criado_em timestamptz not null default now(),
  constraint vigencia_valida check (vigencia_fim is null or vigencia_fim >= vigencia_inicio)
);

create table public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  razao_social text not null,
  nome_fantasia text,
  cnpj varchar(14) unique,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.controle_sequencias (
  tipo_id smallint not null references public.tipos_patrimonio(id),
  ano smallint not null check (ano between 1900 and 2200),
  mes smallint not null check (mes between 1 and 12),
  ultimo_numero integer not null default 0 check (ultimo_numero >= 0),
  primary key (tipo_id, ano, mes)
);

create table public.patrimonios (
  id uuid primary key default gen_random_uuid(),
  id_interna varchar(16) not null unique,
  id_ses text unique,
  descricao text not null,
  descricao_padrao_id uuid not null references public.descricoes_padrao(id),
  data_aquisicao date not null default current_date,
  valor_aquisicao numeric(14,2) not null check (valor_aquisicao >= 0),
  nota_fiscal_numero text,
  centro_custo_id uuid not null references public.centros_custo(id),
  tipo_id smallint not null references public.tipos_patrimonio(id),
  marca_modelo text,
  status public.status_patrimonio not null default 'ATIVO',
  tipo_aquisicao public.tipo_aquisicao not null,
  fornecedor_id uuid references public.fornecedores(id),
  estado_conservacao public.estado_conservacao not null,
  observacoes text,
  criado_por uuid references auth.users(id),
  criado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id),
  atualizado_em timestamptz not null default now(),
  inativado_em timestamptz
);

create table public.historico_alteracoes (
  id bigint generated always as identity primary key,
  tabela text not null,
  registro_id uuid not null,
  operacao text not null check (operacao in ('INSERT','UPDATE','INATIVACAO','REATIVACAO')),
  dados_anteriores jsonb,
  dados_novos jsonb,
  usuario_id uuid references auth.users(id),
  criado_em timestamptz not null default now()
);

create table public.aliases_centros_custo (
  id uuid primary key default gen_random_uuid(),
  nome_original text not null,
  nome_normalizado text not null unique,
  centro_custo_id uuid not null references public.centros_custo(id),
  ativo boolean not null default true,
  criado_por uuid references auth.users(id),
  criado_em timestamptz not null default now()
);

create table public.importacoes (
  id uuid primary key default gen_random_uuid(),
  nome_arquivo text not null,
  status text not null default 'RASCUNHO'
    check (status in ('RASCUNHO','VALIDANDO','PENDENTE_CORRECAO','PRONTA','CONCLUIDA','CANCELADA')),
  usuario_id uuid references auth.users(id),
  quantidade_linhas integer not null default 0,
  quantidade_importada integer not null default 0,
  quantidade_com_erro integer not null default 0,
  criado_em timestamptz not null default now(),
  confirmado_em timestamptz
);

create table public.importacao_linhas (
  id bigint generated always as identity primary key,
  importacao_id uuid not null references public.importacoes(id) on delete cascade,
  numero_linha integer not null,
  dados_originais jsonb not null,
  dados_normalizados jsonb,
  status text not null default 'PENDENTE'
    check (status in ('PENDENTE','VALIDA','ERRO','IMPORTADA','IGNORADA')),
  mensagem_erro text,
  patrimonio_id uuid references public.patrimonios(id),
  unique (importacao_id, numero_linha)
);

create or replace function public.gerar_id_interna(
  p_tipo_id smallint,
  p_data_aquisicao date default current_date
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ano smallint;
  v_mes smallint;
  v_codigo char(1);
  v_proximo integer;
begin
  if p_data_aquisicao is null then
    p_data_aquisicao := current_date;
  end if;

  select codigo_id into v_codigo
  from public.tipos_patrimonio
  where id = p_tipo_id and ativo = true;

  if v_codigo is null then
    raise exception 'Tipo de patrimônio inválido ou inativo';
  end if;

  v_ano := extract(year from p_data_aquisicao);
  v_mes := extract(month from p_data_aquisicao);

  insert into public.controle_sequencias (tipo_id, ano, mes, ultimo_numero)
  values (p_tipo_id, v_ano, v_mes, 1)
  on conflict (tipo_id, ano, mes)
  do update set ultimo_numero = public.controle_sequencias.ultimo_numero + 1
  returning ultimo_numero into v_proximo;

  if v_proximo > 9999 then
    raise exception 'Limite mensal de 9.999 IDs atingido para o tipo %', p_tipo_id;
  end if;

  return v_codigo
    || lpad(v_mes::text, 2, '0')
    || v_ano::text
    || lpad(v_proximo::text, 4, '0');
end;
$$;

create or replace function public.preencher_id_interna()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id_interna is null or btrim(new.id_interna) = '' then
    new.id_interna := public.gerar_id_interna(new.tipo_id, coalesce(new.data_aquisicao, current_date));
  end if;
  return new;
end;
$$;

create trigger trg_patrimonio_id_interna
before insert on public.patrimonios
for each row execute function public.preencher_id_interna();

create or replace function public.registrar_historico_patrimonio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.historico_alteracoes
      (tabela, registro_id, operacao, dados_novos, usuario_id)
    values
      ('patrimonios', new.id, 'INSERT', to_jsonb(new), auth.uid());
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.historico_alteracoes
      (tabela, registro_id, operacao, dados_anteriores, dados_novos, usuario_id)
    values
      ('patrimonios', new.id,
       case
         when old.status = 'ATIVO' and new.status = 'INATIVO' then 'INATIVACAO'
         when old.status = 'INATIVO' and new.status = 'ATIVO' then 'REATIVACAO'
         else 'UPDATE'
       end,
       to_jsonb(old), to_jsonb(new), auth.uid());
    return new;
  end if;
  return null;
end;
$$;

create trigger trg_historico_patrimonio
after insert or update on public.patrimonios
for each row execute function public.registrar_historico_patrimonio();

create index idx_patrimonios_centro on public.patrimonios(centro_custo_id);
create index idx_patrimonios_tipo on public.patrimonios(tipo_id);
create index idx_patrimonios_status on public.patrimonios(status);
create index idx_patrimonios_descricao on public.patrimonios using gin (to_tsvector('portuguese', descricao));

alter table public.tipos_patrimonio enable row level security;
alter table public.centros_custo enable row level security;
alter table public.descricoes_padrao enable row level security;
alter table public.fornecedores enable row level security;
alter table public.patrimonios enable row level security;
alter table public.historico_alteracoes enable row level security;
alter table public.aliases_centros_custo enable row level security;
alter table public.importacoes enable row level security;
alter table public.importacao_linhas enable row level security;

create policy "usuarios autenticados leem tipos" on public.tipos_patrimonio for select to authenticated using (true);
create policy "usuarios autenticados leem centros" on public.centros_custo for select to authenticated using (true);
create policy "usuarios autenticados leem descricoes" on public.descricoes_padrao for select to authenticated using (true);
create policy "usuarios autenticados leem fornecedores" on public.fornecedores for select to authenticated using (true);
create policy "usuarios autenticados leem patrimonios" on public.patrimonios for select to authenticated using (true);
create policy "usuarios autenticados inserem patrimonios" on public.patrimonios for insert to authenticated with check (true);
create policy "usuarios autenticados atualizam patrimonios" on public.patrimonios for update to authenticated using (true) with check (true);
create policy "usuarios autenticados leem historico" on public.historico_alteracoes for select to authenticated using (true);

-- As políticas administrativas serão refinadas quando criarmos perfis e permissões.
