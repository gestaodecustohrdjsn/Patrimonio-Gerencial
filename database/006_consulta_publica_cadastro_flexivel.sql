begin;

-- Cadastro flexível: SIGEM e valores deixam de ser obrigatórios.
alter table public.patrimonios
  alter column descricao_padrao_id drop not null,
  alter column valor_aquisicao drop not null,
  alter column data_aquisicao set default current_date,
  alter column estado_conservacao set default 'BEM_CONSERVADO',
  alter column status set default 'ATIVO';

-- Identificador público não sequencial usado exclusivamente no QR Code.
alter table public.patrimonios
  add column if not exists public_token uuid;

update public.patrimonios
   set public_token = gen_random_uuid()
 where public_token is null;

alter table public.patrimonios
  alter column public_token set default gen_random_uuid(),
  alter column public_token set not null;

create unique index if not exists uq_patrimonios_public_token
  on public.patrimonios(public_token);

-- Consulta pública limitada a uma única ficha, sem liberar SELECT na tabela.
create or replace function public.consultar_patrimonio_publico(p_token uuid)
returns table (
  id_interna text,
  id_ses text,
  descricao text,
  tipo_id smallint,
  descricao_padrao text,
  marca_modelo text,
  centro_custo text,
  estado_conservacao text,
  status text,
  tipo_aquisicao text,
  data_aquisicao date,
  valor_aquisicao numeric,
  nota_fiscal_numero text,
  fornecedor text,
  observacoes text,
  criado_em timestamptz,
  atualizado_em timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id_interna::text,
    p.id_ses,
    p.descricao,
    p.tipo_id,
    d.descricao,
    p.marca_modelo,
    c.nome,
    p.estado_conservacao::text,
    p.status::text,
    p.tipo_aquisicao::text,
    p.data_aquisicao,
    p.valor_aquisicao,
    p.nota_fiscal_numero,
    f.razao_social,
    p.observacoes,
    p.criado_em,
    p.atualizado_em
  from public.patrimonios p
  join public.centros_custo c on c.id = p.centro_custo_id
  left join public.descricoes_padrao d on d.id = p.descricao_padrao_id
  left join public.fornecedores f on f.id = p.fornecedor_id
  where p.public_token = p_token
    and coalesce(p.removido, false) = false
  limit 1;
$$;

revoke all on function public.consultar_patrimonio_publico(uuid) from public;
grant usage on schema public to anon, authenticated;
grant execute on function public.consultar_patrimonio_publico(uuid) to anon, authenticated;

commit;

select
  'v0.7 pronta' as resultado,
  count(*) as total_patrimonios,
  count(*) filter (where descricao_padrao_id is null) as sem_sigem,
  count(*) filter (where valor_aquisicao is null) as sem_valor,
  count(*) filter (where public_token is not null) as com_qr_publico
from public.patrimonios;
