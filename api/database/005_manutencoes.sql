-- Patrimônio+ | Manutenções v1
-- Executar no Neon antes de publicar a API 3.2.

begin;

create table if not exists manutencoes_patrimonio (
  id uuid primary key default gen_random_uuid(),
  patrimonio_id uuid not null references patrimonios(id) on delete cascade,
  tipo text not null check (tipo in ('PREVENTIVA','CORRETIVA')),
  descricao text not null,
  status text not null default 'ABERTA' check (status in ('ABERTA','CONCLUIDA')),
  data_inicio date not null default current_date,
  data_fim date,
  usuario_id uuid references usuarios(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint manutencao_datas_validas check (data_fim is null or data_fim >= data_inicio)
);

create index if not exists idx_manutencoes_patrimonio
  on manutencoes_patrimonio(patrimonio_id, data_inicio desc);

commit;

select 'MANUTENCOES_V1_OK' as resultado;
