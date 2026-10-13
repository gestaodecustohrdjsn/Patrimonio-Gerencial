-- Patrimônio+ | Atualizador inteligente do Catálogo SIGEM v1
-- Cria aliases/de-para, histórico detalhado de atualizações e aplicação transacional.

begin;

create table if not exists catalogo_sigem_aliases (
  id uuid primary key default gen_random_uuid(),
  alias_original text not null,
  alias_normalizado text not null unique,
  descricao_padrao_id uuid not null references descricoes_padrao(id) on delete cascade,
  criado_por uuid references usuarios(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_catalogo_sigem_aliases_item
  on catalogo_sigem_aliases(descricao_padrao_id);

create table if not exists catalogo_sigem_atualizacoes (
  id uuid primary key default gen_random_uuid(),
  nome_arquivo text not null,
  catalogo_completo boolean not null default false,
  quantidade_arquivo integer not null default 0,
  correspondencias_exatas integer not null default 0,
  correspondencias_alias integer not null default 0,
  correspondencias_confirmadas integer not null default 0,
  novos_itens integer not null default 0,
  duplicados_adicionados integer not null default 0,
  ignorados integer not null default 0,
  inativados integer not null default 0,
  reativados integer not null default 0,
  usuario_id uuid references usuarios(id),
  criado_em timestamptz not null default now()
);

create index if not exists idx_catalogo_sigem_atualizacoes_data
  on catalogo_sigem_atualizacoes(criado_em desc);

create table if not exists catalogo_sigem_atualizacao_itens (
  id bigserial primary key,
  atualizacao_id uuid not null references catalogo_sigem_atualizacoes(id) on delete cascade,
  acao text not null check (acao in (
    'EXATO','ALIAS','MESMO_ITEM','NOVO','DUPLICADO',
    'IGNORADO','MANTIDO','INATIVADO','REATIVADO'
  )),
  nome_arquivo text not null,
  item_catalogo_id uuid references descricoes_padrao(id) on delete set null,
  item_catalogo_nome text,
  tipo_id integer,
  similaridade numeric(6,5),
  detalhes jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists idx_catalogo_sigem_atualizacao_itens_atualizacao
  on catalogo_sigem_atualizacao_itens(atualizacao_id, id);

create or replace function aplicar_atualizacao_catalogo_sigem_api(
  p_nome_arquivo text,
  p_catalogo_completo boolean,
  p_quantidade_arquivo integer,
  p_acoes jsonb,
  p_usuario_id uuid
)
returns jsonb
language plpgsql
as $$
declare
  v_atualizacao_id uuid;
  v_acao jsonb;
  v_tipo_acao text;
  v_nome text;
  v_item_id uuid;
  v_tipo_id integer;
  v_valor numeric;
  v_similaridade numeric;
  v_alias_normalizado text;
  v_alias_existente uuid;
  v_item_antigo record;
  v_novo_id uuid;

  v_exatos integer := 0;
  v_aliases integer := 0;
  v_confirmados integer := 0;
  v_novos integer := 0;
  v_duplicados integer := 0;
  v_ignorados integer := 0;
  v_inativados integer := 0;
  v_reativados integer := 0;
begin
  if coalesce(btrim(p_nome_arquivo), '') = '' then
    raise exception 'Nome do arquivo é obrigatório';
  end if;

  if p_quantidade_arquivo < 1 then
    raise exception 'A atualização deve conter pelo menos um item';
  end if;

  if jsonb_typeof(p_acoes) <> 'array' then
    raise exception 'Plano de atualização inválido';
  end if;

  insert into catalogo_sigem_atualizacoes(
    nome_arquivo,catalogo_completo,quantidade_arquivo,usuario_id
  ) values (
    btrim(p_nome_arquivo),coalesce(p_catalogo_completo,false),p_quantidade_arquivo,p_usuario_id
  )
  returning id into v_atualizacao_id;

  for v_acao in
    select value from jsonb_array_elements(p_acoes)
  loop
    v_tipo_acao := upper(coalesce(v_acao->>'acao',''));
    v_nome := btrim(coalesce(v_acao->>'nome',''));
    v_item_id := nullif(v_acao->>'item_id','')::uuid;
    v_tipo_id := nullif(v_acao->>'tipo_id','')::integer;
    v_valor := nullif(v_acao->>'valor_padrao','')::numeric;
    v_similaridade := nullif(v_acao->>'similaridade','')::numeric;
    v_alias_normalizado := nullif(btrim(coalesce(v_acao->>'alias_anterior_normalizado','')), '');

    if v_tipo_acao not in (
      'EXATO','ALIAS','MESMO_ITEM','NOVO','DUPLICADO',
      'IGNORAR','MANTER','INATIVAR','REATIVAR'
    ) then
      raise exception 'Ação de catálogo inválida: %', v_tipo_acao;
    end if;

    if v_tipo_acao in ('EXATO','ALIAS','MESMO_ITEM','INATIVAR','REATIVAR','MANTER') then
      if v_item_id is null then
        raise exception 'Ação % exige item_id', v_tipo_acao;
      end if;
      if not exists(select 1 from descricoes_padrao where id=v_item_id) then
        raise exception 'Item SIGEM não encontrado: %', v_item_id;
      end if;
    end if;

    if v_tipo_acao in ('NOVO','DUPLICADO','MESMO_ITEM') then
      if v_nome = '' then
        raise exception 'Ação % exige nome', v_tipo_acao;
      end if;
      if v_tipo_id not in (1,2,3) then
        raise exception 'Ação % exige Tipo válido', v_tipo_acao;
      end if;
    end if;

    if v_tipo_acao = 'EXATO' then
      v_exatos := v_exatos + 1;
      if coalesce((v_acao->>'reativar')::boolean,false) then
        update descricoes_padrao set ativo=true where id=v_item_id and ativo=false;
        if found then v_reativados := v_reativados + 1; end if;
      end if;

      insert into catalogo_sigem_atualizacao_itens(
        atualizacao_id,acao,nome_arquivo,item_catalogo_id,item_catalogo_nome,tipo_id,detalhes
      )
      select v_atualizacao_id,
             case when coalesce((v_acao->>'reativar')::boolean,false) then 'REATIVADO' else 'EXATO' end,
             coalesce(v_nome,d.descricao),d.id,d.descricao,d.tipo_id,
             jsonb_build_object('correspondencia','EXATA')
      from descricoes_padrao d where d.id=v_item_id;

    elsif v_tipo_acao = 'ALIAS' then
      v_aliases := v_aliases + 1;
      if coalesce((v_acao->>'reativar')::boolean,false) then
        update descricoes_padrao set ativo=true where id=v_item_id and ativo=false;
        if found then v_reativados := v_reativados + 1; end if;
      end if;

      insert into catalogo_sigem_atualizacao_itens(
        atualizacao_id,acao,nome_arquivo,item_catalogo_id,item_catalogo_nome,tipo_id,detalhes
      )
      select v_atualizacao_id,
             case when coalesce((v_acao->>'reativar')::boolean,false) then 'REATIVADO' else 'ALIAS' end,
             coalesce(v_nome,d.descricao),d.id,d.descricao,d.tipo_id,
             jsonb_build_object('correspondencia','ALIAS')
      from descricoes_padrao d where d.id=v_item_id;

    elsif v_tipo_acao = 'MESMO_ITEM' then
      select id,descricao,tipo_id,valor_padrao,ativo
        into v_item_antigo
      from descricoes_padrao
      where id=v_item_id
      for update;

      if v_alias_normalizado is not null then
        select descricao_padrao_id into v_alias_existente
        from catalogo_sigem_aliases
        where alias_normalizado=v_alias_normalizado;

        if v_alias_existente is not null and v_alias_existente <> v_item_id then
          raise exception 'O alias % já aponta para outro item SIGEM', v_alias_normalizado;
        end if;

        insert into catalogo_sigem_aliases(
          alias_original,alias_normalizado,descricao_padrao_id,criado_por
        ) values (
          v_item_antigo.descricao,v_alias_normalizado,v_item_id,p_usuario_id
        )
        on conflict(alias_normalizado) do update
          set alias_original=excluded.alias_original,
              descricao_padrao_id=excluded.descricao_padrao_id,
              atualizado_em=now();
      end if;

      update descricoes_padrao
      set descricao=v_nome,
          tipo_id=v_tipo_id,
          valor_padrao=coalesce(v_valor,valor_padrao),
          ativo=true
      where id=v_item_id;

      update patrimonios
      set tipo_id=v_tipo_id,
          atualizado_por=p_usuario_id
      where descricao_padrao_id=v_item_id
        and tipo_id is not distinct from v_item_antigo.tipo_id;

      v_confirmados := v_confirmados + 1;
      if not v_item_antigo.ativo then v_reativados := v_reativados + 1; end if;

      insert into catalogo_sigem_atualizacao_itens(
        atualizacao_id,acao,nome_arquivo,item_catalogo_id,item_catalogo_nome,
        tipo_id,similaridade,detalhes
      ) values (
        v_atualizacao_id,'MESMO_ITEM',v_nome,v_item_id,v_nome,
        v_tipo_id,v_similaridade,
        jsonb_build_object(
          'nome_anterior',v_item_antigo.descricao,
          'tipo_anterior',v_item_antigo.tipo_id,
          'valor_anterior',v_item_antigo.valor_padrao,
          'alias_criado',v_item_antigo.descricao
        )
      );

    elsif v_tipo_acao in ('NOVO','DUPLICADO') then
      if v_tipo_acao='NOVO' and exists(
        select 1 from descricoes_padrao
        where lower(btrim(descricao))=lower(v_nome)
      ) then
        raise exception 'Item novo já existe no catálogo: %', v_nome;
      end if;

      insert into descricoes_padrao(descricao,valor_padrao,tipo_id,ativo)
      values(v_nome,v_valor,v_tipo_id,true)
      returning id into v_novo_id;

      if v_tipo_acao='NOVO' then
        v_novos := v_novos + 1;
      else
        v_duplicados := v_duplicados + 1;
      end if;

      insert into catalogo_sigem_atualizacao_itens(
        atualizacao_id,acao,nome_arquivo,item_catalogo_id,item_catalogo_nome,tipo_id,detalhes
      ) values (
        v_atualizacao_id,
        case when v_tipo_acao='NOVO' then 'NOVO' else 'DUPLICADO' end,
        v_nome,v_novo_id,v_nome,v_tipo_id,
        jsonb_build_object('valor_padrao',v_valor)
      );

    elsif v_tipo_acao='IGNORAR' then
      v_ignorados := v_ignorados + 1;
      insert into catalogo_sigem_atualizacao_itens(
        atualizacao_id,acao,nome_arquivo,item_catalogo_id,item_catalogo_nome,tipo_id,similaridade,detalhes
      ) values (
        v_atualizacao_id,'IGNORADO',v_nome,v_item_id,
        (select descricao from descricoes_padrao where id=v_item_id),
        v_tipo_id,v_similaridade,jsonb_build_object('motivo','Ignorado na revisão')
      );

    elsif v_tipo_acao='MANTER' then
      insert into catalogo_sigem_atualizacao_itens(
        atualizacao_id,acao,nome_arquivo,item_catalogo_id,item_catalogo_nome,tipo_id,detalhes
      )
      select v_atualizacao_id,'MANTIDO',coalesce(v_nome,d.descricao),d.id,d.descricao,d.tipo_id,
             jsonb_build_object('motivo','Ausente no arquivo, mantido ativo')
      from descricoes_padrao d where d.id=v_item_id;

    elsif v_tipo_acao='INATIVAR' then
      update descricoes_padrao set ativo=false where id=v_item_id and ativo=true;
      if found then v_inativados := v_inativados + 1; end if;

      insert into catalogo_sigem_atualizacao_itens(
        atualizacao_id,acao,nome_arquivo,item_catalogo_id,item_catalogo_nome,tipo_id,detalhes
      )
      select v_atualizacao_id,'INATIVADO',coalesce(v_nome,d.descricao),d.id,d.descricao,d.tipo_id,
             jsonb_build_object('motivo','Ausente no catálogo importado')
      from descricoes_padrao d where d.id=v_item_id;

    elsif v_tipo_acao='REATIVAR' then
      update descricoes_padrao set ativo=true where id=v_item_id and ativo=false;
      if found then v_reativados := v_reativados + 1; end if;

      insert into catalogo_sigem_atualizacao_itens(
        atualizacao_id,acao,nome_arquivo,item_catalogo_id,item_catalogo_nome,tipo_id,detalhes
      )
      select v_atualizacao_id,'REATIVADO',coalesce(v_nome,d.descricao),d.id,d.descricao,d.tipo_id,
             jsonb_build_object('motivo','Presente novamente no catálogo importado')
      from descricoes_padrao d where d.id=v_item_id;
    end if;
  end loop;

  update catalogo_sigem_atualizacoes
  set correspondencias_exatas=v_exatos,
      correspondencias_alias=v_aliases,
      correspondencias_confirmadas=v_confirmados,
      novos_itens=v_novos,
      duplicados_adicionados=v_duplicados,
      ignorados=v_ignorados,
      inativados=v_inativados,
      reativados=v_reativados
  where id=v_atualizacao_id;

  insert into historico_alteracoes(
    tabela,registro_id,operacao,dados_novos,usuario_id
  ) values (
    'catalogo_sigem_atualizacoes',
    v_atualizacao_id,
    'CATALOGO_SIGEM_ATUALIZADO',
    jsonb_build_object(
      'nome_arquivo',btrim(p_nome_arquivo),
      'quantidade_arquivo',p_quantidade_arquivo,
      'catalogo_completo',coalesce(p_catalogo_completo,false),
      'correspondencias_exatas',v_exatos,
      'correspondencias_alias',v_aliases,
      'correspondencias_confirmadas',v_confirmados,
      'novos_itens',v_novos,
      'duplicados_adicionados',v_duplicados,
      'ignorados',v_ignorados,
      'inativados',v_inativados,
      'reativados',v_reativados
    ),
    p_usuario_id
  );

  return jsonb_build_object(
    'ok',true,
    'atualizacao_id',v_atualizacao_id,
    'nome_arquivo',btrim(p_nome_arquivo),
    'quantidade_arquivo',p_quantidade_arquivo,
    'correspondencias_exatas',v_exatos,
    'correspondencias_alias',v_aliases,
    'correspondencias_confirmadas',v_confirmados,
    'novos_itens',v_novos,
    'duplicados_adicionados',v_duplicados,
    'ignorados',v_ignorados,
    'inativados',v_inativados,
    'reativados',v_reativados
  );
end;
$$;

commit;

select 'CATALOGO_SIGEM_ATUALIZADOR_V1_OK' as resultado;
